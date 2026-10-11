import { clueAt, CROSS, LINE, loopGraph, OPEN, type LoopGraph, type LoopPuzzle } from './rules';

/**
 * Techniques of the rating solver, weakest first.
 *
 * - `Basic`: a clue's count, two lines or none at every dot, no loop before the end, and what a
 *   cell's corners pass on through their dot (a 3 in the corner of the grid, two 3s on a
 *   diagonal, a line running into the corner of a 1).
 * - `Advanced`: also inside and outside. Every cell lies inside or outside the loop, a line
 *   separates the two, a cross joins them, and the border of the grid is outside.
 */
export const LoopLevel = { Basic: 0, Advanced: 1 } as const;
export type LoopLevel = (typeof LoopLevel)[keyof typeof LoopLevel];

export interface LoopRating {
	/** Whether the techniques up to the level asked for decide every edge. */
	solved: boolean;
	/** The strongest technique it needed (or tried, when it did not solve the puzzle). */
	level: LoopLevel;
	/** Edges that only inside and outside decided, before the basic rules took over again. */
	advancedSteps: number;
	/** The edges as far as the techniques got (OPEN, LINE or CROSS), in the graph's numbering. */
	edges: Uint8Array;
	/** Whether the techniques found that the puzzle (with the edges it started from) has no solution. */
	contradiction: boolean;
	/** Where they found it: a cell or dot whose rule breaks, a loop, or inside and outside. */
	brokenAt?: LoopFailure;
}

export type LoopFailure = { kind: 'cell' | 'dot'; at: number } | { kind: 'loop' | 'sides' };

export interface LoopSolveOptions {
	limit?: number;
	maxNodes?: number;
	/** Allow guessing. Without it the solver only applies the basic rules. */
	branch?: boolean;
}

export interface LoopSolveResult {
	/** Solutions as edge values in the graph's numbering (LINE or CROSS). */
	solutions: Uint8Array[];
	finished: boolean;
	branched: boolean;
	nodes: number;
}

/** Corner flags: at least one, or at most one, of the corner's two edges is a line. */
const AT_LEAST = 1;
const AT_MOST = 2;

/** Lines in a mask of up to four edges. */
const POP = Uint8Array.from(
	{ length: 16 },
	(_, m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + (m >> 3)
);
/**
 * A cell's edges as mask bits: top 1, bottom 2, left 4, right 8 (the order of `cellEdges`).
 * Its corners top left, top right, bottom left, bottom right as pairs of those.
 */
const CELL_CORNER = [1 | 4, 1 | 8, 2 | 4, 2 | 8];
/**
 * A dot's edges as mask bits: up 1, right 2, down 4, left 8. The corners at a dot, in the order
 * of the cells up left, up right, down left, down right, as pairs of those.
 */
const DOT_CORNER = [1 | 8, 1 | 2, 4 | 8, 4 | 2];

/** The grid as the deductions use it, shared by every puzzle of a size. */
export interface LoopLayout {
	g: LoopGraph;
	n: number;
	/** The cell on either side of each edge, `n` for outside the grid. */
	edgeSide: Int32Array;
	/** The cells next to each cell above, below, left and right of it, `n` for outside. */
	cellSide: Int32Array;
	/** The dot at each corner `4 * cell + k`, k in the order of `CELL_CORNER`. */
	cornerDot: Int32Array;
	/** The edges at each dot up, right, down and left, -1 for none. */
	dotEdge: Int32Array;
	/** The cells around each dot up left, up right, down left and down right, `n` for outside. */
	dotCell: Int32Array;
	/** The corners at each dot in the order of `DOT_CORNER`, -1 outside the grid. */
	dotCorner: Int32Array;
	/** Per dot, the edge masks a dot may end with: two of its edges, or none. */
	dotMasks: number[][];
}

const layouts = new Map<string, LoopLayout>();

export function loopLayout(w: number, h: number): LoopLayout {
	const key = `${w}x${h}`;
	const known = layouts.get(key);
	if (known) return known;
	const g = loopGraph(w, h);
	const n = w * h;
	const hCount = (h + 1) * w;
	const cell = (r: number, c: number) => (r >= 0 && c >= 0 && r < h && c < w ? r * w + c : n);
	const dot = (i: number, j: number) => i * (w + 1) + j;
	const edgeSide = new Int32Array(2 * g.edges);
	for (let i = 0; i <= h; i++) {
		for (let j = 0; j < w; j++) edgeSide.set([cell(i - 1, j), cell(i, j)], 2 * (i * w + j));
	}
	for (let i = 0; i < h; i++) {
		for (let j = 0; j <= w; j++) {
			edgeSide.set([cell(i, j - 1), cell(i, j)], 2 * (hCount + i * (w + 1) + j));
		}
	}
	const cellSide = new Int32Array(4 * n);
	const cornerDot = new Int32Array(4 * n);
	for (let r = 0; r < h; r++) {
		for (let c = 0; c < w; c++) {
			const k = 4 * (r * w + c);
			cellSide.set([cell(r - 1, c), cell(r + 1, c), cell(r, c - 1), cell(r, c + 1)], k);
			cornerDot.set([dot(r, c), dot(r, c + 1), dot(r + 1, c), dot(r + 1, c + 1)], k);
		}
	}
	const dotEdge = new Int32Array(4 * g.dots).fill(-1);
	const dotCell = new Int32Array(4 * g.dots);
	const dotCorner = new Int32Array(4 * g.dots).fill(-1);
	const dotMasks: number[][] = [];
	for (let i = 0; i <= h; i++) {
		for (let j = 0; j <= w; j++) {
			const d = dot(i, j);
			if (i > 0) dotEdge[4 * d] = hCount + (i - 1) * (w + 1) + j;
			if (j < w) dotEdge[4 * d + 1] = i * w + j;
			if (i < h) dotEdge[4 * d + 2] = hCount + i * (w + 1) + j;
			if (j > 0) dotEdge[4 * d + 3] = i * w + j - 1;
			const around = [cell(i - 1, j - 1), cell(i - 1, j), cell(i, j - 1), cell(i, j)];
			dotCell.set(around, 4 * d);
			// The dot is the bottom right corner of the cell up left of it, and so on.
			around.forEach((c, k) => c < n && (dotCorner[4 * d + k] = 4 * c + 3 - k));
			let exists = 0;
			for (let k = 0; k < 4; k++) if (dotEdge[4 * d + k] >= 0) exists |= 1 << k;
			dotMasks.push(
				Array.from({ length: 16 }, (_, m) => m).filter(
					(m) => (m & ~exists) === 0 && (POP[m] === 0 || POP[m] === 2)
				)
			);
		}
	}
	const layout = { g, n, edgeSide, cellSide, cornerDot, dotEdge, dotCell, dotCorner, dotMasks };
	layouts.set(key, layout);
	return layout;
}

/**
 * Decides every edge as line or cross, the way a person would, and finds all solutions by search
 * where that is not enough.
 *
 * The basic rules work on the edges and on a flag per cell corner (at least one line, at most
 * one line among the corner's two edges):
 *
 * - a cell keeps the ways to draw its four edges that fit its clue and its corners' flags; edges
 *   that all of them agree on are decided, and so are the flags that all of them agree on;
 * - a dot does the same with its two-lines-or-none rule and the flags of the corners at it, which
 *   is how a corner passes on what it knows to the cell diagonally across the dot;
 * - an edge that would close a loop is crossed, unless that loop is the whole solution.
 *
 * Inside and outside (`LoopLevel.Advanced`) colour the cells: a line between two cells means they
 * differ, a cross that they match. Cells whose colours are known relative to each other decide
 * the edge between them; a clue and a dot rule out colourings that break them, which links cells
 * that may be far apart once the links chain up.
 *
 * Search branches on an open edge, preferably one that continues a line.
 */
export class LoopSolver {
	private readonly l: LoopLayout;
	private readonly g: LoopGraph;
	private readonly n: number;
	private readonly clue: Int8Array;
	private v: Uint8Array;
	private f: Uint8Array;
	private nodes = 0;
	private limit = 2;
	private maxNodes = Infinity;
	private aborted = false;
	private branched = false;
	private solutions: Uint8Array[] = [];
	/** Cells and dots (numbered after the cells) whose rule needs another look: a ring buffer. */
	private readonly queue: Int32Array;
	private readonly queued: Uint8Array;
	private head = 0;
	private tail = 0;
	private size = 0;
	/** Inside and outside: a parent and the colour difference to it per cell, outside last. */
	private colouring = false;
	private broken = false;
	private failure: LoopFailure | undefined;
	private readonly parent: Int32Array;
	private readonly parity: Uint8Array;
	/** The colour difference to its root of the last cell `find` looked up. */
	private found = 0;
	private linked = false;

	constructor(p: LoopPuzzle) {
		this.l = loopLayout(p.width, p.height);
		this.g = this.l.g;
		this.n = this.l.n;
		this.clue = Int8Array.from({ length: this.n }, (_, c) => clueAt(p, c));
		this.v = new Uint8Array(this.g.edges);
		this.f = new Uint8Array(4 * this.n);
		this.queue = new Int32Array(this.n + this.g.dots);
		this.queued = new Uint8Array(this.n + this.g.dots);
		this.parent = new Int32Array(this.n + 1);
		this.parity = new Uint8Array(this.n + 1);
	}

	/**
	 * Applies the techniques up to `maxLevel`, the weakest ones first, without guessing. `from`
	 * gives edges that are already decided (in the graph's numbering).
	 */
	rate(maxLevel: LoopLevel = LoopLevel.Advanced, from?: ArrayLike<number>): LoopRating {
		this.v = from ? Uint8Array.from(from) : new Uint8Array(this.g.edges);
		this.f = new Uint8Array(4 * this.n);
		this.colouring = false;
		let level: LoopLevel = LoopLevel.Basic;
		let advancedSteps = 0;
		this.failure = undefined;
		const result = (solved: boolean, contradiction = false): LoopRating => ({
			solved,
			level,
			advancedSteps,
			edges: this.v,
			contradiction,
			...(contradiction && { brokenAt: this.failure ?? { kind: 'sides' } })
		});
		const broken = () => result(false, true);
		if (!this.propagate()) return broken();
		while (maxLevel >= LoopLevel.Advanced && this.v.includes(OPEN)) {
			level = LoopLevel.Advanced;
			if (!this.colouring && !this.startColouring()) return broken();
			const before = this.v.reduce((k, x) => k + (x === OPEN ? 1 : 0), 0);
			const changed = this.colourRules();
			if (changed === null) return broken();
			if (!changed) break;
			advancedSteps += before - this.v.reduce((k, x) => k + (x === OPEN ? 1 : 0), 0);
			if (!this.propagate()) return broken();
		}
		if (this.v.includes(OPEN)) return result(false);
		if (this.isLoop(this.v)) return result(true);
		this.failure = { kind: 'loop' };
		return broken();
	}

	solve(opts: LoopSolveOptions = {}): LoopSolveResult {
		this.limit = opts.limit ?? 2;
		this.maxNodes = opts.maxNodes ?? Infinity;
		this.nodes = 0;
		this.aborted = false;
		this.branched = false;
		this.solutions = [];
		this.colouring = false;
		this.search(new Uint8Array(this.g.edges), new Uint8Array(4 * this.n), opts.branch ?? true);
		return {
			solutions: this.solutions,
			finished: !this.aborted,
			branched: this.branched,
			nodes: this.nodes
		};
	}

	private search(v: Uint8Array, f: Uint8Array, branch: boolean) {
		if (++this.nodes > this.maxNodes) {
			this.aborted = true;
			return;
		}
		this.v = v;
		this.f = f;
		if (!this.propagate()) return;
		const e = this.pickEdge(v);
		if (e < 0) {
			if (this.isLoop(v)) this.solutions.push(v);
			return;
		}
		if (!branch) return;
		this.branched = true;
		for (const value of [LINE, CROSS]) {
			const next = v.slice();
			next[e] = value;
			this.search(next, f.slice(), branch);
			if (this.solutions.length >= this.limit || this.aborted) return;
		}
	}

	/** An open edge to branch on, or -1 when all are decided. */
	private pickEdge(v: Uint8Array): number {
		const { dotEdges } = this.g;
		let any = -1;
		for (let d = 0; d < this.g.dots; d++) {
			let lines = 0;
			let open = -1;
			for (let k = 4 * d; k < 4 * d + 4; k++) {
				const e = dotEdges[k];
				if (e < 0) continue;
				if (v[e] === LINE) lines++;
				else if (v[e] === OPEN) open = e;
			}
			if (open >= 0 && lines === 1) return open;
			if (open >= 0 && any < 0) any = open;
		}
		return any;
	}

	private push(item: number) {
		if (this.queued[item]) return;
		this.queued[item] = 1;
		this.queue[this.head++ % this.queue.length] = item;
		this.size++;
	}

	/** Decides an open edge and queues the rules around it. */
	private set(e: number, value: number) {
		this.v[e] = value;
		const { edgeSide } = this.l;
		for (const c of [edgeSide[2 * e], edgeSide[2 * e + 1]]) if (c < this.n) this.push(c);
		this.push(this.n + this.g.ends[2 * e]);
		this.push(this.n + this.g.ends[2 * e + 1]);
		if (
			this.colouring &&
			!this.union(edgeSide[2 * e], edgeSide[2 * e + 1], value === LINE ? 1 : 0)
		) {
			this.broken = true;
		}
	}

	/** Adds flags to a corner whose two edges are both open, and queues its cell and dot. */
	private flag(corner: number, bits: number) {
		if ((this.f[corner] | bits) === this.f[corner]) return;
		this.f[corner] |= bits;
		this.push(corner >> 2);
		this.push(this.n + this.l.cornerDot[corner]);
	}

	/** Applies the basic rules until nothing changes; false on a contradiction. */
	private propagate(): boolean {
		this.head = this.tail = this.size = 0;
		this.queued.fill(0);
		for (let item = 0; item < this.n + this.g.dots; item++) this.push(item);
		for (;;) {
			while (this.size > 0) {
				const item = this.queue[this.tail++ % this.queue.length];
				this.size--;
				this.queued[item] = 0;
				const ok = item < this.n ? this.cellRule(item) : this.dotRule(item - this.n);
				if (!ok) {
					this.failure =
						item < this.n ? { kind: 'cell', at: item } : { kind: 'dot', at: item - this.n };
				}
				if (!ok || this.broken) return (this.broken = false);
			}
			const changed = this.loopRule();
			if (this.broken) return (this.broken = false);
			if (changed === null) {
				this.failure = { kind: 'loop' };
				return false;
			}
			if (!changed) return true;
		}
	}

	/** Whether the cell may have the lines in mask `m` (bits in `cellEdges` order). */
	private cellFits(c: number, m: number): boolean {
		if (this.clue[c] >= 0 && POP[m] !== this.clue[c]) return false;
		for (let k = 0; k < 4; k++) {
			const flags = this.f[4 * c + k];
			if (!flags) continue;
			const lines = POP[m & CELL_CORNER[k]];
			if ((flags & AT_LEAST && lines < 1) || (flags & AT_MOST && lines > 1)) return false;
		}
		return true;
	}

	/** Whether the dot may have the lines in mask `m` (bits up, right, down, left). */
	private dotFits(d: number, m: number): boolean {
		for (let k = 0; k < 4; k++) {
			const corner = this.l.dotCorner[4 * d + k];
			const flags = corner < 0 ? 0 : this.f[corner];
			if (!flags) continue;
			const lines = POP[m & DOT_CORNER[k]];
			if ((flags & AT_LEAST && lines < 1) || (flags & AT_MOST && lines > 1)) return false;
		}
		return true;
	}

	/**
	 * Keeps the ways to draw these four edges that fit the known ones and `fits`, then decides
	 * the edges and the flags of the corners (pairs of the edges) that all of them agree on.
	 */
	private local(
		edges: Int32Array,
		at: number,
		candidates: ArrayLike<number>,
		corners: number[],
		cornerOf: (k: number) => number,
		fits: (m: number) => boolean
	): boolean {
		let line = 0;
		let cross = 0;
		for (let k = 0; k < 4; k++) {
			const e = edges[at + k];
			if (e < 0) continue;
			if (this.v[e] === LINE) line |= 1 << k;
			else if (this.v[e] === CROSS) cross |= 1 << k;
		}
		let all = 15;
		let any = 0;
		let least = 0;
		let most = 0;
		let found = false;
		for (let i = 0; i < candidates.length; i++) {
			const m = candidates[i];
			if ((m & line) !== line || m & cross || !fits(m)) continue;
			found = true;
			all &= m;
			any |= m;
			for (let k = 0; k < 4; k++) {
				const lines = POP[m & corners[k]];
				if (lines < 1) least |= 1 << k;
				if (lines > 1) most |= 1 << k;
			}
		}
		if (!found) return false;
		for (let k = 0; k < 4; k++) {
			const e = edges[at + k];
			if (e < 0 || this.v[e] !== OPEN) continue;
			if (all & (1 << k)) this.set(e, LINE);
			else if (!(any & (1 << k))) this.set(e, CROSS);
		}
		for (let k = 0; k < 4; k++) {
			const corner = cornerOf(k);
			if (corner < 0) continue;
			const pair = corners[k];
			const open = pair & ~line & ~cross & ~(all | (15 & ~any));
			if (POP[open] !== 2) continue;
			const bits = (least & (1 << k) ? 0 : AT_LEAST) | (most & (1 << k) ? 0 : AT_MOST);
			if (bits) this.flag(corner, bits);
		}
		return true;
	}

	private cellRule(c: number): boolean {
		if (
			this.clue[c] < 0 &&
			!(this.f[4 * c] | this.f[4 * c + 1] | this.f[4 * c + 2] | this.f[4 * c + 3])
		) {
			return true;
		}
		return this.local(
			this.g.cellEdges,
			4 * c,
			ALL_MASKS,
			CELL_CORNER,
			(k) => 4 * c + k,
			(m) => this.cellFits(c, m)
		);
	}

	private dotRule(d: number): boolean {
		return this.local(
			this.l.dotEdge,
			4 * d,
			this.l.dotMasks[d],
			DOT_CORNER,
			(k) => this.l.dotCorner[4 * d + k],
			(m) => this.dotFits(d, m)
		);
	}

	/**
	 * Crosses every open edge that would close a loop too early. Returns whether it changed
	 * something, or null when a loop is already closed beside other lines.
	 */
	private loopRule(): boolean | null {
		const { ends, edges } = this.g;
		const v = this.v;
		const parent = new Int32Array(this.g.dots);
		for (let d = 0; d < parent.length; d++) parent[d] = d;
		const find = (x: number): number => {
			while (parent[x] !== x) x = parent[x] = parent[parent[x]];
			return x;
		};
		const pieceLines = new Int32Array(this.g.dots);
		let lines = 0;
		let cycle = -1;
		for (let e = 0; e < edges; e++) {
			if (v[e] !== LINE) continue;
			lines++;
			const a = find(ends[2 * e]);
			const b = find(ends[2 * e + 1]);
			if (a === b) {
				cycle = a;
				pieceLines[a]++;
			} else {
				parent[a] = b;
				pieceLines[b] += pieceLines[a] + 1;
			}
		}
		if (cycle >= 0) {
			// A closed loop is the whole solution: no other line, and no further one.
			if (pieceLines[find(cycle)] !== lines) return null;
			let changed = false;
			for (let e = 0; e < edges; e++) {
				if (v[e] === OPEN) {
					this.set(e, CROSS);
					changed = true;
				}
			}
			return changed;
		}
		let changed = false;
		for (let e = 0; e < edges; e++) {
			if (v[e] !== OPEN) continue;
			const root = find(ends[2 * e]);
			if (pieceLines[root] === 0 || root !== find(ends[2 * e + 1])) continue;
			// Both ends of one path: the edge closes it. Only the whole solution may close.
			if (pieceLines[root] === lines && this.closesSolution(e)) continue;
			this.set(e, CROSS);
			changed = true;
		}
		return changed;
	}

	/** Whether drawing `e` satisfies every clue (the lines then form one loop). */
	private closesSolution(e: number): boolean {
		const edges = this.g.cellEdges;
		for (let c = 0; c < this.n; c++) {
			if (this.clue[c] < 0) continue;
			let lines = 0;
			for (let k = 4 * c; k < 4 * c + 4; k++) {
				if (this.v[edges[k]] === LINE || edges[k] === e) lines++;
			}
			if (lines !== this.clue[c]) return false;
		}
		return true;
	}

	/** The root of a cell's colour class; `found` gets the cell's colour difference to it. */
	private find(x: number): number {
		let diff = 0;
		let root = x;
		while (this.parent[root] !== root) {
			diff ^= this.parity[root];
			root = this.parent[root];
		}
		// Point the path straight at the root, keeping each cell's difference.
		let d = diff;
		while (this.parent[x] !== root && x !== root) {
			const next = this.parent[x];
			const step = this.parity[x];
			this.parent[x] = root;
			this.parity[x] = d;
			d ^= step;
			x = next;
		}
		this.found = diff;
		return root;
	}

	/** Records that cells `a` and `b` differ in colour by `diff`; false if they cannot. */
	private union(a: number, b: number, diff: number): boolean {
		const ra = this.find(a);
		const da = this.found;
		const rb = this.find(b);
		const db = this.found;
		if (ra === rb) return (da ^ db) === diff;
		this.parent[ra] = rb;
		this.parity[ra] = da ^ db ^ diff;
		this.linked = true;
		return true;
	}

	/** Starts inside and outside from the edges decided so far. */
	private startColouring(): boolean {
		for (let x = 0; x <= this.n; x++) this.parent[x] = x;
		this.parity.fill(0);
		this.colouring = true;
		const { edgeSide } = this.l;
		for (let e = 0; e < this.g.edges; e++) {
			if (this.v[e] === OPEN) continue;
			if (!this.union(edgeSide[2 * e], edgeSide[2 * e + 1], this.v[e] === LINE ? 1 : 0))
				return false;
		}
		return true;
	}

	/**
	 * One round of inside and outside: links cells through clues and dots, then decides the
	 * edges between cells whose colours are known relative to each other. Returns whether it
	 * changed something, or null on a contradiction.
	 */
	private colourRules(): boolean | null {
		this.linked = false;
		const { cellSide, dotCell } = this.l;
		const items = new Int32Array(5);
		for (let c = 0; c < this.n; c++) {
			if (
				this.clue[c] < 0 &&
				!(this.f[4 * c] | this.f[4 * c + 1] | this.f[4 * c + 2] | this.f[4 * c + 3])
			) {
				continue;
			}
			items[0] = c;
			items.set(cellSide.subarray(4 * c, 4 * c + 4), 1);
			// Edge k of the cell is a line where its neighbour k differs from it.
			const ok = this.colourCases(items, 5, (bits) => {
				const m = ((bits >> 1) ^ (bits & 1 ? 15 : 0)) & 15;
				return this.cellFits(c, m);
			});
			if (!ok) return null;
		}
		for (let d = 0; d < this.g.dots; d++) {
			items.set(dotCell.subarray(4 * d, 4 * d + 4));
			// Cells up left, up right, down left, down right; the edges up, right, down, left.
			const ok = this.colourCases(items, 4, (bits) => {
				const [ul, ur, dl, dr] = [bits & 1, (bits >> 1) & 1, (bits >> 2) & 1, bits >> 3];
				const m = (ul ^ ur) | ((ur ^ dr) << 1) | ((dl ^ dr) << 2) | ((ul ^ dl) << 3);
				return (POP[m] === 0 || POP[m] === 2) && this.dotFits(d, m);
			});
			if (!ok) return null;
		}
		let changed = this.linked;
		const { edgeSide } = this.l;
		for (let e = 0; e < this.g.edges; e++) {
			if (this.v[e] !== OPEN) continue;
			const ra = this.find(edgeSide[2 * e]);
			const da = this.found;
			if (ra !== this.find(edgeSide[2 * e + 1])) continue;
			this.set(e, da ^ this.found ? LINE : CROSS);
			changed = true;
		}
		// The edges follow from known differences, so drawing them contradicts no class.
		return changed;
	}

	/**
	 * Tries every colouring of the classes these cells belong to and links the classes whose
	 * difference is the same in every colouring that `fits` (bit i: colour of cell i). False
	 * when none fits.
	 */
	private colourCases(items: Int32Array, count: number, fits: (bits: number) => boolean): boolean {
		const roots: number[] = [];
		const rootOf = new Int8Array(count);
		const diffOf = new Int8Array(count);
		for (let i = 0; i < count; i++) {
			const r = this.find(items[i]);
			diffOf[i] = this.found;
			let k = roots.indexOf(r);
			if (k < 0) k = roots.push(r) - 1;
			rootOf[i] = k;
		}
		if (roots.length < 2) return fits(colours(0, count, rootOf, diffOf));
		// The first class is colour 0: only differences matter.
		const fitting: number[] = [];
		for (let a = 0; a < 1 << (roots.length - 1); a++) {
			if (fits(colours(a << 1, count, rootOf, diffOf))) fitting.push(a << 1);
		}
		if (fitting.length === 0) return false;
		// Link the classes that differ the same way in every colouring that fits.
		for (let i = 0; i < roots.length; i++) {
			for (let j = i + 1; j < roots.length; j++) {
				const diff = ((fitting[0] >> i) ^ (fitting[0] >> j)) & 1;
				// All differences come from one colouring, so these links never contradict.
				if (fitting.every((a) => (((a >> i) ^ (a >> j)) & 1) === diff)) {
					this.union(roots[i], roots[j], diff);
				}
			}
		}
		return true;
	}

	/** Whether the decided lines form exactly one loop. */
	private isLoop(v: Uint8Array): boolean {
		const { ends, edges } = this.g;
		const parent = new Int32Array(this.g.dots);
		for (let d = 0; d < parent.length; d++) parent[d] = d;
		const find = (x: number): number => {
			while (parent[x] !== x) x = parent[x] = parent[parent[x]];
			return x;
		};
		let pieces = 0;
		let lines = 0;
		for (let e = 0; e < edges; e++) {
			if (v[e] !== LINE) continue;
			lines++;
			const a = find(ends[2 * e]);
			const b = find(ends[2 * e + 1]);
			if (a !== b) parent[a] = b;
		}
		if (lines === 0) return false;
		const seen = new Set<number>();
		for (let e = 0; e < edges; e++) {
			if (v[e] === LINE && !seen.has(find(ends[2 * e]))) {
				seen.add(find(ends[2 * e]));
				pieces++;
			}
		}
		return pieces === 1;
	}
}

const ALL_MASKS = Uint8Array.from({ length: 16 }, (_, m) => m);

/** The colour of each cell (bit i) when class k has colour bit k of `assign`. */
function colours(assign: number, count: number, rootOf: Int8Array, diffOf: Int8Array): number {
	let bits = 0;
	for (let i = 0; i < count; i++) bits |= (((assign >> rootOf[i]) & 1) ^ diffOf[i]) << i;
	return bits;
}

export function solveLoop(p: LoopPuzzle, opts: LoopSolveOptions = {}): LoopSolveResult {
	return new LoopSolver(p).solve(opts);
}

export function rateLoop(
	p: LoopPuzzle,
	maxLevel: LoopLevel = LoopLevel.Advanced,
	from?: ArrayLike<number>
): LoopRating {
	return new LoopSolver(p).rate(maxLevel, from);
}
