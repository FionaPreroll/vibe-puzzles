import type { BasePuzzle } from '../../core/types';

/**
 * Pipes: every cell holds a tile with a pipe that leads to one, two or three of its sides. The
 * player turns the tiles until all pipes join into one network without loose ends and without
 * loops. A tile is the set of sides its pipe opens to, as bits.
 */
export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;
/** The sides clockwise from the top, by their index 0 to 3: side `k` is the bit `1 << k`. */
export const SIDES = [UP, RIGHT, DOWN, LEFT] as const;

export interface PipesPuzzle extends BasePuzzle {
	/** Opposite edges of the board touch: a pipe that leaves it on one side comes back on the other. */
	wrap: boolean;
	/**
	 * The tiles as dealt, one hex digit per cell in reading order: the sides the pipe opens to
	 * (UP 1, RIGHT 2, DOWN 4, LEFT 8). Every tile has one to three openings.
	 */
	tiles: string;
}

export interface PipesState {
	/** Each tile's openings as the player turned it. */
	tiles: number[];
	/** 1 for a tile the player locked: it does not turn until it is unlocked. */
	locks: number[];
	/**
	 * The player's marks on the sides between tiles (see `markAt`), left out while there are none:
	 * saves from before marks look the same.
	 */
	marks?: number[];
}

/** `mask` turned clockwise by `quarters` quarter turns (negative: anticlockwise). */
export function turn(mask: number, quarters: number): number {
	const q = ((quarters % 4) + 4) % 4;
	return ((mask << q) | (mask >> (4 - q))) & 15;
}

/** The different ways a tile can lie: four, or two for a straight pipe. */
export function turnsOf(mask: number): number[] {
	const out: number[] = [];
	for (let q = 0; q < 4; q++) {
		const m = turn(mask, q);
		if (!out.includes(m)) out.push(m);
	}
	return out;
}

/** The side across from side bit `side`. */
export const opposite = (side: number) => turn(side, 2);

/** Number of openings of a tile. */
export const openings = (mask: number) =>
	(mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);

/** The kinds of tile, by their openings: an end, a straight, a corner or a T. */
export type TileKind = 'end' | 'straight' | 'corner' | 'tee';

export function kindOf(mask: number): TileKind {
	const n = openings(mask);
	if (n === 1) return 'end';
	if (n === 3) return 'tee';
	return mask === (UP | DOWN) || mask === (LEFT | RIGHT) ? 'straight' : 'corner';
}

/** The tiles as dealt. */
export function dealt(p: PipesPuzzle): number[] {
	return Array.from(p.tiles, (ch) => parseInt(ch, 16));
}

/** The cell of the source, where the water comes from: the middle of the board. */
export const sourceOf = (p: Pick<PipesPuzzle, 'width' | 'height'>) =>
	Math.floor(p.height / 2) * p.width + Math.floor(p.width / 2);

/**
 * The neighbours of every cell by side, `out[cell * 4 + k]` for side `k` (0 up to 3 left), -1
 * beyond the edge of a board without wrap.
 */
export function neighbourTable(p: Pick<PipesPuzzle, 'width' | 'height' | 'wrap'>): Int32Array {
	const { width: w, height: h, wrap } = p;
	const out = new Int32Array(w * h * 4);
	for (let c = 0; c < w * h; c++) {
		const r = Math.floor(c / w);
		const col = c % w;
		const at = (rr: number, cc: number) => {
			if (wrap) return ((rr + h) % h) * w + ((cc + w) % w);
			return rr < 0 || rr >= h || cc < 0 || cc >= w ? -1 : rr * w + cc;
		};
		out[c * 4] = at(r - 1, col);
		out[c * 4 + 1] = at(r, col + 1);
		out[c * 4 + 2] = at(r + 1, col);
		out[c * 4 + 3] = at(r, col - 1);
	}
	return out;
}

const tables = new WeakMap<object, Int32Array>();

/** `neighbourTable`, kept per puzzle. */
export function neighboursOf(p: PipesPuzzle): Int32Array {
	let table = tables.get(p);
	if (!table) tables.set(p, (table = neighbourTable(p)));
	return table;
}

export function emptyPipesState(p: PipesPuzzle): PipesState {
	const tiles = dealt(p);
	return { tiles, locks: tiles.map(() => 0) };
}

/** What the board shows of a position: where the water reaches, and what is wrong for sure. */
export interface PipesAnalysis {
	/** Tiles joined to the source by pipes that meet. */
	water: boolean[];
	/** How many tiles that is. */
	reached: number;
	/**
	 * Per tile, the openings that are wrong whatever the other tiles do: one that leads off a
	 * board without wrap, one on a loop, every opening of a group of tiles closed off from the
	 * rest, and one that meets a locked tile without an opening back while locked itself.
	 */
	errors: number[];
	/** Every opening meets another one: no loose ends. */
	closed: boolean;
}

/**
 * The connections between neighbouring tiles that both open to their shared side, per tile as
 * the bits of those sides.
 */
export function connections(p: PipesPuzzle, tiles: readonly number[]): number[] {
	const nb = neighboursOf(p);
	return tiles.map((mask, c) => {
		let met = 0;
		for (let k = 0; k < 4; k++) {
			const side = 1 << k;
			if (!(mask & side)) continue;
			const n = nb[c * 4 + k];
			if (n >= 0 && tiles[n] & (1 << ((k + 2) % 4))) met |= side;
		}
		return met;
	});
}

/** The tiles reached from `from` along `met` (see `connections`), as a flag per tile. */
export function reach(p: PipesPuzzle, met: readonly number[], from: number): boolean[] {
	const nb = neighboursOf(p);
	const seen = met.map(() => false);
	const stack = [from];
	seen[from] = true;
	while (stack.length) {
		const c = stack.pop()!;
		for (let k = 0; k < 4; k++) {
			if (!(met[c] & (1 << k))) continue;
			const n = nb[c * 4 + k];
			if (!seen[n]) {
				seen[n] = true;
				stack.push(n);
			}
		}
	}
	return seen;
}

/**
 * The connections that lie on a loop, per tile as the bits of their sides: those that are not
 * bridges of the network of connections (Tarjan's bridge search, without recursion).
 */
export function loopSides(p: PipesPuzzle, met: readonly number[]): number[] {
	const nb = neighboursOf(p);
	const n = met.length;
	const disc = new Int32Array(n).fill(-1);
	const low = new Int32Array(n);
	const out = new Array<number>(n).fill(0);
	let time = 0;
	// Each frame: the cell, the side it was entered by (-1 for a root) and the next side to try.
	const cells: number[] = [];
	const entered: number[] = [];
	const next: number[] = [];
	for (let root = 0; root < n; root++) {
		if (disc[root] >= 0 || !met[root]) continue;
		disc[root] = low[root] = time++;
		cells.push(root);
		entered.push(-1);
		next.push(0);
		while (cells.length) {
			const top = cells.length - 1;
			const c = cells[top];
			const k = next[top]++;
			if (k < 4) {
				if (!(met[c] & (1 << k)) || k === entered[top]) continue;
				const m = nb[c * 4 + k];
				if (disc[m] < 0) {
					disc[m] = low[m] = time++;
					cells.push(m);
					entered.push((k + 2) % 4);
					next.push(0);
				} else {
					// A pipe to a tile met before closes a loop.
					low[c] = Math.min(low[c], disc[m]);
					out[c] |= 1 << k;
					out[m] |= 1 << ((k + 2) % 4);
				}
				continue;
			}
			cells.pop();
			const from = entered.pop()!;
			next.pop();
			if (from < 0) continue;
			const parent = nb[c * 4 + from];
			low[parent] = Math.min(low[parent], low[c]);
			if (low[c] <= disc[parent]) {
				// Not a bridge: the edge between the parent and this cell lies on a loop.
				out[c] |= 1 << from;
				out[parent] |= 1 << ((from + 2) % 4);
			}
		}
	}
	return out;
}

export function analyze(
	p: PipesPuzzle,
	tiles: readonly number[],
	locks?: readonly number[]
): PipesAnalysis {
	const nb = neighboursOf(p);
	const n = tiles.length;
	const met = connections(p, tiles);
	const water = reach(p, met, sourceOf(p));
	const reached = water.filter(Boolean).length;
	const errors = loopSides(p, met);
	let closed = true;

	// Groups of tiles joined by connections, and whether each still has a loose end.
	const group = new Int32Array(n).fill(-1);
	const loose: boolean[] = [];
	const sizes: number[] = [];
	for (let start = 0; start < n; start++) {
		if (group[start] >= 0) continue;
		const g = sizes.length;
		let size = 0;
		let open = false;
		const stack = [start];
		group[start] = g;
		while (stack.length) {
			const c = stack.pop()!;
			size++;
			if (tiles[c] !== met[c]) open = true;
			for (let k = 0; k < 4; k++) {
				if (!(met[c] & (1 << k))) continue;
				const m = nb[c * 4 + k];
				if (group[m] < 0) {
					group[m] = g;
					stack.push(m);
				}
			}
		}
		sizes.push(size);
		loose.push(open);
		if (open) closed = false;
	}

	for (let c = 0; c < n; c++) {
		const g = group[c];
		// A group without loose ends that leaves tiles out can never join them.
		if (!loose[g] && sizes[g] < n) errors[c] |= tiles[c];
		for (let k = 0; k < 4; k++) {
			const side = 1 << k;
			if (!(tiles[c] & side) || met[c] & side) continue;
			const m = nb[c * 4 + k];
			if (m < 0 || (locks?.[c] && locks[m])) errors[c] |= side;
		}
	}
	return { water, reached, errors, closed };
}

// ---- The player's marks on the sides between tiles ---------------------------------------------

/** A mark on the side between two tiles: none, "=" (a pipe joins them) or "x" (none does). */
export const NO_MARK = 0;
export const JOIN = 1;
export const CROSS = 2;

/**
 * The marks lie on the sides between tiles, not on the tiles, so they stay put when a tile turns.
 * `marks[c]` holds the mark on the right side of tile `c` in its low two bits and the one on its
 * lower side in the next two; the left and upper sides are those of the neighbours. A board
 * without wrap has no marks on its edge.
 */
const SHIFT = [-1, 0, 2, -1];

/** Where the mark on side `k` of tile `c` is kept: a tile and the shift of its bits, or null. */
function markPlace(p: PipesPuzzle, c: number, k: number): [number, number] | null {
	const n = neighboursOf(p)[c * 4 + k];
	if (n < 0) return null;
	return k === 1 || k === 2 ? [c, SHIFT[k]] : [n, SHIFT[(k + 2) % 4]];
}

/** The mark on side `k` (0 up to 3 left) of tile `c`. */
export function markAt(p: PipesPuzzle, marks: readonly number[] | undefined, c: number, k: number) {
	const at = markPlace(p, c, k);
	return at && marks ? (marks[at[0]] >> at[1]) & 3 : NO_MARK;
}

/** Whether side `k` of tile `c` takes a mark: it lies between two tiles. */
export const markable = (p: PipesPuzzle, c: number, k: number) => markPlace(p, c, k) !== null;

/** `marks` with the mark on side `k` of tile `c` set to `mark`. */
export function withMark(
	p: PipesPuzzle,
	marks: readonly number[] | undefined,
	c: number,
	k: number,
	mark: number
): number[] {
	const out = marks ? marks.slice() : new Array<number>(p.width * p.height).fill(0);
	const at = markPlace(p, c, k);
	if (at) out[at[0]] = (out[at[0]] & ~(3 << at[1])) | (mark << at[1]);
	return out;
}

/** `s` with the marks `marks`, which it leaves out when there are none. */
export function withMarks(s: PipesState, marks: readonly number[] | undefined): PipesState {
	const { tiles, locks } = s;
	return marks?.some(Boolean) ? { tiles, locks, marks: marks.slice() } : { tiles, locks };
}

/**
 * The key of the side `k` of tile `c` that the boards name changes and hints by: `r:<tile>` for
 * the right side of a tile, `d:<tile>` for its lower side. Tiles are plain numbers.
 */
export function markKey(p: PipesPuzzle, c: number, k: number): string {
	const at = markPlace(p, c, k)!;
	return `${at[1] ? 'd' : 'r'}:${at[0]}`;
}

/** The tile and side of a mark's key; null for any other key. */
export function parseMarkKey(key: string): { cell: number; side: number } | null {
	const m = /^([rd]):(\d+)$/.exec(key);
	return m ? { cell: Number(m[2]), side: m[1] === 'r' ? 1 : 2 } : null;
}

/** The keys of the sides whose marks differ between `from` and `to`. */
export function changedMarks(from: readonly number[] = [], to: readonly number[] = []): string[] {
	const out: string[] = [];
	for (let c = 0; c < Math.max(from.length, to.length); c++) {
		const diff = (from[c] ?? 0) ^ (to[c] ?? 0);
		if (diff & 3) out.push(`r:${c}`);
		if (diff & 12) out.push(`d:${c}`);
	}
	return out;
}

/** Every mark as its side, `[tile, side, mark]`, each side once (a tile's right or lower side). */
export function markList(marks: readonly number[] | undefined): [number, number, number][] {
	const out: [number, number, number][] = [];
	marks?.forEach((m, c) => {
		if (m & 3) out.push([c, 1, m & 3]);
		if (m & 12) out.push([c, 2, (m >> 2) & 3]);
	});
	return out;
}

/** Whether `marks` can be a position's marks on `p`: two bits per side, none off the board. */
export function validMarks(p: PipesPuzzle, marks: unknown): marks is number[] {
	const n = p.width * p.height;
	if (!Array.isArray(marks) || marks.length !== n) return false;
	return marks.every((m, c) => {
		if (!Number.isInteger(m) || m < 0 || m > 15 || (m & 3) === 3 || (m & 12) === 12) return false;
		return ((m & 3) === 0 || markable(p, c, 1)) && ((m & 12) === 0 || markable(p, c, 2));
	});
}

/** Per tile, the sides marked "=" and those marked "x", as bits like a tile's openings. */
export function markedSides(p: PipesPuzzle, marks: readonly number[] | undefined) {
	const n = p.width * p.height;
	const joins = new Array<number>(n).fill(0);
	const crosses = new Array<number>(n).fill(0);
	if (marks) {
		const nb = neighboursOf(p);
		for (const [c, k, mark] of markList(marks)) {
			const out = mark === JOIN ? joins : crosses;
			out[c] |= 1 << k;
			out[nb[c * 4 + k]] |= 1 << ((k + 2) % 4);
		}
	}
	return { joins, crosses };
}

/** Whether a tile lying as `mask` keeps to its marks: open where "=", closed where "x". */
export const fitsMarks = (mask: number, joins: number, crosses: number) =>
	(mask & joins) === joins && (mask & crosses) === 0;

/** Per tile, whether no way of turning it keeps to its marks. */
export function unfitTiles(p: PipesPuzzle, s: PipesState): boolean[] {
	const { joins, crosses } = markedSides(p, s.marks);
	return s.tiles.map(
		(mask, c) =>
			(joins[c] | crosses[c]) !== 0 &&
			!turnsOf(mask).some((m) => fitsMarks(m, joins[c], crosses[c]))
	);
}

/**
 * How far to turn tile `c` to the next way that keeps to its marks, in quarters `dir` (1:
 * clockwise, -1: back): 0 when only the way it lies does, null when it has no marks or no way
 * keeps to them (then it turns as usual).
 */
export function turnToMarks(p: PipesPuzzle, s: PipesState, c: number, dir: number): number | null {
	if (!s.marks) return null;
	const { joins, crosses } = markedSides(p, s.marks);
	if (!(joins[c] | crosses[c])) return null;
	const mask = s.tiles[c];
	let fits = false;
	for (let q = 1; q <= 4; q++) {
		const next = turn(mask, dir * q);
		if (!fitsMarks(next, joins[c], crosses[c])) continue;
		if (next !== mask) return dir * q;
		fits = true;
	}
	return fits ? 0 : null;
}

/** Whether the tiles join into one network without loose ends (and so without loops). */
export function isSolvedTiles(p: PipesPuzzle, tiles: readonly number[]): boolean {
	const met = connections(p, tiles);
	for (let c = 0; c < tiles.length; c++) if (met[c] !== tiles[c]) return false;
	return reach(p, met, sourceOf(p)).every(Boolean);
}
