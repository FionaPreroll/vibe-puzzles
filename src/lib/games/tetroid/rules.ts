import { neighbours } from '../../core/grid';
import { classify, type TetType } from './shapes';

export const EMPTY = 0;
export const SHADED = 1;
export const CROSS = 2;

export interface TetroidPuzzle {
	width: number;
	height: number;
	/** Region index of every cell, row by row. Regions are numbered 0..N-1. */
	regions: number[];
}

export interface TetroidState {
	/** EMPTY, SHADED or CROSS per cell. */
	marks: number[];
	/** 1 where a cross was placed by an auto-cross helper. */
	auto: number[];
}

export interface TetroidAnalysis {
	regionCells: number[][];
	regionType: (TetType | null)[];
	complete: boolean[];
	/** Cells marked by error highlighting. */
	errors: boolean[];
	/** Shaded group id per cell (-1 when not shaded). */
	groups: number[];
}

export function regionCount(p: TetroidPuzzle): number {
	return Math.max(-1, ...p.regions) + 1;
}

export function cellsByRegion(p: TetroidPuzzle): number[][] {
	const out: number[][] = Array.from({ length: regionCount(p) }, () => []);
	p.regions.forEach((r, i) => out[r].push(i));
	return out;
}

/** Connected components of the cells accepted by `inSet`, in reading order of their first cell. */
function components(p: TetroidPuzzle, inSet: (i: number) => boolean): number[][] {
	const seen = new Uint8Array(p.regions.length);
	const out: number[][] = [];
	for (let start = 0; start < p.regions.length; start++) {
		if (seen[start] || !inSet(start)) continue;
		const comp = [start];
		seen[start] = 1;
		for (let k = 0; k < comp.length; k++) {
			for (const n of neighbours(comp[k], p.width, p.height)) {
				if (!seen[n] && inSet(n)) {
					seen[n] = 1;
					comp.push(n);
				}
			}
		}
		out.push(comp);
	}
	return out;
}

/** Top-left corners of fully shaded 2×2 squares. */
function shadedSquares(p: TetroidPuzzle, shaded: (i: number) => boolean): number[] {
	const out: number[] = [];
	const w = p.width;
	for (let r = 0; r < p.height - 1; r++) {
		for (let c = 0; c < w - 1; c++) {
			const i = r * w + c;
			if (shaded(i) && shaded(i + 1) && shaded(i + w) && shaded(i + w + 1)) out.push(i);
		}
	}
	return out;
}

export function analyze(p: TetroidPuzzle, marks: readonly number[]): TetroidAnalysis {
	const w = p.width;
	const n = p.regions.length;
	const isShaded = (i: number) => marks[i] === SHADED;
	const regionCells = cellsByRegion(p);
	const errors: boolean[] = new Array(n).fill(false);
	const mark = (cells: Iterable<number>) => {
		for (const i of cells) errors[i] = true;
	};

	const regionType: (TetType | null)[] = [];
	const complete: boolean[] = [];
	for (const cells of regionCells) {
		const shaded = cells.filter(isShaded);
		const empty = cells.filter((i) => marks[i] === EMPTY).length;
		const type = shaded.length === 4 ? classify(shaded, w) : null;
		regionType.push(type);
		complete.push(type !== null);
		if (shaded.length > 4) mark(shaded);
		else if (shaded.length < 4 && empty === 0) mark(cells);
		else if (shaded.length === 4 && type === null) mark(cells);
	}

	// Equal types touching across a region border.
	for (let i = 0; i < n; i++) {
		if (!isShaded(i)) continue;
		const a = p.regions[i];
		for (const j of neighbours(i, w, p.height)) {
			const b = p.regions[j];
			if (b !== a && isShaded(j) && regionType[a] && regionType[a] === regionType[b]) {
				mark(regionCells[a]);
				mark(regionCells[b]);
			}
		}
	}

	for (const i of shadedSquares(p, isShaded)) mark([i, i + 1, i + w, i + w + 1]);

	// Connectivity: potential areas are components of non-cross cells holding a shaded cell.
	const areas = components(p, (i) => marks[i] !== CROSS).filter((c) => c.some(isShaded));
	if (areas.length > 1) {
		let largest = 0;
		areas.forEach((a, k) => {
			if (a.length > areas[largest].length) largest = k;
		});
		areas.forEach((a, k) => {
			if (k !== largest) mark(a.filter(isShaded));
		});
	}

	const groups: number[] = new Array(n).fill(-1);
	components(p, isShaded).forEach((comp, g) => comp.forEach((i) => (groups[i] = g)));

	return { regionCells, regionType, complete, errors, groups };
}

/** True when the shaded cells satisfy all rules. Crosses count as unshaded. */
export function isSolvedMarks(p: TetroidPuzzle, shaded: (i: number) => boolean): boolean {
	const w = p.width;
	const regionCells = cellsByRegion(p);
	const types: (TetType | null)[] = [];
	for (const cells of regionCells) {
		const type = classify(cells.filter(shaded), w);
		if (!type) return false;
		types.push(type);
	}
	for (let i = 0; i < p.regions.length; i++) {
		if (!shaded(i)) continue;
		for (const j of neighbours(i, w, p.height)) {
			const a = p.regions[i];
			const b = p.regions[j];
			if (a !== b && shaded(j) && types[a] === types[b]) return false;
		}
	}
	if (shadedSquares(p, shaded).length > 0) return false;
	return components(p, shaded).length === 1;
}

/**
 * Auto-cross helpers (spec 5.5): place crosses on empty cells that are the fourth corner of a
 * shaded 2×2 or lie in a complete region, and remove auto crosses that are no longer needed.
 */
export function applyAutoCrosses(
	p: TetroidPuzzle,
	state: TetroidState,
	corners: boolean,
	completed: boolean
): TetroidState {
	if (!corners && !completed) return state;
	const w = p.width;
	const marks = state.marks.slice();
	const auto = state.auto.slice();
	const shaded = (i: number) => marks[i] === SHADED;
	const needed = new Uint8Array(marks.length);

	if (corners) {
		for (let r = 0; r < p.height - 1; r++) {
			for (let c = 0; c < w - 1; c++) {
				const sq = [r * w + c, r * w + c + 1, (r + 1) * w + c, (r + 1) * w + c + 1];
				const open = sq.filter((i) => !shaded(i));
				if (open.length === 1) needed[open[0]] = 1;
			}
		}
	}
	if (completed) {
		const { regionCells, complete } = analyze(p, marks);
		regionCells.forEach((cells, k) => {
			if (complete[k]) for (const i of cells) if (!shaded(i)) needed[i] = 1;
		});
	}

	let changed = false;
	for (let i = 0; i < marks.length; i++) {
		if (marks[i] === EMPTY && needed[i]) {
			marks[i] = CROSS;
			auto[i] = 1;
			changed = true;
		} else if (marks[i] === CROSS && auto[i] && !needed[i]) {
			marks[i] = EMPTY;
			auto[i] = 0;
			changed = true;
		}
	}
	return changed ? { marks, auto } : state;
}
