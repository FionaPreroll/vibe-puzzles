import {
	coveredCells,
	CROSS,
	edgeValue,
	interiorEdges,
	isBlocked,
	isSolvedState,
	LINE,
	mirrorCell,
	OPEN,
	type EdgeRef,
	type PinwheelPuzzle,
	type PinwheelState
} from './rules';
import { neighbours } from '../../core/grid';
import { solvePinwheel } from './solver';

/**
 * Deductions a hint can name, from the simplest to the hardest. Each rules out a galaxy for a
 * cell; an edge is decided once the cells on its sides can share no galaxy (a line) or both
 * belong to the same one (no line).
 *
 * - `centre`: the cells under a centre belong to it, and a cell whose mirror through a centre
 *   lies outside the grid cannot.
 * - `marks`: the player's lines keep cells apart, crosses join them.
 * - `symmetry`: a cell belongs to a galaxy only if its mirror can too.
 * - `reach`: the centre must reach the cell through cells that may belong to its galaxy.
 */
export const TECHNIQUES = ['centre', 'marks', 'symmetry', 'reach'] as const;
export type Technique = (typeof TECHNIQUES)[number];

export type PinwheelHint =
	/** Lines between cells of one galaxy, and crosses between different galaxies. */
	| { kind: 'mistake'; edges: EdgeRef[] }
	/** Edges that follow, with the hardest deduction needed for them. */
	| { kind: 'step'; technique: Technique; mark: 'line' | 'cross'; edges: EdgeRef[] }
	/** No deduction applies: case analysis is needed, best at the cell with the fewest options. */
	| { kind: 'stuck'; cell: number };

const solutions = new WeakMap<PinwheelPuzzle, Int32Array | null>();

function solutionOf(p: PinwheelPuzzle): Int32Array | null {
	if (!solutions.has(p)) {
		const res = solvePinwheel(p, { limit: 1, maxNodes: 2_000_000 });
		solutions.set(p, res.solutions[0] ?? null);
	}
	return solutions.get(p)!;
}

/** Interior edges a player can mark (not through a centre). */
const markable = (p: PinwheelPuzzle) =>
	interiorEdges(p).filter((e) => !isBlocked(p, e.kind, e.i, e.j));

/** The next step from the player's lines and crosses: a mistake, edges that follow, or none. */
export function pinwheelHint(p: PinwheelPuzzle, state: PinwheelState): PinwheelHint | null {
	if (isSolvedState(p, state)) return null;
	const solution = solutionOf(p);
	if (solution) {
		const wrong = markable(p).filter((e) => {
			const value = edgeValue(p, state, e.kind, e.i, e.j);
			const same = solution[e.a] === solution[e.b];
			return (value === LINE && same) || (value === CROSS && !same);
		});
		if (wrong.length)
			return { kind: 'mistake', edges: wrong.map(({ kind, i, j }) => ({ kind, i, j })) };
	}
	return new Deduction(p, state).next();
}

class Deduction {
	private readonly n: number;
	private readonly g: number;
	/** dom[c * g + k] = 1 while cell c may belong to centre k. */
	private readonly dom: Uint8Array;
	/** Hardest technique that ruled out a centre, per cell. */
	private readonly level: Int32Array;
	private readonly edges: ReturnType<typeof interiorEdges>;

	constructor(
		private readonly p: PinwheelPuzzle,
		private readonly state: PinwheelState
	) {
		this.n = p.width * p.height;
		this.g = p.centres.length;
		this.dom = new Uint8Array(this.n * this.g);
		this.level = new Int32Array(this.n);
		this.edges = markable(p);
		for (let c = 0; c < this.n; c++) {
			p.centres.forEach((centre, k) => {
				this.dom[c * this.g + k] = mirrorCell(p, c, centre) >= 0 ? 1 : 0;
			});
		}
		p.centres.forEach((centre, k) => {
			for (const c of coveredCells(p, centre)) {
				for (let o = 0; o < this.g; o++) if (o !== k) this.dom[c * this.g + o] = 0;
			}
		});
	}

	next(): PinwheelHint {
		const sweeps = [() => this.marks(), () => this.symmetry(), () => this.reach()];
		for (;;) {
			const step = this.decided();
			if (step) return step;
			const used = sweeps.findIndex((sweep) => sweep());
			if (used < 0) return this.stuck();
		}
	}

	private has(c: number, k: number) {
		return this.dom[c * this.g + k] === 1;
	}

	private remove(c: number, k: number, technique: number): boolean {
		if (!this.has(c, k)) return false;
		this.dom[c * this.g + k] = 0;
		this.level[c] = Math.max(this.level[c], technique);
		return true;
	}

	/** The only centre left for a cell, or -1. */
	private owner(c: number): number {
		let found = -1;
		for (let k = 0; k < this.g; k++) {
			if (!this.has(c, k)) continue;
			if (found >= 0) return -1;
			found = k;
		}
		return found;
	}

	private marks(): boolean {
		let changed = false;
		for (const e of this.edges) {
			const value = edgeValue(this.p, this.state, e.kind, e.i, e.j);
			if (value === LINE) {
				for (const [x, y] of [
					[e.a, e.b],
					[e.b, e.a]
				]) {
					const k = this.owner(x);
					if (k >= 0 && this.remove(y, k, 1)) changed = true;
				}
			} else if (value === CROSS) {
				for (let k = 0; k < this.g; k++) {
					if (this.has(e.a, k) !== this.has(e.b, k)) {
						changed = this.remove(e.a, k, 1) || this.remove(e.b, k, 1) || changed;
					}
				}
			}
		}
		return changed;
	}

	private symmetry(): boolean {
		let changed = false;
		for (let c = 0; c < this.n; c++) {
			for (let k = 0; k < this.g; k++) {
				if (!this.has(c, k)) continue;
				const m = mirrorCell(this.p, c, this.p.centres[k]);
				if (!this.has(m, k) && this.remove(c, k, 2)) changed = true;
			}
			// A decided cell decides its mirror.
			const k = this.owner(c);
			if (k < 0) continue;
			const m = mirrorCell(this.p, c, this.p.centres[k]);
			for (let o = 0; o < this.g; o++) if (o !== k && this.remove(m, o, 2)) changed = true;
		}
		return changed;
	}

	private reach(): boolean {
		const { p, n, g } = this;
		let changed = false;
		for (let k = 0; k < g; k++) {
			const seen = new Uint8Array(n);
			const queue = coveredCells(p, p.centres[k]);
			for (const c of queue) seen[c] = 1;
			for (let head = 0; head < queue.length; head++) {
				for (const j of neighbours(queue[head], p.width, p.height)) {
					if (!seen[j] && this.has(j, k)) {
						seen[j] = 1;
						queue.push(j);
					}
				}
			}
			for (let c = 0; c < n; c++) if (!seen[c] && this.remove(c, k, 3)) changed = true;
		}
		return changed;
	}

	/** Open edges that are now decided, the simplest first, around one galaxy. */
	private decided(): PinwheelHint | null {
		const facts = this.edges.flatMap((e) => {
			if (edgeValue(this.p, this.state, e.kind, e.i, e.j) !== OPEN) return [];
			const owner = this.owner(e.a);
			let shared = false;
			for (let k = 0; k < this.g && !shared; k++) shared = this.has(e.a, k) && this.has(e.b, k);
			const mark = !shared ? 'line' : owner >= 0 && owner === this.owner(e.b) ? 'cross' : null;
			if (!mark) return [];
			const technique = Math.max(this.level[e.a], this.level[e.b]);
			return [{ e, mark, technique, galaxy: owner >= 0 ? owner : this.owner(e.b) }];
		});
		if (!facts.length) return null;
		// Lines first: they are what solves the puzzle; crosses only help.
		const rank = (f: (typeof facts)[number]) => f.technique + (f.mark === 'line' ? 0 : 4);
		const first = facts.reduce((best, f) => (rank(f) < rank(best) ? f : best));
		const group = facts.filter(
			(f) =>
				f === first || (rank(f) === rank(first) && first.galaxy >= 0 && f.galaxy === first.galaxy)
		);
		return {
			kind: 'step',
			technique: TECHNIQUES[first.technique],
			mark: first.mark as 'line' | 'cross',
			edges: group.map(({ e }) => ({ kind: e.kind, i: e.i, j: e.j }))
		};
	}

	private stuck(): PinwheelHint {
		let cell = -1;
		let fewest = Infinity;
		for (let c = 0; c < this.n; c++) {
			let count = 0;
			for (let k = 0; k < this.g; k++) count += this.dom[c * this.g + k];
			if (count > 1 && count < fewest) {
				cell = c;
				fewest = count;
			}
		}
		return { kind: 'stuck', cell };
	}
}
