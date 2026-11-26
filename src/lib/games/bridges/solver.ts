import {
	across,
	graphOf,
	linksOf,
	MAX_BRIDGES,
	type BridgesGraph,
	type BridgesPuzzle
} from './rules';

/**
 * The deduction for Bridges. The solver knows, for every link, the fewest and the most bridges
 * it can still take (`Known`). Its techniques, weakest first:
 *
 * - `Count`: an island takes as many bridges as its number. If its other links can take at most
 *   so many, the rest must go to this one; if its other links already hold so many, this one
 *   takes at most what is left. A bridge blocks every link that crosses it.
 * - `Isolation`: a link may not take the bridges that would join two groups of islands (or close
 *   one) into a group with all its bridges, as long as other islands are left: the two 1s that
 *   face each other, or two 2s with a double bridge.
 * - `Connect`: every island must reach every other. A link that is the only way between two
 *   parts of the board gets a bridge. And every way to give one island its bridges is tried at
 *   once: only those that close off no group count.
 * - `Trial`: a link's fewest or most bridges are tried out with the techniques above; where that
 *   breaks a rule, the link cannot take them.
 *
 * Groups are the islands joined by bridges that are sure, each with the bridges it still needs
 * (its islands' numbers less the sure bridges at them).
 */
export const BridgesLevel = { Count: 1, Isolation: 2, Connect: 3, Trial: 4 } as const;
export type BridgesLevel = (typeof BridgesLevel)[keyof typeof BridgesLevel];

/**
 * What is known: for link `l`, `known[2 * l]` is the fewest bridges it can take and
 * `known[2 * l + 1]` the most.
 */
export type Known = Uint8Array;

/** What breaks when nothing fits: an island's number, two crossing bridges, a closed group, a cut. */
export type Contradiction = 'count' | 'cross' | 'closed' | 'cut';

export interface SolveResult {
	/** The bridges per link of each solution found, at most `limit`. */
	solutions: number[][];
	/** False if the node budget ran out before the search was complete. */
	finished: boolean;
	nodes: number;
}

/** The groups of islands joined by sure bridges: a root per island, size and need per root. */
export interface Groups {
	root: Int32Array;
	size: Int32Array;
	/** Bridges the group still needs, at its root. */
	rest: Int32Array;
}

export const fewest = (k: Known, l: number) => k[2 * l];
export const most = (k: Known, l: number) => k[2 * l + 1];
export const decidedLink = (k: Known, l: number) => k[2 * l] === k[2 * l + 1];

export class BridgesSolver {
	readonly g: BridgesGraph;
	/** Number of links and of islands. */
	readonly links: number;
	readonly islands: number;
	/** The links of each island, `islandLinks[i]`. */
	readonly islandLinks: number[][];
	/** Why the last `propagate` failed. */
	broken: Contradiction | null = null;

	constructor(readonly puzzle: BridgesPuzzle) {
		this.g = graphOf(puzzle);
		this.links = this.g.ends.length / 2;
		this.islands = this.g.cells.length;
		this.islandLinks = this.g.cells.map((_, i) => linksOf(this.g, i));
	}

	/** What is known before any deduction: every link takes 0 to 2 bridges. */
	start(): Known {
		const k = new Uint8Array(2 * this.links);
		for (let l = 0; l < this.links; l++) k[2 * l + 1] = MAX_BRIDGES;
		return k;
	}

	/** Whether every link is decided. */
	done(k: Known): boolean {
		for (let l = 0; l < this.links; l++) if (k[2 * l] !== k[2 * l + 1]) return false;
		return true;
	}

	/** The bridges of a fully decided `k`, per link. */
	values(k: Known): number[] {
		return Array.from({ length: this.links }, (_, l) => k[2 * l]);
	}

	/**
	 * Narrows `k` with the techniques up to `level` until nothing changes. False on a
	 * contradiction, with its kind in `broken`.
	 */
	propagate(k: Known, level: BridgesLevel = BridgesLevel.Connect): boolean {
		this.broken = null;
		for (let l = 0; l < this.links; l++) {
			if (!k[2 * l]) continue;
			if (this.g.crossing[l].some((m) => k[2 * m] > 0)) return this.fail('cross');
			this.block(k, l, null);
		}
		for (;;) {
			if (!this.count(k)) return false;
			if (level < BridgesLevel.Isolation) return true;
			const isolated = this.isolation(k);
			if (isolated === null) return false;
			if (isolated) continue;
			if (level < BridgesLevel.Connect) return true;
			const cut = this.connect(k);
			if (cut === null) return false;
			if (cut) continue;
			const combos = this.combos(k);
			if (combos === null) return false;
			if (combos) continue;
			if (level < BridgesLevel.Trial) return true;
			const tried = this.trial(k);
			if (tried === null) return false;
			if (!tried) return true;
		}
	}

	private fail(why: Contradiction): false {
		this.broken = why;
		return false;
	}

	/** `fail` for the steps that tell a change (true) from none (false). */
	private failed(why: Contradiction): null {
		this.broken = why;
		return null;
	}

	/**
	 * A sure bridge on `l` blocks every link across it: they take none. Their islands go on the
	 * queue, if there is one. None of them has a sure bridge: once `propagate` has checked what it
	 * was given, a link with one has blocked them, and blocked links never get one.
	 */
	private block(k: Known, l: number, queue: number[] | null) {
		for (const m of this.g.crossing[l]) {
			if (k[2 * m + 1] === 0) continue;
			k[2 * m + 1] = 0;
			queue?.push(this.g.ends[2 * m], this.g.ends[2 * m + 1]);
		}
	}

	/**
	 * The bounds `Count` gives the links of island `i`: `[fewest, most]` per link of
	 * `islandLinks[i]`, or null if its number cannot be met.
	 */
	countAt(k: Known, i: number): [number, number][] | null {
		const ls = this.islandLinks[i];
		let lo = 0;
		let hi = 0;
		for (const l of ls) {
			lo += k[2 * l];
			hi += k[2 * l + 1];
		}
		const clue = this.g.clue[i];
		if (clue < lo || clue > hi) return null;
		return ls.map((l) => [
			Math.max(k[2 * l], clue - (hi - k[2 * l + 1])),
			Math.min(k[2 * l + 1], clue - (lo - k[2 * l]))
		]);
	}

	/** `Count` and the blocking of crossing links, until nothing changes. */
	private count(k: Known): boolean {
		const queue = Array.from({ length: this.islands }, (_, i) => i);
		const queued = new Uint8Array(this.islands).fill(1);
		while (queue.length) {
			const i = queue.pop()!;
			queued[i] = 0;
			const bounds = this.countAt(k, i);
			if (!bounds) return this.fail('count');
			const touched: number[] = [];
			bounds.forEach(([lo, hi], n) => {
				const l = this.islandLinks[i][n];
				if (lo === k[2 * l] && hi === k[2 * l + 1]) return;
				const raised = lo > 0 && !k[2 * l];
				k[2 * l] = lo;
				k[2 * l + 1] = hi;
				touched.push(i, across(this.g, l, i));
				if (raised) this.block(k, l, touched);
			});
			for (const x of touched) {
				if (!queued[x]) {
					queued[x] = 1;
					queue.push(x);
				}
			}
		}
		return true;
	}

	/** The groups of islands that sure bridges join. */
	groups(k: Known): Groups {
		const n = this.islands;
		const root = Int32Array.from({ length: n }, (_, i) => i);
		const find = (x: number): number => {
			while (root[x] !== x) x = root[x] = root[root[x]];
			return x;
		};
		for (let l = 0; l < this.links; l++) {
			if (!k[2 * l]) continue;
			const a = find(this.g.ends[2 * l]);
			const b = find(this.g.ends[2 * l + 1]);
			if (a !== b) root[Math.max(a, b)] = Math.min(a, b);
		}
		const size = new Int32Array(n);
		const rest = new Int32Array(n);
		for (let i = 0; i < n; i++) {
			const r = find(i);
			root[i] = r;
			size[r]++;
			rest[r] += this.g.clue[i];
			for (const l of this.islandLinks[i]) rest[r] -= k[2 * l];
		}
		return { root, size, rest };
	}

	/**
	 * Whether `l` taking `value` bridges would close a group off: the groups at its two ends,
	 * joined, would need no more bridges while other islands are left.
	 */
	closes(k: Known, groups: Groups, l: number, value: number): boolean {
		const a = groups.root[this.g.ends[2 * l]];
		const b = groups.root[this.g.ends[2 * l + 1]];
		const size = a === b ? groups.size[a] : groups.size[a] + groups.size[b];
		const rest =
			(a === b ? groups.rest[a] : groups.rest[a] + groups.rest[b]) - 2 * (value - k[2 * l]);
		return value > 0 && rest === 0 && size < this.islands;
	}

	/**
	 * `Isolation` on every link: the most it may take, if that closes a group off, comes down by
	 * one (once `Count` is done, only the most can). True if a link changed, null when a group
	 * is closed off already.
	 */
	private isolation(k: Known): boolean | null {
		const groups = this.groups(k);
		for (let i = 0; i < this.islands; i++) {
			if (groups.root[i] === i && groups.rest[i] === 0 && groups.size[i] < this.islands) {
				return this.failed('closed');
			}
		}
		let changed = false;
		for (let l = 0; l < this.links; l++) {
			const hi = k[2 * l + 1];
			if (k[2 * l] < hi && this.closes(k, groups, l, hi)) {
				k[2 * l + 1] = hi - 1;
				changed = true;
			}
		}
		return changed;
	}

	/**
	 * The links that are the only way between two parts of the board, by the links that can
	 * still take a bridge (bridges of that graph, Tarjan's search without recursion), each with
	 * the islands on its far side from the first island. Null if the board falls apart already.
	 */
	cuts(k: Known): { link: number; side: number[] }[] | null {
		const n = this.islands;
		const disc = new Int32Array(n).fill(-1);
		const low = new Int32Array(n);
		const out: { link: number; side: number[] }[] = [];
		const order: number[] = [];
		let time = 0;
		disc[0] = low[0] = time++;
		order.push(0);
		// Each frame: an island, the link it was reached by (-1 for the first) and the next link.
		const stack: [number, number, number][] = [[0, -1, 0]];
		while (stack.length) {
			const frame = stack[stack.length - 1];
			const [i, via] = frame;
			const ls = this.islandLinks[i];
			if (frame[2] < ls.length) {
				const l = ls[frame[2]++];
				if (l === via || !k[2 * l + 1]) continue;
				const j = across(this.g, l, i);
				if (disc[j] < 0) {
					disc[j] = low[j] = time++;
					order.push(j);
					stack.push([j, l, 0]);
				} else low[i] = Math.min(low[i], disc[j]);
				continue;
			}
			stack.pop();
			if (via < 0) continue;
			const parent = across(this.g, via, i);
			low[parent] = Math.min(low[parent], low[i]);
			// The islands found from `i` on form the far side, if nothing leads back past the link.
			if (low[i] > disc[parent]) {
				out.push({ link: via, side: order.filter((x) => disc[x] >= disc[i]) });
			}
		}
		return order.length === n ? out : null;
	}

	/** `Connect` by the links that are the only way between two parts. Null if the board falls apart. */
	private connect(k: Known): boolean | null {
		const cuts = this.cuts(k);
		if (!cuts) return this.failed('cut');
		let changed = false;
		for (const { link } of cuts) {
			if (k[2 * link]) continue;
			k[2 * link] = 1;
			this.block(k, link, null);
			changed = true;
		}
		return changed;
	}

	/**
	 * Every way to give island `i` its bridges within what is known, leaving out those that close
	 * a group off: `[fewest, most]` per link of `islandLinks[i]` over the ways left, or null if
	 * none is left.
	 */
	combosAt(k: Known, groups: Groups, i: number): [number, number][] | null {
		const ls = this.islandLinks[i];
		const clue = this.g.clue[i];
		const bounds: [number, number][] = ls.map(() => [3, -1]);
		const values = ls.map((l) => k[2 * l]);
		const own = groups.root[i];
		let found = false;
		const check = () => {
			let rest = groups.rest[own];
			let size = groups.size[own];
			const seen = [own];
			ls.forEach((l, n) => {
				rest -= 2 * (values[n] - k[2 * l]);
				const other = groups.root[across(this.g, l, i)];
				if (values[n] > 0 && !seen.includes(other)) {
					seen.push(other);
					rest += groups.rest[other];
					size += groups.size[other];
				}
			});
			if (rest === 0 && size < this.islands) return;
			found = true;
			values.forEach((v, n) => {
				bounds[n][0] = Math.min(bounds[n][0], v);
				bounds[n][1] = Math.max(bounds[n][1], v);
			});
		};
		const walk = (n: number, sum: number) => {
			if (n === ls.length) {
				if (sum === clue) check();
				return;
			}
			const l = ls[n];
			for (let v = k[2 * l]; v <= k[2 * l + 1] && sum + v <= clue; v++) {
				values[n] = v;
				walk(n + 1, sum + v);
			}
			values[n] = k[2 * l];
		};
		walk(0, 0);
		return found ? bounds : null;
	}

	/** `combosAt` on every island with an undecided link. True if a link changed. */
	private combos(k: Known): boolean | null {
		const groups = this.groups(k);
		for (let i = 0; i < this.islands; i++) {
			const ls = this.islandLinks[i];
			if (ls.every((l) => k[2 * l] === k[2 * l + 1])) continue;
			const bounds = this.combosAt(k, groups, i);
			if (!bounds) return this.failed('closed');
			let changed = false;
			for (const [n, [lo, hi]] of bounds.entries()) {
				const l = ls[n];
				if (lo === k[2 * l] && hi === k[2 * l + 1]) continue;
				const raised = lo > 0 && !k[2 * l];
				k[2 * l] = lo;
				k[2 * l + 1] = hi;
				changed = true;
				if (raised) this.block(k, l, null);
			}
			// The groups change with a sure bridge: `count` and the rest run again first.
			if (changed) return true;
		}
		return false;
	}

	/**
	 * `Trial` on the first link where it decides something: its fewest and its most bridges are
	 * each tried with the techniques up to `Connect`. True if a link changed.
	 */
	private trial(k: Known): boolean | null {
		for (let l = 0; l < this.links; l++) {
			const lo = k[2 * l];
			const hi = k[2 * l + 1];
			if (lo === hi) continue;
			const low = this.tryValue(k, l, lo, lo);
			const high = this.tryValue(k, l, hi, hi);
			if (!low && !high) return this.failed('count');
			if (low && high) continue;
			this.broken = null;
			if (low) {
				k[2 * l + 1] = hi - 1;
				return true;
			}
			k[2 * l] = lo + 1;
			if (!lo) this.block(k, l, null);
			return true;
		}
		return false;
	}

	/** Whether `l` may take `lo` to `hi` bridges, as far as the techniques up to `Connect` see. */
	tryValue(k: Known, l: number, lo: number, hi: number): boolean {
		const copy = k.slice();
		copy[2 * l] = lo;
		copy[2 * l + 1] = hi;
		return this.propagate(copy, BridgesLevel.Connect);
	}

	/**
	 * The fewest techniques that decide every link, as the level of the strongest one used, or
	 * null if even `Trial` gets stuck (or the puzzle has no solution). The known links at the end
	 * come with it.
	 */
	rate(): { level: BridgesLevel; known: Known } | null {
		const k = this.start();
		for (const level of [
			BridgesLevel.Count,
			BridgesLevel.Isolation,
			BridgesLevel.Connect,
			BridgesLevel.Trial
		] as const) {
			if (!this.propagate(k, level)) return null;
			if (this.done(k)) return { level, known: k };
		}
		return null;
	}

	/**
	 * Every solution, up to `limit`: the techniques up to `Connect` at every node, then each way
	 * of the link with the fewest left, its most bridges first. A node budget bounds the work.
	 */
	solve(limit = 2, maxNodes = 200_000): SolveResult {
		const solutions: number[][] = [];
		let nodes = 0;
		let finished = true;
		const search = (k: Known) => {
			if (++nodes > maxNodes) {
				finished = false;
				return;
			}
			if (!this.propagate(k)) return;
			let best = -1;
			let width = 3;
			for (let l = 0; l < this.links; l++) {
				const span = k[2 * l + 1] - k[2 * l];
				if (span > 0 && span < width) {
					best = l;
					width = span;
				}
			}
			if (best < 0) {
				// Every link decided: the numbers met, no crossing, and `Connect` keeps the board in
				// one piece.
				solutions.push(this.values(k));
				return;
			}
			for (let v = k[2 * best + 1]; v >= k[2 * best]; v--) {
				if (solutions.length >= limit || !finished) return;
				const next = k.slice();
				next[2 * best] = next[2 * best + 1] = v;
				search(next);
			}
		};
		search(this.start());
		return { solutions, finished, nodes };
	}
}

/** Every solution of a puzzle, up to `limit` (see `BridgesSolver.solve`). */
export function solveBridges(p: BridgesPuzzle, limit = 2, maxNodes?: number): SolveResult {
	return new BridgesSolver(p).solve(limit, maxNodes);
}
