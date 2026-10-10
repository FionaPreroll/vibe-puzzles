import { clueAt, CROSS, LINE, loopGraph, OPEN, type LoopGraph, type LoopPuzzle } from './rules';

export interface LoopSolveOptions {
	limit?: number;
	maxNodes?: number;
	/** Allow guessing. Without it the solver only propagates. */
	branch?: boolean;
}

export interface LoopSolveResult {
	/** Solutions as edge values in the graph's numbering (LINE or CROSS). */
	solutions: Uint8Array[];
	finished: boolean;
	branched: boolean;
	nodes: number;
}

/**
 * Decides every edge as line or cross. Propagation applies the rules a person starts with:
 *
 * - a clue with as many lines as its number crosses its other edges; one with as many lines and
 *   open edges as its number draws them all;
 * - a dot has two lines or none: with two lines its other edges are crossed, a line that can only
 *   go on one way goes on, and a dot with a single open edge and no line crosses it;
 * - an edge that would close a loop is crossed, unless that loop is the whole solution.
 *
 * Search branches on an open edge, preferably one that continues a line.
 */
export class LoopSolver {
	private readonly g: LoopGraph;
	private readonly n: number;
	private readonly clue: Int8Array;
	/** The one or two cells next to each edge, -1 for none. */
	private readonly edgeCells: Int32Array;
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

	constructor(private readonly p: LoopPuzzle) {
		this.g = loopGraph(p.width, p.height);
		this.n = p.width * p.height;
		this.clue = Int8Array.from({ length: this.n }, (_, c) => clueAt(p, c));
		this.edgeCells = new Int32Array(2 * this.g.edges).fill(-1);
		for (let c = 0; c < this.n; c++) {
			for (let k = 0; k < 4; k++) {
				const e = this.g.cellEdges[4 * c + k];
				this.edgeCells[this.edgeCells[2 * e] < 0 ? 2 * e : 2 * e + 1] = c;
			}
		}
		this.queue = new Int32Array(this.n + this.g.dots);
		this.queued = new Uint8Array(this.n + this.g.dots);
	}

	solve(opts: LoopSolveOptions = {}): LoopSolveResult {
		this.limit = opts.limit ?? 2;
		this.maxNodes = opts.maxNodes ?? Infinity;
		this.nodes = 0;
		this.aborted = false;
		this.branched = false;
		this.solutions = [];
		this.search(new Uint8Array(this.g.edges), opts.branch ?? true);
		return {
			solutions: this.solutions,
			finished: !this.aborted,
			branched: this.branched,
			nodes: this.nodes
		};
	}

	private search(v: Uint8Array, branch: boolean) {
		if (++this.nodes > this.maxNodes) {
			this.aborted = true;
			return;
		}
		if (!this.propagate(v)) return;
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
			this.search(next, branch);
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
	private set(v: Uint8Array, e: number, value: number) {
		v[e] = value;
		for (const c of [this.edgeCells[2 * e], this.edgeCells[2 * e + 1]]) if (c >= 0) this.push(c);
		this.push(this.n + this.g.ends[2 * e]);
		this.push(this.n + this.g.ends[2 * e + 1]);
	}

	/** Applies the rules until nothing changes; false on a contradiction. */
	propagate(v: Uint8Array): boolean {
		this.head = this.tail = this.size = 0;
		this.queued.fill(0);
		for (let item = 0; item < this.n + this.g.dots; item++) this.push(item);
		for (;;) {
			while (this.size > 0) {
				const item = this.queue[this.tail++ % this.queue.length];
				this.size--;
				this.queued[item] = 0;
				const ok = item < this.n ? this.cellRule(v, item) : this.dotRule(v, item - this.n);
				if (!ok) return false;
			}
			const changed = this.loopRule(v);
			if (changed === null) return false;
			if (!changed) return true;
		}
	}

	private cellRule(v: Uint8Array, c: number): boolean {
		const clue = this.clue[c];
		if (clue < 0) return true;
		const edges = this.g.cellEdges;
		let lines = 0;
		let open = 0;
		for (let k = 4 * c; k < 4 * c + 4; k++) {
			if (v[edges[k]] === LINE) lines++;
			else if (v[edges[k]] === OPEN) open++;
		}
		if (lines > clue || lines + open < clue) return false;
		if (open === 0) return true;
		const fill = lines === clue ? CROSS : lines + open === clue ? LINE : OPEN;
		if (fill === OPEN) return true;
		for (let k = 4 * c; k < 4 * c + 4; k++) {
			if (v[edges[k]] === OPEN) this.set(v, edges[k], fill);
		}
		return true;
	}

	private dotRule(v: Uint8Array, d: number): boolean {
		const edges = this.g.dotEdges;
		let lines = 0;
		let open = 0;
		let last = -1;
		for (let k = 4 * d; k < 4 * d + 4; k++) {
			const e = edges[k];
			if (e < 0) continue;
			if (v[e] === LINE) lines++;
			else if (v[e] === OPEN) {
				open++;
				last = e;
			}
		}
		if (lines > 2 || (lines === 1 && open === 0)) return false;
		if (open === 0) return true;
		if (lines === 2) {
			for (let k = 4 * d; k < 4 * d + 4; k++) {
				const e = edges[k];
				if (e >= 0 && v[e] === OPEN) this.set(v, e, CROSS);
			}
			return true;
		}
		if (open === 1) this.set(v, last, lines === 1 ? LINE : CROSS);
		return true;
	}

	/**
	 * Crosses every open edge that would close a loop too early. Returns whether it changed
	 * something, or null when a loop is already closed beside other lines.
	 */
	private loopRule(v: Uint8Array): boolean | null {
		const { ends, edges } = this.g;
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
					this.set(v, e, CROSS);
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
			if (pieceLines[root] === lines && this.closesSolution(v, e)) continue;
			this.set(v, e, CROSS);
			changed = true;
		}
		return changed;
	}

	/** Whether drawing `e` satisfies every clue (the lines then form one loop). */
	private closesSolution(v: Uint8Array, e: number): boolean {
		const edges = this.g.cellEdges;
		for (let c = 0; c < this.n; c++) {
			if (this.clue[c] < 0) continue;
			let lines = 0;
			for (let k = 4 * c; k < 4 * c + 4; k++) {
				if (v[edges[k]] === LINE || edges[k] === e) lines++;
			}
			if (lines !== this.clue[c]) return false;
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

export function solveLoop(p: LoopPuzzle, opts: LoopSolveOptions = {}): LoopSolveResult {
	return new LoopSolver(p).solve(opts);
}
