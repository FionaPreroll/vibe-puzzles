export const OPEN = 0;
export const LINE = 1;
export const CROSS = 2;

/** Highest clue a cell can show: four would be a loop of that one cell. */
export const MAX_CLUE = 3;

export interface LoopPuzzle {
	width: number;
	height: number;
	/** One character per cell, row by row: the number of loop edges around it, or '.' for none. */
	clues: string;
}

export interface LoopState {
	/** Horizontal edges h(i, j) on dot row i in 0..H, index i * W + j. */
	h: number[];
	/** Vertical edges v(i, j) on dot column j in 0..W, index i * (W + 1) + j. */
	v: number[];
}

export type EdgeRef = { kind: 'h' | 'v'; i: number; j: number };

export const hIndex = (p: LoopPuzzle, i: number, j: number) => i * p.width + j;
export const vIndex = (p: LoopPuzzle, i: number, j: number) => i * (p.width + 1) + j;

/** The clue of cell `c`, or -1. */
export const clueAt = (p: LoopPuzzle, c: number) => (p.clues[c] === '.' ? -1 : Number(p.clues[c]));

export function emptyLoopState(p: LoopPuzzle): LoopState {
	const { width: w, height: h } = p;
	return { h: new Array((h + 1) * w).fill(OPEN), v: new Array(h * (w + 1)).fill(OPEN) };
}

/**
 * The grid as a graph, with every edge (h edges first, then v edges) numbered in one range, as
 * the solver and the checks use it. Dots are numbered `i * (W + 1) + j`.
 */
export interface LoopGraph {
	edges: number;
	dots: number;
	/** The two dots of each edge. */
	ends: Int32Array;
	/** The edges at each dot, -1 where the dot has fewer than four. */
	dotEdges: Int32Array;
	/** The four edges around each cell: top, bottom, left, right. */
	cellEdges: Int32Array;
}

const graphs = new Map<string, LoopGraph>();

export function loopGraph(w: number, h: number): LoopGraph {
	const key = `${w}x${h}`;
	const known = graphs.get(key);
	if (known) return known;
	const hCount = (h + 1) * w;
	const edges = hCount + h * (w + 1);
	const dots = (h + 1) * (w + 1);
	const dot = (i: number, j: number) => i * (w + 1) + j;
	const ends = new Int32Array(2 * edges);
	const dotEdges = new Int32Array(4 * dots).fill(-1);
	const add = (e: number, a: number, b: number) => {
		ends[2 * e] = a;
		ends[2 * e + 1] = b;
		for (const d of [a, b]) {
			let k = 4 * d;
			while (dotEdges[k] >= 0) k++;
			dotEdges[k] = e;
		}
	};
	for (let i = 0; i <= h; i++) for (let j = 0; j < w; j++) add(i * w + j, dot(i, j), dot(i, j + 1));
	for (let i = 0; i < h; i++) {
		for (let j = 0; j <= w; j++) add(hCount + i * (w + 1) + j, dot(i, j), dot(i + 1, j));
	}
	const cellEdges = new Int32Array(4 * w * h);
	for (let r = 0; r < h; r++) {
		for (let c = 0; c < w; c++) {
			cellEdges.set(
				[r * w + c, (r + 1) * w + c, hCount + r * (w + 1) + c, hCount + r * (w + 1) + c + 1],
				4 * (r * w + c)
			);
		}
	}
	const graph = { edges, dots, ends, dotEdges, cellEdges };
	graphs.set(key, graph);
	return graph;
}

/** The state's edges in the graph's numbering. */
export const edgeValues = (s: LoopState): number[] => [...s.h, ...s.v];

/** A state from edge values in the graph's numbering. */
export function stateFromEdges(p: LoopPuzzle, values: ArrayLike<number>): LoopState {
	const hCount = (p.height + 1) * p.width;
	return {
		h: Array.from(values).slice(0, hCount),
		v: Array.from(values).slice(hCount)
	};
}

/** Edge key as the board uses it, from an edge number. */
export function edgeKey(p: LoopPuzzle, e: number): string {
	const hCount = (p.height + 1) * p.width;
	if (e < hCount) return `h:${Math.floor(e / p.width)}:${e % p.width}`;
	const k = e - hCount;
	return `v:${Math.floor(k / (p.width + 1))}:${k % (p.width + 1)}`;
}

export interface LoopAnalysis {
	/** Lines around each cell. */
	count: number[];
	/** Cells whose clue the lines contradict: too many lines, or too many crosses. */
	clueError: boolean[];
	/** Dots with more than two lines, or a dead end that crosses close off. */
	dotError: boolean[];
	/** Number of separate line pieces (closed loops and open paths). */
	pieces: number;
	/** Whether some piece is a closed loop. */
	closed: boolean;
}

export function analyze(p: LoopPuzzle, s: LoopState): LoopAnalysis {
	const g = loopGraph(p.width, p.height);
	const values = edgeValues(s);
	const n = p.width * p.height;
	const count = new Array<number>(n).fill(0);
	const clueError = new Array<boolean>(n).fill(false);
	for (let c = 0; c < n; c++) {
		let lines = 0;
		let crosses = 0;
		for (let k = 0; k < 4; k++) {
			const value = values[g.cellEdges[4 * c + k]];
			if (value === LINE) lines++;
			else if (value === CROSS) crosses++;
		}
		count[c] = lines;
		const clue = clueAt(p, c);
		clueError[c] = clue >= 0 && (lines > clue || 4 - crosses < clue);
	}
	const degree = new Array<number>(g.dots).fill(0);
	const open = new Array<number>(g.dots).fill(0);
	values.forEach((value, e) => {
		for (const d of [g.ends[2 * e], g.ends[2 * e + 1]]) {
			if (value === LINE) degree[d]++;
			else if (value === OPEN) open[d]++;
		}
	});
	const dotError = degree.map((d, k) => d > 2 || (d === 1 && open[k] === 0));
	// Line pieces: union the dots along lines, then count the groups and look for cycles.
	const parent = Array.from({ length: g.dots }, (_, i) => i);
	const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
	let closed = false;
	values.forEach((value, e) => {
		if (value !== LINE) return;
		const [a, b] = [find(g.ends[2 * e]), find(g.ends[2 * e + 1])];
		if (a === b) closed = true;
		else parent[a] = b;
	});
	const roots = new Set<number>();
	degree.forEach((d, k) => d > 0 && roots.add(find(k)));
	return { count, clueError, dotError, pieces: roots.size, closed };
}

/** Solved: the lines form one closed loop without branches, and every clue holds. */
export function isSolvedState(p: LoopPuzzle, s: LoopState): boolean {
	const a = analyze(p, s);
	if (a.pieces !== 1 || !a.closed) return false;
	for (let c = 0; c < a.count.length; c++) {
		const clue = clueAt(p, c);
		if (clue >= 0 && a.count[c] !== clue) return false;
	}
	// One piece with a cycle and no dot of degree 3 or 4 is a single simple loop.
	const g = loopGraph(p.width, p.height);
	const degree = new Array<number>(g.dots).fill(0);
	edgeValues(s).forEach((value, e) => {
		if (value !== LINE) return;
		degree[g.ends[2 * e]]++;
		degree[g.ends[2 * e + 1]]++;
	});
	return degree.every((d) => d === 0 || d === 2);
}
