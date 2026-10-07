import { neighbours } from '../../core/grid';
import { SHAPES, TET_TYPES } from './shapes';
import { cellsByRegion, isSolvedMarks, type TetroidPuzzle } from './rules';

interface Placement {
	region: number;
	type: number;
	cells: number[];
}

export interface SolveOptions {
	/** Stop after this many solutions (2 is enough to prove uniqueness). */
	limit?: number;
	/** Give up after this many search nodes; the result is then unfinished. */
	maxNodes?: number;
	/** Use the per-placement connectivity look-ahead. */
	advanced?: boolean;
	/** Allow guessing. Without it the solver only propagates. */
	branch?: boolean;
}

export interface SolveResult {
	/** Solutions found, each as a 0/1 shading per cell. */
	solutions: Uint8Array[];
	/** False when the node budget ran out before the search finished. */
	finished: boolean;
	/** True when propagation alone did not decide the puzzle. */
	branched: boolean;
	nodes: number;
}

/** Precomputed placement data for one puzzle; reusable across solver runs. */
export class TetroidModel {
	readonly placements: Placement[] = [];
	readonly byRegion: number[][];
	/** Conflicting placements (same type touching, or a 2×2 together) in other regions. */
	readonly conflicts: Int32Array[];
	readonly regionNeighbours: number[][];
	readonly nb: Int32Array[];
	/** Top-left cells of the 2×2 squares containing each cell. */
	readonly squares: Int32Array[];
	readonly n: number;

	constructor(readonly p: TetroidPuzzle) {
		const { width: w, height: h, regions } = p;
		this.n = w * h;
		this.nb = Array.from({ length: this.n }, (_, i) => Int32Array.from(neighbours(i, w, h)));
		this.squares = Array.from({ length: this.n }, (_, i) => {
			const r = Math.floor(i / w);
			const c = i % w;
			const out: number[] = [];
			for (let r0 = Math.max(0, r - 1); r0 <= Math.min(r, h - 2); r0++) {
				for (let c0 = Math.max(0, c - 1); c0 <= Math.min(c, w - 2); c0++) out.push(r0 * w + c0);
			}
			return Int32Array.from(out);
		});
		const regionCells = cellsByRegion(p);
		this.byRegion = regionCells.map(() => []);
		for (const shape of SHAPES) {
			const sh = Math.max(...shape.cells.map((c) => c[0])) + 1;
			const sw = Math.max(...shape.cells.map((c) => c[1])) + 1;
			for (let r = 0; r + sh <= h; r++) {
				for (let c = 0; c + sw <= w; c++) {
					const cells = shape.cells.map(([dr, dc]) => (r + dr) * w + c + dc);
					const region = regions[cells[0]];
					if (cells.every((i) => regions[i] === region)) {
						this.byRegion[region].push(this.placements.length);
						this.placements.push({ region, type: TET_TYPES.indexOf(shape.type), cells });
					}
				}
			}
		}

		const adj = regionCells.map(() => new Set<number>());
		for (let i = 0; i < this.n; i++) {
			for (const j of this.nb[i]) if (regions[j] !== regions[i]) adj[regions[i]].add(regions[j]);
		}
		this.regionNeighbours = adj.map((s) => [...s]);

		const byCell: number[][] = regions.map(() => []);
		this.placements.forEach((pl, k) => pl.cells.forEach((i) => byCell[i].push(k)));

		this.conflicts = this.placements.map((pl) => {
			const own = new Set(pl.cells);
			const out = new Set<number>();
			for (const i of pl.cells) {
				for (const j of this.nb[i]) {
					if (regions[j] === pl.region) continue;
					for (const q of byCell[j]) if (this.placements[q].type === pl.type) out.add(q);
				}
				// 2×2 squares completed by this placement together with one other placement.
				for (const t of this.squares[i]) {
					const rest = [t, t + 1, t + w, t + w + 1].filter((x) => !own.has(x));
					if (rest.length === 0) continue;
					const reg = regions[rest[0]];
					if (reg === pl.region || rest.some((x) => regions[x] !== reg)) continue;
					for (const q of byCell[rest[0]]) {
						const qc = this.placements[q].cells;
						if (rest.every((x) => qc.includes(x))) out.add(q);
					}
				}
			}
			return Int32Array.from(out);
		});
	}
}

interface Domain {
	alive: Uint8Array;
	size: Int32Array;
}

export class TetroidSolver {
	private readonly m: TetroidModel;
	private readonly n: number;
	private nodes = 0;
	private solutions: Uint8Array[] = [];
	private limit = 2;
	private maxNodes = Infinity;
	private advanced = true;
	private branched = false;
	private aborted = false;
	// Scratch buffers.
	private readonly cnt: Int32Array;
	private readonly size0: Int32Array;
	private readonly hits: Int32Array;
	private readonly comp: Int32Array;
	private readonly comp2: Int32Array;
	private readonly stack: Int32Array;

	constructor(puzzle: TetroidPuzzle | TetroidModel) {
		this.m = puzzle instanceof TetroidModel ? puzzle : new TetroidModel(puzzle);
		this.n = this.m.n;
		const regions = this.m.byRegion.length;
		this.cnt = new Int32Array(this.n);
		this.size0 = new Int32Array(regions);
		this.hits = new Int32Array(regions);
		this.comp = new Int32Array(this.n);
		this.comp2 = new Int32Array(this.n);
		this.stack = new Int32Array(this.n);
	}

	solve(opts: SolveOptions = {}): SolveResult {
		this.limit = opts.limit ?? 2;
		this.maxNodes = opts.maxNodes ?? Infinity;
		this.advanced = opts.advanced ?? true;
		this.nodes = 0;
		this.solutions = [];
		this.branched = false;
		this.aborted = false;

		const { placements, byRegion } = this.m;
		const dom: Domain = {
			alive: new Uint8Array(placements.length).fill(1),
			size: Int32Array.from(byRegion.map((l) => l.length))
		};
		if (dom.size.some((s) => s === 0)) {
			return { solutions: [], finished: true, branched: false, nodes: 0 };
		}
		if (opts.branch === false) {
			if (this.propagate(dom) && dom.size.every((s) => s === 1)) this.leaf(dom);
			else this.branched = true;
			return { solutions: this.solutions, finished: true, branched: this.branched, nodes: 1 };
		}
		this.search(dom);
		return {
			solutions: this.solutions,
			finished: !this.aborted,
			branched: this.branched,
			nodes: this.nodes
		};
	}

	private search(dom: Domain, depth = 0): void {
		if (this.aborted || this.solutions.length >= this.limit) return;
		if (++this.nodes > this.maxNodes) {
			this.aborted = true;
			return;
		}
		if (!this.propagate(dom, depth)) return;
		let best = -1;
		for (let r = 0; r < dom.size.length; r++) {
			if (dom.size[r] > 1 && (best < 0 || dom.size[r] < dom.size[best])) best = r;
		}
		if (best < 0) {
			this.leaf(dom);
			return;
		}
		this.branched = true;
		for (const k of this.m.byRegion[best]) {
			if (!dom.alive[k]) continue;
			const next: Domain = { alive: dom.alive.slice(), size: dom.size.slice() };
			for (const q of this.m.byRegion[best]) if (q !== k) next.alive[q] = 0;
			next.size[best] = 1;
			this.search(next, depth + 1);
			if (this.aborted || this.solutions.length >= this.limit) return;
		}
	}

	private leaf(dom: Domain): void {
		const shade = new Uint8Array(this.n);
		this.m.placements.forEach((pl, k) => {
			if (dom.alive[k]) for (const i of pl.cells) shade[i] = 1;
		});
		if (isSolvedMarks(this.m.p, (i) => shade[i] === 1)) this.solutions.push(shade);
	}

	/** Recompute cover counts (alive placements of the cell's region that include it). */
	private cover(dom: Domain): void {
		const { cnt, size0 } = this;
		cnt.fill(0);
		const { placements } = this.m;
		for (let k = 0; k < placements.length; k++) {
			if (dom.alive[k]) for (const i of placements[k].cells) cnt[i]++;
		}
		size0.set(dom.size);
	}

	private must(i: number): boolean {
		return this.cnt[i] > 0 && this.cnt[i] === this.size0[this.m.p.regions[i]];
	}

	/** Reduce domains until a fixpoint. Returns false on contradiction. */
	private propagate(dom: Domain, depth = 0): boolean {
		const { placements, conflicts, byRegion, regionNeighbours } = this.m;
		const regionCount = byRegion.length;
		const dirty = new Uint8Array(regionCount).fill(1);
		// The look-ahead is expensive: below the root it runs once per node.
		let lookAheads = depth === 0 ? Infinity : 1;
		const kill = (k: number): boolean => {
			dom.alive[k] = 0;
			const r = placements[k].region;
			for (const nr of regionNeighbours[r]) dirty[nr] = 1;
			dirty[r] = 1;
			return --dom.size[r] > 0;
		};

		for (;;) {
			// Arc consistency against neighbouring regions, plus 2×2 squares with certain cells.
			this.cover(dom);
			let any = false;
			const check = dirty.slice();
			dirty.fill(0);
			for (let r = 0; r < regionCount; r++) {
				if (!check[r]) continue;
				for (const k of byRegion[r]) {
					if (!dom.alive[k]) continue;
					if (!this.supported(dom, conflicts[k]) || this.makesSquare(placements[k].cells)) {
						if (!kill(k)) return false;
						any = true;
					}
				}
			}
			if (any) continue;

			// Connectivity: all certain cells must lie in one component of possible cells.
			const main = this.mainComponent(this.comp, -1, null);
			if (main === -2) return false;
			if (main >= 0) {
				for (let k = 0; k < placements.length; k++) {
					if (dom.alive[k] && placements[k].cells.some((i) => this.comp[i] !== main)) {
						if (!kill(k)) return false;
						any = true;
					}
				}
			}
			if (any) continue;
			if (!this.advanced || lookAheads-- <= 0) return true;

			// Look-ahead: choosing a placement must leave everything connectable.
			for (let k = 0; k < placements.length; k++) {
				const pl = placements[k];
				if (!dom.alive[k] || dom.size[pl.region] === 1) continue;
				if (!this.lookAhead(pl)) {
					if (!kill(k)) return false;
					any = true;
				}
			}
			if (!any) return true;
		}
	}

	private supported(dom: Domain, conflicts: Int32Array): boolean {
		const { hits } = this;
		const { placements } = this.m;
		let ok = true;
		const touched: number[] = [];
		for (const q of conflicts) {
			if (!dom.alive[q]) continue;
			const reg = placements[q].region;
			if (hits[reg] === 0) touched.push(reg);
			if (++hits[reg] === dom.size[reg]) {
				ok = false;
				break;
			}
		}
		for (const r of touched) hits[r] = 0;
		return ok;
	}

	private makesSquare(cells: number[]): boolean {
		const w = this.m.p.width;
		const on = (i: number) => cells.includes(i) || this.must(i);
		for (const i of cells) {
			for (const t of this.m.squares[i]) {
				if (on(t) && on(t + 1) && on(t + w) && on(t + w + 1)) return true;
			}
		}
		return false;
	}

	/**
	 * Label components of possible cells into `comp`. With `region`/`own`, cells of that region
	 * count only if in `own`. Returns the component of all certain cells, -1 if there are none,
	 * or -2 if certain cells are split.
	 */
	private mainComponent(comp: Int32Array, region: number, own: number[] | null): number {
		const { cnt, stack } = this;
		const regions = this.m.p.regions;
		const possible = (i: number) => (regions[i] === region ? own!.includes(i) : cnt[i] > 0);
		comp.fill(-1);
		let id = 0;
		for (let s = 0; s < this.n; s++) {
			if (comp[s] >= 0 || !possible(s)) continue;
			comp[s] = id;
			let top = 0;
			stack[top++] = s;
			while (top) {
				const i = stack[--top];
				for (const j of this.m.nb[i]) {
					if (comp[j] < 0 && possible(j)) {
						comp[j] = id;
						stack[top++] = j;
					}
				}
			}
			id++;
		}
		let main = -1;
		for (let i = 0; i < this.n; i++) {
			if (regions[i] === region ? !own!.includes(i) : !this.must(i)) continue;
			if (main < 0) main = comp[i];
			else if (comp[i] !== main) return -2;
		}
		return main;
	}

	/** Choosing `pl` must leave all certain cells in one component of possible cells. */
	private lookAhead(pl: Placement): boolean {
		return this.mainComponent(this.comp2, pl.region, pl.cells) !== -2;
	}
}

export function solveTetroid(p: TetroidPuzzle, opts?: SolveOptions): SolveResult {
	return new TetroidSolver(p).solve(opts);
}
