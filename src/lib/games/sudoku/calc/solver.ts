import type { Rng } from '../../../core/rng';
import { evaluate, type CalcPuzzle, type Cage } from './rules';

const bit = (d: number) => 1 << (d - 1);

function popcount(mask: number): number {
	let n = 0;
	for (; mask; mask &= mask - 1) n++;
	return n;
}

const digitOf = (mask: number) => 31 - Math.clz32(mask) + 1;

/** Techniques a logical solve may use, from simplest. */
export const CalcLevel = {
	/** Cage arithmetic, and a placed digit leaves its row and column. */
	Basic: 1,
	/** Also hidden singles and naked pairs in rows and columns. */
	Advanced: 2,
	/** Everything, plus guessing (only for the full solver). */
	Search: 3
} as const;
export type CalcLevel = (typeof CalcLevel)[keyof typeof CalcLevel];

export interface Model {
	n: number;
	cages: Cage[];
	/** Rows then columns. */
	lines: number[][];
	/** Per cage, every digit tuple meeting its target (cells in a shared line distinct). */
	tuples: number[][][];
}

/** All tuples of digits 1..n for the cage's cells that meet its target. */
function cageTuples(cage: Cage, n: number): number[][] {
	const cells = cage.cells;
	const len = cells.length;
	const clash: [number, number][] = [];
	cells.forEach((a, k) =>
		cells.forEach((b, l) => {
			if (l > k && (Math.floor(a / n) === Math.floor(b / n) || a % n === b % n)) clash.push([k, l]);
		})
	);
	const out: number[][] = [];
	const pick = new Array<number>(len).fill(0);
	const walk = (pos: number, acc: number) => {
		if (pos === len) {
			if (evaluate(cage.op, pick) === cage.target) out.push(pick.slice());
			return;
		}
		for (let d = 1; d <= n; d++) {
			// Prune sums and products that already overshoot.
			if (cage.op === '+' && acc + d + (len - pos - 1) > cage.target) break;
			if (cage.op === '*' && cage.target % (acc * d) !== 0) continue;
			if (clash.some(([a, b]) => b === pos && pick[a] === d)) continue;
			pick[pos] = d;
			walk(pos + 1, cage.op === '+' ? acc + d : cage.op === '*' ? acc * d : 0);
		}
	};
	walk(0, cage.op === '*' ? 1 : 0);
	return out;
}

export function model(p: CalcPuzzle): Model {
	const n = p.width;
	const lines: number[][] = [];
	for (let r = 0; r < n; r++) lines.push(Array.from({ length: n }, (_, c) => r * n + c));
	for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => r * n + c));
	return { n, cages: p.cages, lines, tuples: p.cages.map((c) => cageTuples(c, n)) };
}

/**
 * Narrow a cage's domains to digits that appear in some tuple meeting its target. Returns false
 * on a contradiction.
 */
export function filterCage(m: Model, k: number, dom: Int32Array): boolean | 'changed' {
	const cells = m.cages[k].cells;
	const len = cells.length;
	const support = new Array<number>(len).fill(0);
	tuples: for (const t of m.tuples[k]) {
		for (let q = 0; q < len; q++) if (!(dom[cells[q]] & bit(t[q]))) continue tuples;
		for (let q = 0; q < len; q++) support[q] |= bit(t[q]);
	}
	let changed = false;
	for (let q = 0; q < len; q++) {
		const next = dom[cells[q]] & support[q];
		if (!next) return false;
		if (next !== dom[cells[q]]) {
			dom[cells[q]] = next;
			changed = true;
		}
	}
	return changed ? 'changed' : true;
}

/** Placed digits leave their lines; with `advanced`, hidden singles and naked pairs too. */
function filterLines(m: Model, dom: Int32Array, advanced: boolean): boolean | 'changed' {
	let changed = false;
	for (const line of m.lines) {
		for (const i of line) {
			const d = dom[i];
			if (popcount(d) !== 1) continue;
			for (const j of line) {
				if (j !== i && dom[j] & d) {
					dom[j] &= ~d;
					if (!dom[j]) return false;
					changed = true;
				}
			}
		}
		if (!advanced) continue;
		for (let digit = 1; digit <= m.n; digit++) {
			const b = bit(digit);
			let spot = -1;
			let count = 0;
			for (const i of line) {
				if (dom[i] & b) {
					spot = i;
					count++;
				}
			}
			if (count === 0) return false;
			if (count === 1 && dom[spot] !== b) {
				dom[spot] = b;
				changed = true;
			}
		}
		for (let a = 0; a < line.length; a++) {
			const da = dom[line[a]];
			if (popcount(da) !== 2) continue;
			for (let b = a + 1; b < line.length; b++) {
				if (dom[line[b]] !== da) continue;
				for (const j of line) {
					if (j !== line[a] && j !== line[b] && dom[j] & da) {
						dom[j] &= ~da;
						if (!dom[j]) return false;
						changed = true;
					}
				}
			}
		}
	}
	return changed ? 'changed' : true;
}

/** Apply the level's techniques until nothing changes. False on a contradiction. */
function propagate(m: Model, dom: Int32Array, level: CalcLevel): boolean {
	for (;;) {
		let changed = false;
		const lines = filterLines(m, dom, level >= CalcLevel.Advanced);
		if (!lines) return false;
		if (lines === 'changed') changed = true;
		for (let k = 0; k < m.cages.length; k++) {
			const res = filterCage(m, k, dom);
			if (!res) return false;
			if (res === 'changed') changed = true;
		}
		if (!changed) return true;
	}
}

const fullDomains = (n: number) => new Int32Array(n * n).fill((1 << n) - 1);

export interface CalcSolveResult {
	solutions: number[][];
	/** False when the search gave up before it was complete. */
	finished: boolean;
}

/** Count solutions up to `limit` by propagation and branching on the tightest cell. */
export function solveCalc(
	p: CalcPuzzle,
	opts: { limit: number; maxNodes?: number; rng?: Rng }
): CalcSolveResult {
	const m = model(p);
	const solutions: number[][] = [];
	const maxNodes = opts.maxNodes ?? Infinity;
	let nodes = 0;
	let aborted = false;
	const search = (dom: Int32Array) => {
		if (solutions.length >= opts.limit) return;
		if (++nodes > maxNodes) {
			aborted = true;
			return;
		}
		if (!propagate(m, dom, CalcLevel.Advanced)) return;
		let best = -1;
		let bestCount = Infinity;
		for (let i = 0; i < dom.length; i++) {
			const k = popcount(dom[i]);
			if (k > 1 && k < bestCount) {
				best = i;
				bestCount = k;
			}
		}
		if (best < 0) {
			solutions.push(Array.from(dom, digitOf));
			return;
		}
		const digits: number[] = [];
		for (let d = 1; d <= m.n; d++) if (dom[best] & bit(d)) digits.push(d);
		if (opts.rng) opts.rng.shuffle(digits);
		for (const d of digits) {
			if (aborted || solutions.length >= opts.limit) return;
			const next = dom.slice();
			next[best] = bit(d);
			search(next);
		}
	};
	search(fullDomains(m.n));
	return { solutions, finished: !aborted || solutions.length >= opts.limit };
}

/** Solve without guessing, using techniques up to `level`. */
export function rateCalc(p: CalcPuzzle, level: CalcLevel): { solved: boolean; grid: number[] } {
	const m = model(p);
	const dom = fullDomains(m.n);
	const ok = propagate(m, dom, level);
	const solved = ok && dom.every((d) => popcount(d) === 1);
	return { solved, grid: Array.from(dom, (d) => (popcount(d) === 1 ? digitOf(d) : 0)) };
}

/** A random Latin square: every row and column holds 1..n once. */
export function randomLatinSquare(n: number, rng: Rng): number[] {
	const empty: CalcPuzzle = { width: n, height: n, cages: [] };
	return solveCalc(empty, { limit: 1, rng }).solutions[0];
}
