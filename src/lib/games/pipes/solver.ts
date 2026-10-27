import { dealt, isSolvedTiles, neighboursOf, openings, turnsOf, type PipesPuzzle } from './rules';

/**
 * The deduction for Pipes. The solver knows, for every tile, the ways it can still lie: a set of
 * masks, bit `m` standing for the mask `m` (see `rules.ts`). Its techniques, weakest first:
 *
 * - `Fit`: a way to lie must fit the edge of the board (no pipe leads off a board without wrap)
 *   and the neighbours: a pipe needs one that opens back, a closed side one that cannot.
 * - `Loop`: a way that joins two tiles already joined by pipes closes a loop.
 * - `Closed`: a way that leaves a group of joined tiles without a loose end, short of the whole
 *   board, cuts that group off, for example two ends that face each other.
 *
 * Every tile keeps the number of its openings whichever way it lies, so a group of tiles joined
 * by pipes knows exactly how many pipes still have to leave it: the openings of its tiles that
 * are not yet known to join one of its own.
 */
export const PipesLevel = { Fit: 1, Loop: 2, Closed: 3 } as const;
export type PipesLevel = (typeof PipesLevel)[keyof typeof PipesLevel];

/** For every set of masks: the sides all of them open (`AND`) and the sides any opens (`OR`). */
const AND = new Uint8Array(1 << 16);
const OR = new Uint8Array(1 << 16);
AND[0] = 15;
for (let s = 1; s < 1 << 16; s++) {
	const low = s & -s;
	const mask = 31 - Math.clz32(low);
	AND[s] = AND[s ^ low] & mask;
	OR[s] = OR[s ^ low] | mask;
}

/** Number of masks in a set. */
export function count(set: number): number {
	let n = 0;
	for (let s = set; s; s &= s - 1) n++;
	return n;
}

/** The masks of a set. */
export function masksOf(set: number): number[] {
	const out: number[] = [];
	for (let s = set; s; s &= s - 1) out.push(31 - Math.clz32(s & -s));
	return out;
}

/** The sides every way in `set` opens to. */
export const sidesOpen = (set: number) => AND[set];
/** The sides some way in `set` opens to. */
export const sidesMaybe = (set: number) => OR[set];

export interface SolveResult {
	/** The tiles of each solution found, at most `limit`. */
	solutions: number[][];
	/** False if the node budget ran out before the search was complete. */
	finished: boolean;
	nodes: number;
}

export class PipesSolver {
	readonly n: number;
	readonly nb: Int32Array;
	/** Openings per tile. */
	readonly degree: Uint8Array;
	/** Every way each tile can lie, as a set of masks. */
	readonly turns: Uint16Array;
	/** Union-find scratch space for the groups of joined tiles. */
	private readonly parent: Int32Array;
	private readonly size: Int32Array;
	/** Pipes a group still has to send out, at its root. */
	private readonly rest: Int32Array;
	/** The known sides of each tile while `joinGroups` runs. */
	private readonly open: Uint8Array;

	constructor(readonly puzzle: PipesPuzzle) {
		const tiles = dealt(puzzle);
		this.n = tiles.length;
		this.nb = neighboursOf(puzzle);
		this.degree = Uint8Array.from(tiles, openings);
		this.turns = Uint16Array.from(tiles, (t) => turnsOf(t).reduce((s, m) => s | (1 << m), 0));
		this.parent = new Int32Array(this.n);
		this.size = new Int32Array(this.n);
		this.rest = new Int32Array(this.n);
		this.open = new Uint8Array(this.n);
	}

	/** What is known before any deduction: every tile may lie every way. */
	start(): Uint16Array {
		return this.turns.slice();
	}

	/**
	 * Narrows `opts` with the techniques up to `level` until nothing changes. False on a
	 * contradiction: a tile with no way left, or a group of tiles cut off.
	 */
	propagate(opts: Uint16Array, level: PipesLevel = PipesLevel.Closed): boolean {
		const all = Array.from({ length: this.n }, (_, c) => c);
		if (!this.fit(opts, all)) return false;
		if (level < PipesLevel.Loop) return true;
		for (;;) {
			const changed = this.groups(opts, level);
			if (changed === null) return false;
			if (!changed.length) return true;
			// The neighbours of a tile that lost ways may learn from it.
			const queue = new Set(changed);
			for (const c of changed) {
				for (let k = 0; k < 4; k++) if (this.nb[c * 4 + k] >= 0) queue.add(this.nb[c * 4 + k]);
			}
			if (!this.fit(opts, [...queue])) return false;
		}
	}

	/** The way a tile must lie to fit its neighbours and the edge (see `Fit`), out of `set`. */
	fitting(opts: Uint16Array, c: number, set = opts[c]): number {
		let mustOpen = 0;
		let mustClose = 0;
		for (let k = 0; k < 4; k++) {
			const m = this.nb[c * 4 + k];
			if (m < 0) {
				mustClose |= 1 << k;
				continue;
			}
			const back = 1 << ((k + 2) % 4);
			if (AND[opts[m]] & back) mustOpen |= 1 << k;
			else if (!(OR[opts[m]] & back)) mustClose |= 1 << k;
		}
		let out = 0;
		for (let s = set; s; s &= s - 1) {
			const mask = 31 - Math.clz32(s & -s);
			if ((mask & mustOpen) === mustOpen && !(mask & mustClose)) out |= 1 << mask;
		}
		return out;
	}

	/** `Fit` until nothing changes, starting from the tiles in `queue`. */
	private fit(opts: Uint16Array, queue: number[]): boolean {
		const queued = new Uint8Array(this.n);
		for (const c of queue) queued[c] = 1;
		const work = [...queue];
		while (work.length) {
			const c = work.pop()!;
			queued[c] = 0;
			const before = opts[c];
			const after = this.fitting(opts, c);
			if (!after) return false;
			if (after === before) continue;
			opts[c] = after;
			// Neighbours only learn something when a side became known.
			if (AND[after] === AND[before] && OR[after] === OR[before]) continue;
			for (let k = 0; k < 4; k++) {
				const m = this.nb[c * 4 + k];
				if (m >= 0 && !queued[m]) {
					queued[m] = 1;
					work.push(m);
				}
			}
		}
		return true;
	}

	private find(x: number): number {
		const parent = this.parent;
		while (parent[x] !== x) {
			parent[x] = parent[parent[x]];
			x = parent[x];
		}
		return x;
	}

	/**
	 * The sides of tile `c` known to hold a pipe: those every way of the tile opens, and those
	 * every way of a neighbour opens back to (`Fit` makes the two the same, but a hint asks before
	 * it ran).
	 */
	known(opts: Uint16Array, c: number): number {
		let open = AND[opts[c]];
		for (let k = 0; k < 4; k++) {
			const m = this.nb[c * 4 + k];
			if (m >= 0 && AND[opts[m]] & (1 << ((k + 2) % 4))) open |= 1 << k;
		}
		return open;
	}

	/**
	 * The groups of tiles that known pipes join, each with its size and the pipes it still has to
	 * send out (at its root). False if known pipes close a loop or cut a group off from the rest.
	 */
	joinGroups(opts: Uint16Array): boolean {
		const { n, nb, parent, size, rest, degree, open: known } = this;
		for (let c = 0; c < n; c++) {
			parent[c] = c;
			size[c] = 1;
			rest[c] = 0;
		}
		for (let c = 0; c < n; c++) {
			const open = (known[c] = this.known(opts, c));
			// Each pipe once: as the top or the right side of a tile.
			for (let k = 0; k < 2; k++) {
				if (!(open & (1 << k))) continue;
				const a = this.find(c);
				const b = this.find(nb[c * 4 + k]);
				if (a === b) return false;
				parent[b] = a;
				size[a] += size[b];
			}
		}
		for (let c = 0; c < n; c++) rest[this.find(c)] += degree[c] - count(known[c]);
		for (let c = 0; c < n; c++) {
			if (parent[c] === c && rest[c] <= 0 && size[c] < n) return false;
		}
		return true;
	}

	/** The group a tile belongs to after `joinGroups`. */
	groupOf(c: number): number {
		return this.find(c);
	}

	/** Size and pipes still to send out of a group root after `joinGroups`. */
	groupInfo(root: number): { size: number; rest: number } {
		return { size: this.size[root], rest: this.rest[root] };
	}

	/**
	 * Why tile `c` cannot lie as `mask` given the groups of `joinGroups`: it would close a loop, or
	 * cut a group off (only checked from `level` Closed). Null if neither.
	 */
	breaks(opts: Uint16Array, c: number, mask: number, level: PipesLevel): 'loop' | 'closed' | null {
		const own = this.find(c);
		const fresh = mask & ~this.known(opts, c);
		let total = this.rest[own];
		let size = this.size[own];
		const seen: number[] = [];
		for (let s = fresh; s; s &= s - 1) {
			const k = 31 - Math.clz32(s & -s);
			const g = this.find(this.nb[c * 4 + k]);
			if (g === own || seen.includes(g)) return 'loop';
			seen.push(g);
			total += this.rest[g];
			size += this.size[g];
		}
		if (level < PipesLevel.Closed) return null;
		// Each new pipe uses up an opening on both of its tiles.
		total -= 2 * count(fresh);
		return total === 0 && size < this.n ? 'closed' : null;
	}

	/**
	 * `Loop` and `Closed` on every tile still undecided. Returns the tiles that lost a way to lie
	 * (it stops after the first one whose known pipes changed, as that changes the groups), or
	 * null on a contradiction.
	 */
	private groups(opts: Uint16Array, level: PipesLevel): number[] | null {
		if (!this.joinGroups(opts)) return null;
		const changed: number[] = [];
		for (let c = 0; c < this.n; c++) {
			const before = opts[c];
			if (!(before & (before - 1))) continue;
			let after = before;
			for (let s = before; s; s &= s - 1) {
				const mask = 31 - Math.clz32(s & -s);
				if (this.breaks(opts, c, mask, level)) after &= ~(1 << mask);
			}
			if (after === before) continue;
			if (!after) return null;
			opts[c] = after;
			changed.push(c);
			if (AND[after] !== AND[before]) break;
		}
		return changed;
	}

	/** Whether the techniques up to `level` alone decide every tile, without trying anything. */
	solvesAlone(level: PipesLevel = PipesLevel.Closed): Uint16Array | null {
		const opts = this.start();
		if (!this.propagate(opts, level)) return null;
		for (const set of opts) if (set & (set - 1)) return null;
		return isSolvedTiles(this.puzzle, decided(opts)) ? opts : null;
	}

	/**
	 * Every solution, up to `limit`: the techniques at every node, then each way of the tile with
	 * the fewest ways left. A node budget bounds the work.
	 */
	solve(limit = 2, maxNodes = 200_000): SolveResult {
		const solutions: number[][] = [];
		let nodes = 0;
		let finished = true;
		const search = (opts: Uint16Array) => {
			if (solutions.length >= limit) return;
			if (++nodes > maxNodes) {
				finished = false;
				return;
			}
			if (!this.propagate(opts)) return;
			let best = -1;
			let bestCount = 5;
			for (let c = 0; c < this.n; c++) {
				const k = count(opts[c]);
				if (k > 1 && k < bestCount) {
					best = c;
					bestCount = k;
				}
			}
			if (best < 0) {
				const tiles = decided(opts);
				if (isSolvedTiles(this.puzzle, tiles)) solutions.push(tiles);
				return;
			}
			for (const mask of masksOf(opts[best])) {
				if (solutions.length >= limit || !finished) return;
				const next = opts.slice();
				next[best] = 1 << mask;
				search(next);
			}
		};
		search(this.start());
		return { solutions, finished, nodes };
	}
}

/** The tiles of a fully decided state (each set holds one mask). */
export function decided(opts: Uint16Array): number[] {
	return Array.from(opts, (set) => 31 - Math.clz32(set));
}

/** Every solution of a puzzle, up to `limit` (see `PipesSolver.solve`). */
export function solvePipes(p: PipesPuzzle, limit = 2, maxNodes?: number): SolveResult {
	return new PipesSolver(p).solve(limit, maxNodes);
}
