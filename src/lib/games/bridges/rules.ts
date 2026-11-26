import type { BasePuzzle } from '../../core/types';

/**
 * Bridges: islands with numbers lie on the board. The player joins them with bridges, straight
 * across or down and up between two islands with only water in between. Two islands take at
 * most two bridges, bridges never cross each other or an island, every island gets as many
 * bridges as its number says, and all islands join into one group.
 */
export interface BridgesPuzzle extends BasePuzzle {
	/**
	 * One character per cell in reading order: `.` for water, `1` to `8` for an island and the
	 * number of bridges it takes.
	 */
	islands: string;
}

export interface BridgesState {
	/** Per link (see `bridgesGraph`): its bridges, 0 to 2, or `CROSS` where the player noted none. */
	links: number[];
}

/** A link the player marked: no bridge goes there. It counts as none. */
export const CROSS = 3;
/** Most bridges between two islands. */
export const MAX_BRIDGES = 2;
/** Highest number on an island: two bridges on each of its four sides. */
export const MAX_CLUE = 8;

/** The bridges a link's value stands for: a cross is none. */
export const bridgesOf = (value: number) => (value === CROSS ? 0 : value);

/**
 * The islands of a puzzle and the links between them: a link joins two islands in the same row
 * or column with only water between them, the way a bridge can go.
 */
export interface BridgesGraph {
	width: number;
	height: number;
	/** The cell of each island, in reading order. */
	cells: number[];
	/** The number of each island. */
	clue: number[];
	/** The island in each cell, -1 for water. */
	islandAt: Int32Array;
	/** The two islands of each link: the one to the left or above first. */
	ends: Int32Array;
	/** Whether a link runs across (else down). */
	across: Uint8Array;
	/** The links of each island by side, `sides[island * 4 + k]` for side `k` (0 up to 3 left), -1. */
	sides: Int32Array;
	/** The links that cross each link. */
	crossing: number[][];
	/** The links over each water cell: the one across and the one down, -1 for none. */
	acrossAt: Int32Array;
	downAt: Int32Array;
}

/**
 * The links of a puzzle, numbered island by island in reading order: first the link to the
 * right of an island, then the one below it. Puzzle IDs, saves and answers rely on this order.
 */
export function bridgesGraph(p: Pick<BridgesPuzzle, 'width' | 'height' | 'islands'>): BridgesGraph {
	const { width: w, height: h } = p;
	const n = w * h;
	const islandAt = new Int32Array(n).fill(-1);
	const cells: number[] = [];
	const clue: number[] = [];
	for (let c = 0; c < n; c++) {
		if (p.islands[c] === '.') continue;
		islandAt[c] = cells.length;
		cells.push(c);
		clue.push(Number(p.islands[c]));
	}
	const sides = new Int32Array(cells.length * 4).fill(-1);
	const acrossAt = new Int32Array(n).fill(-1);
	const downAt = new Int32Array(n).fill(-1);
	const ends: number[] = [];
	const across: number[] = [];
	const add = (a: number, b: number, isAcross: boolean, between: number[]) => {
		const link = across.length;
		ends.push(a, b);
		across.push(isAcross ? 1 : 0);
		sides[a * 4 + (isAcross ? 1 : 2)] = link;
		sides[b * 4 + (isAcross ? 3 : 0)] = link;
		for (const c of between) (isAcross ? acrossAt : downAt)[c] = link;
	};
	cells.forEach((cell, i) => {
		const r = Math.floor(cell / w);
		const col = cell % w;
		const right: number[] = [];
		for (let x = col + 1; x < w; x++) {
			const at = islandAt[r * w + x];
			if (at >= 0) {
				add(i, at, true, right);
				break;
			}
			right.push(r * w + x);
		}
		const below: number[] = [];
		for (let y = r + 1; y < h; y++) {
			const at = islandAt[y * w + col];
			if (at >= 0) {
				add(i, at, false, below);
				break;
			}
			below.push(y * w + col);
		}
	});
	const crossing: number[][] = across.map(() => []);
	for (let c = 0; c < n; c++) {
		if (acrossAt[c] < 0 || downAt[c] < 0) continue;
		crossing[acrossAt[c]].push(downAt[c]);
		crossing[downAt[c]].push(acrossAt[c]);
	}
	return {
		width: w,
		height: h,
		cells,
		clue,
		islandAt,
		ends: Int32Array.from(ends),
		across: Uint8Array.from(across),
		sides,
		crossing,
		acrossAt,
		downAt
	};
}

const graphs = new WeakMap<object, BridgesGraph>();

/** `bridgesGraph`, kept per puzzle. */
export function graphOf(p: BridgesPuzzle): BridgesGraph {
	let graph = graphs.get(p);
	if (!graph) graphs.set(p, (graph = bridgesGraph(p)));
	return graph;
}

export function emptyBridgesState(p: BridgesPuzzle): BridgesState {
	return { links: new Array<number>(graphOf(p).ends.length / 2).fill(0) };
}

/** The links of island `i`, each once, clockwise from the top. */
export function linksOf(g: BridgesGraph, i: number): number[] {
	const out: number[] = [];
	for (let k = 0; k < 4; k++) if (g.sides[i * 4 + k] >= 0) out.push(g.sides[i * 4 + k]);
	return out;
}

/** The island at the other end of `link` from island `i`. */
export const across = (g: BridgesGraph, link: number, i: number) =>
	g.ends[2 * link] === i ? g.ends[2 * link + 1] : g.ends[2 * link];

/** Whether a link crosses a link with a bridge in `values`. */
export const blocked = (g: BridgesGraph, values: readonly number[], link: number) =>
	g.crossing[link].some((m) => bridgesOf(values[m]) > 0);

/** What the board shows of a position: counts, errors and the groups of joined islands. */
export interface BridgesAnalysis {
	/** Bridges at each island. */
	count: number[];
	/**
	 * Islands that are wrong whatever comes: more bridges than their number, fewer than it and no
	 * room left for the rest, or a group of joined islands with all their bridges that leaves
	 * other islands out.
	 */
	error: boolean[];
	/** Links whose bridges cross another bridge (a position from elsewhere; the board prevents it). */
	crossed: boolean[];
	/** The group of joined islands of each island, as the smallest island in it. */
	group: number[];
	/** How many groups there are. */
	groups: number;
}

export function analyze(p: BridgesPuzzle, s: BridgesState): BridgesAnalysis {
	const g = graphOf(p);
	const islands = g.cells.length;
	const count = new Array<number>(islands).fill(0);
	const parent = Array.from({ length: islands }, (_, i) => i);
	const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
	s.links.forEach((value, link) => {
		const b = bridgesOf(value);
		if (!b) return;
		const [x, y] = [g.ends[2 * link], g.ends[2 * link + 1]];
		count[x] += b;
		count[y] += b;
		const [rx, ry] = [find(x), find(y)];
		if (rx !== ry) parent[Math.max(rx, ry)] = Math.min(rx, ry);
	});
	const group = parent.map((_, i) => find(i));
	const crossed = s.links.map((value, link) => bridgesOf(value) > 0 && blocked(g, s.links, link));
	const error = count.map((n, i) => {
		if (n > g.clue[i]) return true;
		// The most bridges it can still get: each free link up to two, and up to what the island
		// across still takes.
		let room = 0;
		for (const link of linksOf(g, i)) {
			const value = s.links[link];
			if (value === CROSS || value >= MAX_BRIDGES || blocked(g, s.links, link)) continue;
			const other = across(g, link, i);
			room += Math.max(0, Math.min(MAX_BRIDGES - value, g.clue[other] - count[other]));
		}
		return n + room < g.clue[i];
	});
	// A group whose islands all have their bridges is finished: if it is not every island, the
	// others can never join it.
	const done = new Map<number, boolean>();
	group.forEach((root, i) => done.set(root, (done.get(root) ?? true) && count[i] === g.clue[i]));
	const groups = done.size;
	if (groups > 1) group.forEach((root, i) => done.get(root) && (error[i] = true));
	return { count, error, crossed, group, groups };
}

/** Whether every island has its bridges, none cross, and all islands join into one group. */
export function isSolvedState(p: BridgesPuzzle, s: BridgesState): boolean {
	const a = analyze(p, s);
	return (
		a.groups === 1 && a.count.every((n, i) => n === graphOf(p).clue[i]) && !a.crossed.some(Boolean)
	);
}

/** The key of a link as the board names changes, hints and highlights: `l:<link>`. */
export const linkKey = (link: number) => `l:${link}`;
/** The key of an island, by its cell: `c:<cell>`. */
export const islandKey = (g: BridgesGraph, i: number) => `c:${g.cells[i]}`;
