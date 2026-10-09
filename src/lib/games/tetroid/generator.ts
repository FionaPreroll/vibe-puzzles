import { neighbours } from '../../core/grid';
import { Rng } from '../../core/rng';
import type { Difficulty } from '../../core/variants';
import { classify, SHAPES, TET_TYPES } from './shapes';
import type { TetroidPuzzle } from './rules';
import { TetroidModel, TetroidSolver } from './solver';

export interface GeneratedTetroid {
	puzzle: TetroidPuzzle;
	/** 0/1 shading of the unique solution. */
	solution: number[];
}

/** Placement offsets relative to one of the shape's cells, to enumerate placements through a cell. */
const ANCHORED = SHAPES.flatMap((shape) =>
	shape.cells.map(([ar, ac]) => ({
		type: TET_TYPES.indexOf(shape.type),
		cells: shape.cells.map(([r, c]) => [r - ar, c - ac] as [number, number])
	}))
);

/**
 * Working state of the generator: a planted solution (region r always holds tetromino r) and the
 * current region of every cell.
 */
class Layout {
	readonly n: number;
	readonly nb: Int32Array[];
	/** Planted shading, 0/1 per cell. */
	readonly solution: Uint8Array;
	/** Type index of each region's planted tetromino. */
	readonly types: number[] = [];
	readonly regions: Int32Array;

	constructor(
		readonly w: number,
		readonly h: number
	) {
		this.n = w * h;
		this.nb = Array.from({ length: this.n }, (_, i) => Int32Array.from(neighbours(i, w, h)));
		this.solution = new Uint8Array(this.n);
		this.regions = new Int32Array(this.n).fill(-1);
	}

	get regionCount() {
		return this.types.length;
	}

	/** Placements through cell `i` lying in `region` (with `i` counted as part of it), each once. */
	placementsThrough(i: number, region: number): { cells: number[]; type: number }[] {
		const { w, h, regions } = this;
		const r = Math.floor(i / w);
		const c = i % w;
		const out: { cells: number[]; type: number }[] = [];
		for (const shape of ANCHORED) {
			const cells: number[] = [];
			for (const [dr, dc] of shape.cells) {
				const rr = r + dr;
				const cc = c + dc;
				if (rr < 0 || cc < 0 || rr >= h || cc >= w) break;
				const k = rr * w + cc;
				if (k !== i && regions[k] !== region) break;
				cells.push(k);
			}
			if (cells.length === 4) out.push({ cells, type: shape.type });
		}
		return out;
	}

	/**
	 * Whether a placement in `region` other than the planted one fits with every other planted
	 * tetromino (a second solution differing in this region only).
	 */
	isAlternative(cells: number[], type: number, region: number): boolean {
		const { w, h, solution, regions, types } = this;
		if (cells.every((i) => solution[i] && regions[i] === region)) return false;
		const shadedOther = (i: number) => solution[i] === 1 && regions[i] !== region;
		const on = (i: number) => cells.includes(i) || shadedOther(i);
		for (const i of cells) {
			for (const j of this.nb[i]) {
				if (shadedOther(j) && types[regions[j]] === type) return false;
			}
			const r = Math.floor(i / w);
			const c = i % w;
			for (let r0 = Math.max(0, r - 1); r0 <= Math.min(r, h - 2); r0++) {
				for (let c0 = Math.max(0, c - 1); c0 <= Math.min(c, w - 2); c0++) {
					const t = r0 * w + c0;
					if (on(t) && on(t + 1) && on(t + w) && on(t + w + 1)) return false;
				}
			}
		}
		return this.connected(on, cells[0]);
	}

	/** Number of alternatives through `i` if it belonged to `region`. */
	alternativesThrough(i: number, region: number): number {
		let count = 0;
		for (const pl of this.placementsThrough(i, region)) {
			if (this.isAlternative(pl.cells, pl.type, region)) count++;
		}
		return count;
	}

	alternatives(region: number): { cells: number[]; type: number }[] {
		const out: { cells: number[]; type: number }[] = [];
		for (let i = 0; i < this.n; i++) {
			if (this.regions[i] !== region) continue;
			for (const pl of this.placementsThrough(i, region)) {
				// Each placement is found once per cell; keep it at its smallest cell only.
				if (Math.min(...pl.cells) === i && this.isAlternative(pl.cells, pl.type, region)) {
					out.push(pl);
				}
			}
		}
		return out;
	}

	private connected(on: (i: number) => boolean, start: number): boolean {
		let total = 0;
		for (let i = 0; i < this.n; i++) if (on(i)) total++;
		const seen = new Uint8Array(this.n);
		const stack = [start];
		seen[start] = 1;
		let found = 1;
		while (stack.length) {
			for (const j of this.nb[stack.pop()!]) {
				if (!seen[j] && on(j)) {
					seen[j] = 1;
					found++;
					stack.push(j);
				}
			}
		}
		return found === total;
	}

	/** Whether the region of cell `remove` stays connected without it. */
	staysConnected(remove: number): boolean {
		const reg = this.regions[remove];
		let start = -1;
		let total = 0;
		for (let i = 0; i < this.n; i++) {
			if (i !== remove && this.regions[i] === reg) {
				total++;
				start = i;
			}
		}
		if (start < 0) return false;
		const seen = new Uint8Array(this.n);
		const stack = [start];
		seen[start] = 1;
		let found = 1;
		while (stack.length) {
			for (const j of this.nb[stack.pop()!]) {
				if (j !== remove && !seen[j] && this.regions[j] === reg) {
					seen[j] = 1;
					found++;
					stack.push(j);
				}
			}
		}
		return found === total;
	}

	/** Replace the planted shading by another valid shading of the same regions. */
	replant(shading: ArrayLike<number>) {
		for (let i = 0; i < this.n; i++) this.solution[i] = shading[i];
		for (let r = 0; r < this.regionCount; r++) {
			const cells: number[] = [];
			for (let i = 0; i < this.n; i++) if (this.regions[i] === r && shading[i]) cells.push(i);
			this.types[r] = TET_TYPES.indexOf(classify(cells, this.w)!);
		}
	}
}

/**
 * Plant a solution: grow a connected set of tetrominoes without 2×2 blocks where touching
 * tetrominoes always differ in type, until no further tetromino fits.
 */
function plant(layout: Layout, rng: Rng): void {
	const { w, h, regions, solution, types } = layout;
	const shaded = (r: number, c: number) =>
		r >= 0 && c >= 0 && r < h && c < w && regions[r * w + c] >= 0;

	for (let first = true; ; first = false) {
		const options: { cells: number[]; type: number }[] = [];
		for (const shape of SHAPES) {
			const type = TET_TYPES.indexOf(shape.type);
			for (let r = 0; r < h; r++) {
				for (let c = 0; c < w; c++) {
					const cells: number[] = [];
					for (const [dr, dc] of shape.cells) {
						if (r + dr >= h || c + dc >= w || shaded(r + dr, c + dc)) break;
						cells.push((r + dr) * w + c + dc);
					}
					if (cells.length !== 4) continue;
					let ok = true;
					let touches = false;
					for (const i of cells) {
						for (const j of layout.nb[i]) {
							if (regions[j] < 0) continue;
							touches = true;
							if (types[regions[j]] === type) ok = false;
						}
					}
					if (!ok || (!first && !touches)) continue;
					const on = (rr: number, cc: number) => shaded(rr, cc) || cells.includes(rr * w + cc);
					for (const i of cells) {
						const ir = Math.floor(i / w);
						const ic = i % w;
						for (let r0 = ir - 1; r0 <= ir && ok; r0++) {
							for (let c0 = ic - 1; c0 <= ic && ok; c0++) {
								if (on(r0, c0) && on(r0, c0 + 1) && on(r0 + 1, c0) && on(r0 + 1, c0 + 1)) {
									ok = false;
								}
							}
						}
					}
					if (ok) options.push({ cells, type });
				}
			}
		}
		if (options.length === 0) break;
		const pick = rng.pick(options);
		for (const i of pick.cells) {
			regions[i] = types.length;
			solution[i] = 1;
		}
		types.push(pick.type);
	}
}

/**
 * Assign every unshaded cell to a neighbouring region by random flood fill, preferring the
 * neighbour where the cell opens the fewest alternative placements.
 */
function growRegions(layout: Layout, rng: Rng): void {
	const { regions } = layout;
	const frontier: number[] = [];
	const queued = new Uint8Array(layout.n);
	const enqueue = (i: number) => {
		for (const j of layout.nb[i]) {
			if (regions[j] < 0 && !queued[j]) {
				queued[j] = 1;
				frontier.push(j);
			}
		}
	};
	regions.forEach((r, i) => r >= 0 && enqueue(i));
	while (frontier.length) {
		const k = rng.int(frontier.length);
		const i = frontier[k];
		frontier[k] = frontier[frontier.length - 1];
		frontier.pop();
		let best = -1;
		let bestScore = Infinity;
		for (const j of layout.nb[i]) {
			const target = regions[j];
			if (target < 0) continue;
			const score = layout.alternativesThrough(i, target) + rng.next() * 0.5;
			if (score < bestScore) {
				bestScore = score;
				best = target;
			}
		}
		regions[i] = best;
		enqueue(i);
	}
}

const NODE_BUDGET = 1500;

/**
 * Reshape regions until the planted solution is the only one. Moving an unshaded cell to a
 * neighbouring region never invalidates the planted solution. Alternatives that change a single
 * region are cheap to detect and are removed first; the full solver then checks for combined
 * alternatives (unless `search` is false, which leaves them to makeLogical). When a region
 * cannot be fixed by moving cells, its planted tetromino is swapped for one of its alternatives,
 * which changes the pockets around it.
 */
function makeUnique(layout: Layout, rng: Rng, search = true): boolean {
	const { n, regions, solution } = layout;
	const alts = Array.from({ length: layout.regionCount }, (_, r) => layout.alternatives(r).length);
	const recount = () => alts.forEach((_, r) => (alts[r] = layout.alternatives(r).length));
	// Recently left (cell, region) pairs; moving straight back would just undo progress.
	const tabu: number[] = [];

	const bestMove = (cellsOf: (i: number) => boolean) => {
		let best: { cell: number; target: number; score: number } | null = null;
		for (let i = 0; i < n; i++) {
			if (solution[i] || !cellsOf(i) || !layout.staysConnected(i)) continue;
			const from = regions[i];
			const lost = layout.alternativesThrough(i, from);
			for (const j of layout.nb[i]) {
				const target = regions[j];
				if (target === from || tabu.includes(i * 4096 + target)) continue;
				const score = layout.alternativesThrough(i, target) - lost + rng.next() * 0.5;
				if (!best || score < best.score) best = { cell: i, target, score };
			}
		}
		return best;
	};
	const apply = (m: { cell: number; target: number }) => {
		const from = regions[m.cell];
		alts[from] -= layout.alternativesThrough(m.cell, from);
		alts[m.target] += layout.alternativesThrough(m.cell, m.target);
		regions[m.cell] = m.target;
		tabu.push(m.cell * 4096 + from);
		if (tabu.length > 12) tabu.shift();
	};
	const replant = (shading: ArrayLike<number>) => {
		layout.replant(shading);
		tabu.length = 0;
		recount();
	};

	for (let iter = 0; iter < 2 * n; iter++) {
		const badRegions = alts.flatMap((a, r) => (a > 0 ? [r] : []));
		if (badRegions.length > 0) {
			const bad = rng.pick(badRegions);
			const m = bestMove((i) => regions[i] === bad);
			// Mostly take improving moves; sometimes accept a worse one to escape dead ends.
			if (m && (m.score < 1 || rng.next() < 0.5)) {
				apply(m);
				continue;
			}
			const options = layout.alternatives(bad);
			if (options.length === 0) return false;
			const alt = rng.pick(options);
			const shading = solution.slice();
			regions.forEach((r, i) => r === bad && (shading[i] = 0));
			alt.cells.forEach((i) => (shading[i] = 1));
			replant(shading);
			continue;
		}
		if (!search) return true;
		const puzzle = { width: layout.w, height: layout.h, regions: Array.from(regions) };
		const res = new TetroidSolver(puzzle).solve({ limit: 2, maxNodes: NODE_BUDGET });
		if (!res.finished) return false;
		const other = res.solutions.find((s) => s.some((v, i) => v !== solution[i]));
		if (!other) return res.solutions.length === 1;
		// Move a cell the alternative shades; failing that, any unshaded cell of a region where
		// the two solutions differ, which may open up a move next time.
		const differs = new Set<number>();
		for (let i = 0; i < n; i++) if (other[i] !== solution[i]) differs.add(regions[i]);
		const m =
			bestMove((i) => other[i] === 1) ??
			(rng.next() < 0.7 ? bestMove((i) => differs.has(regions[i])) : null);
		if (!m) return false;
		apply(m);
	}
	return false;
}

/**
 * Reshape regions until propagation alone (with the look-ahead) solves the puzzle, which also
 * proves the solution unique. Where propagation gets stuck, a region has placements left besides
 * its planted tetromino; each of them covers an unshaded cell of the region, and moving such a
 * cell to a neighbouring region rules them out. Cells that most stuck placements share go first,
 * and moves that open a new alternative in the receiving region are avoided. When every such
 * cell holds its region together, another cell of a stuck region moves first, preferably one
 * next to them, which frees them for a later move.
 */
function makeLogical(layout: Layout, rng: Rng): boolean {
	const { n, regions, solution } = layout;
	// Recently left (cell, region) pairs, as in makeUnique.
	const tabu: number[] = [];
	const bestMove = (weight: (i: number) => number, useTabu: boolean) => {
		let best: { cell: number; target: number; score: number } | null = null;
		for (let i = 0; i < n; i++) {
			const w = weight(i);
			if (solution[i] || w < 0 || !layout.staysConnected(i)) continue;
			for (const j of layout.nb[i]) {
				const target = regions[j];
				if (target === regions[i] || (useTabu && tabu.includes(i * 4096 + target))) continue;
				const score = 4 * layout.alternativesThrough(i, target) - w + rng.next() * 0.5;
				if (!best || score < best.score) best = { cell: i, target, score };
			}
		}
		return best;
	};

	for (let iter = 0; iter < n; iter++) {
		const model = new TetroidModel({ width: layout.w, height: layout.h, regions: [...regions] });
		// Propagation never rules out the planted solution, so there is no contradiction.
		const dom = new TetroidSolver(model).propagated()!;
		// Per cell, the stuck placements (not the planted ones) that cover it.
		const open = new Int32Array(n);
		let stuck = false;
		model.placements.forEach((pl, k) => {
			if (!dom.alive[k] || dom.size[pl.region] === 1) return;
			stuck = true;
			for (const i of pl.cells) if (!solution[i]) open[i]++;
		});
		if (!stuck) return true;
		const stuckCell = (i: number) => (open[i] > 0 ? open[i] : -1);
		const nearStuck = (i: number) =>
			dom.size[regions[i]] > 1 ? layout.nb[i].filter((j) => open[j] > 0).length : -1;
		const m = bestMove(stuckCell, true) ?? bestMove(nearStuck, true) ?? bestMove(nearStuck, false);
		if (!m) return false;
		tabu.push(m.cell * 4096 + regions[m.cell]);
		if (tabu.length > 12) tabu.shift();
		regions[m.cell] = m.target;
	}
	return false;
}

/**
 * Attempts (each a new planted solution) at a puzzle of the requested difficulty. About three
 * normal attempts in five succeed on 6×6; of the unique hard attempts about one in four succeeds
 * on 6×6 and one in two on 10×10.
 */
const ATTEMPTS = 100;

/**
 * Generate a puzzle with a unique solution. Deterministic for a given seed: budgets are counted
 * in search nodes and iterations, never in time.
 *
 * Normal puzzles can be solved by deduction alone (propagation with the connectivity look-ahead,
 * no guessing); regions are reshaped until they are. Hard puzzles cannot be solved that way.
 */
export function generateTetroid(
	width: number,
	height: number,
	difficulty: Difficulty,
	seed: number
): GeneratedTetroid {
	const rng = new Rng(seed);
	let fallback: GeneratedTetroid | null = null;
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const layout = new Layout(width, height);
		plant(layout, rng);
		growRegions(layout, rng);
		const result = (): GeneratedTetroid => ({
			puzzle: { width, height, regions: Array.from(layout.regions) },
			solution: Array.from(layout.solution)
		});
		if (difficulty === 'normal') {
			// makeLogical finishes whatever makeUnique leaves (the planted solution stays valid
			// even when it gives up). A normal puzzle never falls back to one that needs guessing.
			makeUnique(layout, rng, false);
			if (makeLogical(layout, rng)) return result();
			continue;
		}
		if (!makeUnique(layout, rng)) continue;
		const { puzzle } = result();
		if (new TetroidSolver(puzzle).solve({ branch: false }).solutions.length === 0) return result();
		fallback ??= result();
	}
	if (fallback) return fallback;
	throw new Error('generation failed');
}
