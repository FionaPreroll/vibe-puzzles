export const OPEN = 0;
export const LINE = 1;
export const CROSS = 2;

export interface PinwheelPuzzle {
	width: number;
	height: number;
	/** Centre positions in half-grid coordinates [hr, hc]. */
	centres: [number, number][];
}

export interface PinwheelState {
	/** Horizontal edges h(i, j), index i * W + j, i in 0..H. Border rows are ignored. */
	h: number[];
	/** Vertical edges v(i, j), index i * (W + 1) + j, j in 0..W. Border columns are ignored. */
	v: number[];
	/** Note colour per cell, 0 = none. */
	colors: number[];
	/** 1 per locked centre. */
	locks: number[];
}

export type EdgeRef = { kind: 'h' | 'v'; i: number; j: number };

export const hIndex = (p: PinwheelPuzzle, i: number, j: number) => i * p.width + j;
export const vIndex = (p: PinwheelPuzzle, i: number, j: number) => i * (p.width + 1) + j;

export function emptyPinwheelState(p: PinwheelPuzzle): PinwheelState {
	const { width: w, height: h } = p;
	return {
		h: new Array((h + 1) * w).fill(OPEN),
		v: new Array(h * (w + 1)).fill(OPEN),
		colors: new Array(w * h).fill(0),
		locks: new Array(p.centres.length).fill(0)
	};
}

/** Cells covered by a centre (1, 2 or 4 cells). */
export function coveredCells(p: PinwheelPuzzle, [hr, hc]: [number, number]): number[] {
	const rows = hr % 2 === 0 ? [hr / 2] : [(hr - 1) / 2, (hr + 1) / 2];
	const cols = hc % 2 === 0 ? [hc / 2] : [(hc - 1) / 2, (hc + 1) / 2];
	return rows.flatMap((r) => cols.map((c) => r * p.width + c));
}

/** Mirror of cell `i` through a centre, or -1 if outside the grid. */
export function mirrorCell(p: PinwheelPuzzle, i: number, [hr, hc]: [number, number]): number {
	const r = hr - Math.floor(i / p.width);
	const c = hc - (i % p.width);
	return r < 0 || c < 0 || r >= p.height || c >= p.width ? -1 : r * p.width + c;
}

/** Whether an edge touches a centre (on its midpoint or an end dot) and can never be marked. */
export function isBlocked(p: PinwheelPuzzle, kind: 'h' | 'v', i: number, j: number): boolean {
	for (const [hr, hc] of p.centres) {
		if (kind === 'h') {
			if (hr === 2 * i - 1 && hc >= 2 * j - 1 && hc <= 2 * j + 1) return true;
		} else if (hc === 2 * j - 1 && hr >= 2 * i - 1 && hr <= 2 * i + 1) return true;
	}
	return false;
}

/** Interior edges as [kind, i, j, cellA, cellB]. */
export function interiorEdges(
	p: PinwheelPuzzle
): { kind: 'h' | 'v'; i: number; j: number; a: number; b: number }[] {
	const { width: w, height: h } = p;
	const out: { kind: 'h' | 'v'; i: number; j: number; a: number; b: number }[] = [];
	for (let i = 1; i < h; i++) {
		for (let j = 0; j < w; j++) out.push({ kind: 'h', i, j, a: (i - 1) * w + j, b: i * w + j });
	}
	for (let i = 0; i < h; i++) {
		for (let j = 1; j < w; j++) out.push({ kind: 'v', i, j, a: i * w + j - 1, b: i * w + j });
	}
	return out;
}

export function edgeValue(
	p: PinwheelPuzzle,
	s: PinwheelState,
	kind: 'h' | 'v',
	i: number,
	j: number
) {
	return kind === 'h' ? s.h[hIndex(p, i, j)] : s.v[vIndex(p, i, j)];
}

export interface PinwheelAnalysis {
	/** Region id per cell. */
	region: number[];
	regionCells: number[][];
	/** Centre indices per region. */
	regionCentres: number[][];
	complete: boolean[];
	/** Region per centre. */
	centreRegion: number[];
	centreError: boolean[];
	cellError: boolean[];
}

export function analyze(p: PinwheelPuzzle, s: PinwheelState): PinwheelAnalysis {
	const { width: w, height: h } = p;
	const n = w * h;
	const parent = Array.from({ length: n }, (_, i) => i);
	const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
	const edges = interiorEdges(p);
	for (const e of edges) {
		if (edgeValue(p, s, e.kind, e.i, e.j) !== LINE) parent[find(e.a)] = find(e.b);
	}
	const ids = new Map<number, number>();
	const region = new Array<number>(n);
	const regionCells: number[][] = [];
	for (let i = 0; i < n; i++) {
		const root = find(i);
		if (!ids.has(root)) {
			ids.set(root, regionCells.length);
			regionCells.push([]);
		}
		region[i] = ids.get(root)!;
		regionCells[region[i]].push(i);
	}
	const regionCentres: number[][] = regionCells.map(() => []);
	const centreRegion = p.centres.map((c, k) => {
		const r = region[coveredCells(p, c)[0]];
		regionCentres[r].push(k);
		return r;
	});
	const selfNeighbour = new Array(regionCells.length).fill(false);
	for (const e of edges) {
		if (edgeValue(p, s, e.kind, e.i, e.j) === LINE && region[e.a] === region[e.b]) {
			selfNeighbour[region[e.a]] = true;
		}
	}
	const complete = regionCells.map((cells, r) => {
		if (regionCentres[r].length !== 1 || selfNeighbour[r]) return false;
		const centre = p.centres[regionCentres[r][0]];
		return cells.every((i) => {
			const m = mirrorCell(p, i, centre);
			return m >= 0 && region[m] === r;
		});
	});
	const centreError = p.centres.map((_, k) => {
		const r = centreRegion[k];
		return regionCentres[r].length === 1 && !complete[r];
	});
	const cellError = region.map((r) => regionCentres[r].length === 0);
	return { region, regionCells, regionCentres, complete, centreRegion, centreError, cellError };
}

export function isSolvedState(p: PinwheelPuzzle, s: PinwheelState): boolean {
	return analyze(p, s).complete.every(Boolean);
}

/**
 * Colour-based acceptance (spec 7.2): treat edges between differently coloured cells as lines.
 * Returns the state with those lines added if that solves the board, otherwise null.
 */
export function acceptByColours(p: PinwheelPuzzle, s: PinwheelState): PinwheelState | null {
	const next: PinwheelState = { ...s, h: s.h.slice(), v: s.v.slice() };
	let added = false;
	for (const e of interiorEdges(p)) {
		if (s.colors[e.a] === s.colors[e.b] || edgeValue(p, s, e.kind, e.i, e.j) === LINE) continue;
		if (e.kind === 'h') next.h[hIndex(p, e.i, e.j)] = LINE;
		else next.v[vIndex(p, e.i, e.j)] = LINE;
		added = true;
	}
	return added && isSolvedState(p, next) ? next : null;
}

/** Edge keys frozen by locked centres: all edges around every cell of a locked region. */
export function frozenEdges(p: PinwheelPuzzle, s: PinwheelState, a: PinwheelAnalysis): Set<string> {
	const out = new Set<string>();
	const w = p.width;
	s.locks.forEach((locked, k) => {
		if (!locked) return;
		for (const cell of a.regionCells[a.centreRegion[k]]) {
			const r = Math.floor(cell / w);
			const c = cell % w;
			out
				.add(`h:${r}:${c}`)
				.add(`h:${r + 1}:${c}`)
				.add(`v:${r}:${c}`)
				.add(`v:${r}:${c + 1}`);
		}
	});
	return out;
}

/** Solution lines (edges between cells of different galaxies) from a cell → centre assignment. */
export function linesFromAssignment(p: PinwheelPuzzle, owner: ArrayLike<number>): PinwheelState {
	const s = emptyPinwheelState(p);
	for (const e of interiorEdges(p)) {
		if (owner[e.a] === owner[e.b]) continue;
		if (e.kind === 'h') s.h[hIndex(p, e.i, e.j)] = LINE;
		else s.v[vIndex(p, e.i, e.j)] = LINE;
	}
	return s;
}
