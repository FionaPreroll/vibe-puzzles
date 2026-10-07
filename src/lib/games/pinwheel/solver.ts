import { neighbours } from '../../core/grid';
import { coveredCells, mirrorCell, type PinwheelPuzzle } from './rules';

export interface PinwheelSolveOptions {
	limit?: number;
	maxNodes?: number;
	/** Allow guessing. Without it the solver only propagates. */
	branch?: boolean;
}

export interface PinwheelSolveResult {
	/** Solutions as the centre index of every cell. */
	solutions: Int32Array[];
	finished: boolean;
	branched: boolean;
	nodes: number;
}

/**
 * Assigns every cell to a centre. Domains are bitmaps (cell × centre); propagation enforces
 * symmetry (a cell and its mirror share their centre) and connectivity (a cell can only belong
 * to a centre it can reach through cells that may also belong to it).
 */
export class PinwheelSolver {
	private readonly n: number;
	private readonly g: number;
	private readonly nb: Int32Array[];
	/** Mirror of cell c through centre k at [k * n + c], or -1. */
	private readonly mirror: Int32Array;
	private readonly cover: number[][];
	private nodes = 0;
	private limit = 2;
	private maxNodes = Infinity;
	private aborted = false;
	private branched = false;
	private solutions: Int32Array[] = [];
	private readonly seen: Uint8Array;
	private readonly queue: Int32Array;

	constructor(private readonly p: PinwheelPuzzle) {
		this.n = p.width * p.height;
		this.g = p.centres.length;
		this.nb = Array.from({ length: this.n }, (_, i) =>
			Int32Array.from(neighbours(i, p.width, p.height))
		);
		this.mirror = new Int32Array(this.n * this.g);
		p.centres.forEach((centre, k) => {
			for (let c = 0; c < this.n; c++) this.mirror[k * this.n + c] = mirrorCell(p, c, centre);
		});
		this.cover = p.centres.map((c) => coveredCells(p, c));
		this.seen = new Uint8Array(this.n);
		this.queue = new Int32Array(this.n);
	}

	solve(opts: PinwheelSolveOptions = {}): PinwheelSolveResult {
		this.limit = opts.limit ?? 2;
		this.maxNodes = opts.maxNodes ?? Infinity;
		this.nodes = 0;
		this.aborted = false;
		this.branched = false;
		this.solutions = [];
		const { n, g } = this;
		// dom[c * g + k] = 1 when cell c may belong to centre k.
		const dom = new Uint8Array(n * g);
		for (let c = 0; c < n; c++) {
			for (let k = 0; k < g; k++) dom[c * g + k] = this.mirror[k * n + c] >= 0 ? 1 : 0;
		}
		for (let k = 0; k < g; k++) {
			for (const c of this.cover[k]) {
				if (!dom[c * g + k]) return this.result();
				for (let o = 0; o < g; o++) if (o !== k) dom[c * g + o] = 0;
			}
		}
		if (opts.branch === false) {
			if (this.propagate(dom) && this.decided(dom)) this.leaf(dom);
			else this.branched = true;
			return this.result();
		}
		this.search(dom);
		return this.result();
	}

	private result(): PinwheelSolveResult {
		return {
			solutions: this.solutions,
			finished: !this.aborted,
			branched: this.branched,
			nodes: this.nodes
		};
	}

	private decided(dom: Uint8Array): boolean {
		const { n, g } = this;
		for (let c = 0; c < n; c++) {
			let count = 0;
			for (let k = 0; k < g; k++) count += dom[c * g + k];
			if (count !== 1) return false;
		}
		return true;
	}

	private leaf(dom: Uint8Array) {
		const { n, g } = this;
		const owner = new Int32Array(n);
		for (let c = 0; c < n; c++) {
			for (let k = 0; k < g; k++) if (dom[c * g + k]) owner[c] = k;
		}
		this.solutions.push(owner);
	}

	private search(dom: Uint8Array): void {
		if (this.aborted || this.solutions.length >= this.limit) return;
		if (++this.nodes > this.maxNodes) {
			this.aborted = true;
			return;
		}
		if (!this.propagate(dom)) return;
		const { n, g } = this;
		let best = -1;
		let bestCount = Infinity;
		for (let c = 0; c < n; c++) {
			let count = 0;
			for (let k = 0; k < g; k++) count += dom[c * g + k];
			if (count > 1 && count < bestCount) {
				best = c;
				bestCount = count;
				if (count === 2) break;
			}
		}
		if (best < 0) {
			this.leaf(dom);
			return;
		}
		this.branched = true;
		for (let k = 0; k < g; k++) {
			if (!dom[best * g + k]) continue;
			const next = dom.slice();
			for (let o = 0; o < g; o++) if (o !== k) next[best * g + o] = 0;
			this.search(next);
			if (this.aborted || this.solutions.length >= this.limit) return;
		}
	}

	/** Propagate to a fixpoint; false on contradiction. */
	private propagate(dom: Uint8Array): boolean {
		const { n, g, mirror } = this;
		for (;;) {
			let changed = false;
			// Symmetry: k stays possible for c only while it is possible for c's mirror.
			for (let c = 0; c < n; c++) {
				let count = 0;
				let last = -1;
				for (let k = 0; k < g; k++) {
					if (!dom[c * g + k]) continue;
					const m = mirror[k * n + c];
					if (m < 0 || !dom[m * g + k]) {
						dom[c * g + k] = 0;
						changed = true;
						continue;
					}
					count++;
					last = k;
				}
				if (count === 0) return false;
				if (count === 1) {
					// A decided cell decides its mirror.
					const m = mirror[last * n + c];
					for (let o = 0; o < g; o++) {
						if (o !== last && dom[m * g + o]) {
							dom[m * g + o] = 0;
							changed = true;
						}
					}
				}
			}
			// Connectivity: every cell of a galaxy must be reachable from its centre.
			for (let k = 0; k < g; k++) {
				if (this.prune(dom, k)) changed = true;
			}
			if (!changed) return true;
		}
	}

	private prune(dom: Uint8Array, k: number): boolean {
		const { n, g, seen, queue } = this;
		seen.fill(0);
		let head = 0;
		let tail = 0;
		for (const c of this.cover[k]) {
			seen[c] = 1;
			queue[tail++] = c;
		}
		while (head < tail) {
			for (const j of this.nb[queue[head++]]) {
				if (!seen[j] && dom[j * g + k]) {
					seen[j] = 1;
					queue[tail++] = j;
				}
			}
		}
		let changed = false;
		for (let c = 0; c < n; c++) {
			if (!seen[c] && dom[c * g + k]) {
				dom[c * g + k] = 0;
				changed = true;
			}
		}
		return changed;
	}
}

export function solvePinwheel(p: PinwheelPuzzle, opts?: PinwheelSolveOptions) {
	return new PinwheelSolver(p).solve(opts);
}
