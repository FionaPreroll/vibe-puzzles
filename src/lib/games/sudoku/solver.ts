import type { Rng } from '../../core/rng';
import { allMask, bit, geometry, popcount, type SudokuPuzzle } from './rules';

export interface SolveOptions {
	/** Stop after this many solutions. */
	limit: number;
	/** Give up after visiting this many search nodes. */
	maxNodes?: number;
	/** Try digits in a random order (used to fill an empty grid). */
	rng?: Rng;
}

export interface SolveResult {
	solutions: number[][];
	/** False when the search gave up before it was complete. */
	finished: boolean;
}

/**
 * Backtracking search over row, column and box bit masks, always branching on the empty cell
 * with the fewest candidates.
 */
export function solveSudoku(
	givens: readonly number[],
	size: number,
	opts: SolveOptions
): SolveResult {
	const { units, unitsOf } = geometry(size);
	const n = size * size;
	const grid = Int8Array.from(givens);
	const used = new Int32Array(units.length);
	const solutions: number[][] = [];
	const full = allMask(size);
	const maxNodes = opts.maxNodes ?? Infinity;
	let nodes = 0;

	for (let i = 0; i < n; i++) {
		const d = grid[i];
		if (!d) continue;
		const b = bit(d);
		for (const u of unitsOf[i]) {
			if (used[u] & b) return { solutions, finished: true };
			used[u] |= b;
		}
	}

	const free = (i: number) => {
		const [r, c, x] = unitsOf[i];
		return full & ~(used[r] | used[c] | used[x]);
	};

	const search = (): boolean => {
		if (++nodes > maxNodes) return false;
		let best = -1;
		let bestMask = 0;
		let bestCount = size + 1;
		for (let i = 0; i < n; i++) {
			if (grid[i]) continue;
			const m = free(i);
			const k = popcount(m);
			if (k < bestCount) {
				best = i;
				bestMask = m;
				bestCount = k;
				if (k <= 1) break;
			}
		}
		if (best < 0) {
			solutions.push(Array.from(grid));
			return solutions.length < opts.limit;
		}
		const digits: number[] = [];
		for (let d = 1; d <= size; d++) if (bestMask & bit(d)) digits.push(d);
		if (opts.rng) opts.rng.shuffle(digits);
		const [r, c, x] = unitsOf[best];
		for (const d of digits) {
			const b = bit(d);
			grid[best] = d;
			used[r] |= b;
			used[c] |= b;
			used[x] |= b;
			const go = search();
			grid[best] = 0;
			used[r] &= ~b;
			used[c] &= ~b;
			used[x] &= ~b;
			if (!go) return false;
		}
		return true;
	};

	const completed = search();
	return { solutions, finished: completed || solutions.length >= opts.limit };
}

/** Hardest technique a logical solve needed. */
export const Level = {
	/** Naked and hidden singles only. */
	Singles: 1,
	/** Also locked candidates, naked and hidden pairs and triples. */
	Subsets: 2
} as const;
export type Level = (typeof Level)[keyof typeof Level];

/**
 * Box-line intersections of at least two cells, seen from one of the two units: `within` are its
 * cells outside the intersection, `clear` the other unit's. A digit with no spot in `within` must
 * go in the intersection, so it leaves the cells of `clear`.
 */
const intersections = new Map<number, { within: number[]; clear: number[] }[]>();

export function lockedPairs(size: number) {
	let out = intersections.get(size);
	if (out) return out;
	const { units } = geometry(size);
	out = [];
	for (const a of units) {
		const inA = new Set(a);
		for (const b of units) {
			if (a === b || b.filter((i) => inA.has(i)).length < 2) continue;
			out.push({ within: a.filter((i) => !b.includes(i)), clear: b.filter((i) => !inA.has(i)) });
		}
	}
	intersections.set(size, out);
	return out;
}

export interface Rating {
	/** Solved by the techniques below, which also proves the solution unique. */
	solved: boolean;
	level: Level;
	/** The grid as far as logic got. */
	grid: number[];
}

/** All k-element subsets of `items`. */
export function subsets<T>(items: readonly T[], k: number): T[][] {
	if (k === 0) return [[]];
	const out: T[][] = [];
	for (let i = 0; i <= items.length - k; i++) {
		for (const rest of subsets(items.slice(i + 1), k - 1)) out.push([items[i], ...rest]);
	}
	return out;
}

/**
 * Solves like a person does, with pencil marks: singles first, harder eliminations only when no
 * single is left. Used to grade generated puzzles. With `maxLevel` Singles it stops where singles
 * run out.
 */
export function ratePuzzle(p: SudokuPuzzle, maxLevel: Level = Level.Subsets): Rating {
	const size = p.width;
	const { units, peers } = geometry(size);
	const n = size * size;
	const grid = p.givens.slice();
	const cand = new Array<number>(n).fill(0);
	let level: Level = Level.Singles;
	let broken = false;

	const place = (i: number, d: number) => {
		grid[i] = d;
		cand[i] = 0;
		for (const j of peers[i]) {
			if (grid[j] === d) broken = true;
			cand[j] &= ~bit(d);
		}
	};
	for (let i = 0; i < n; i++) cand[i] = grid[i] ? 0 : allMask(size);
	for (let i = 0; i < n; i++) if (grid[i]) place(i, grid[i]);

	const singles = (): boolean => {
		for (let i = 0; i < n; i++) {
			if (grid[i]) continue;
			if (!cand[i]) {
				broken = true;
				return false;
			}
			if (popcount(cand[i]) === 1) {
				place(i, Math.log2(cand[i]) + 1);
				return true;
			}
		}
		for (const unit of units) {
			for (let d = 1; d <= size; d++) {
				const b = bit(d);
				let spot = -1;
				let count = 0;
				for (const i of unit) {
					if (grid[i] === d) {
						count = -1;
						break;
					}
					if (cand[i] & b) {
						spot = i;
						count++;
					}
				}
				if (count === 0) {
					broken = true;
					return false;
				}
				if (count === 1) {
					place(spot, d);
					return true;
				}
			}
		}
		return false;
	};

	const remove = (cells: Iterable<number>, mask: number): boolean => {
		let changed = false;
		for (const i of cells) {
			if (cand[i] & mask) {
				cand[i] &= ~mask;
				changed = true;
			}
		}
		return changed;
	};

	const lockedCandidates = (): boolean => {
		for (const { within, clear } of lockedPairs(size)) {
			// Digits the unit can only hold inside the intersection (singles have run, so each
			// digit still has a spot or is placed in the unit).
			let outside = 0;
			for (const i of within) outside |= cand[i] | (grid[i] ? bit(grid[i]) : 0);
			if (remove(clear, allMask(size) & ~outside)) return true;
		}
		return false;
	};

	const nakedAndHiddenSubsets = (): boolean => {
		for (const unit of units) {
			const open = unit.filter((i) => !grid[i]);
			for (let k = 2; k <= 3 && k < open.length; k++) {
				for (const group of subsets(open, k)) {
					const mask = group.reduce((m, i) => m | cand[i], 0);
					if (popcount(mask) !== k) continue;
					const rest = open.filter((i) => !group.includes(i));
					if (remove(rest, mask)) return true;
				}
				const missing = [];
				for (let d = 1; d <= size; d++) if (open.some((i) => cand[i] & bit(d))) missing.push(d);
				for (const digits of subsets(missing, k)) {
					const mask = digits.reduce((m, d) => m | bit(d), 0);
					const spots = open.filter((i) => cand[i] & mask);
					if (spots.length !== k) continue;
					if (remove(spots, allMask(size) & ~mask)) return true;
				}
			}
		}
		return false;
	};

	for (;;) {
		if (broken) break;
		if (singles()) continue;
		if (broken || maxLevel < Level.Subsets) break;
		if (lockedCandidates() || nakedAndHiddenSubsets()) {
			level = Level.Subsets;
			continue;
		}
		break;
	}
	const solved = !broken && grid.every(Boolean);
	return { solved, level, grid };
}
