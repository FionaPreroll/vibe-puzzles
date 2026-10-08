import { latinConflicts, type Cage } from './calc/rules';

export interface SudokuPuzzle {
	/** Grid size (also the number of digits). Width and height are equal. */
	width: number;
	height: number;
	/** Given digit per cell, row by row; 0 = empty. */
	givens: number[];
	/** Calcudoku only: the cages. Such a grid has no boxes. */
	cages?: Cage[];
}

/** Whether the puzzle has boxes (classic Sudoku) or just rows and columns (Calcudoku). */
export const hasBoxes = (p: SudokuPuzzle) => !p.cages;

export interface SudokuState {
	/** Digit entered by the player per cell (0 = none). Always 0 on given cells. */
	values: number[];
	/** Pencil marks per cell as a bit mask: bit `d - 1` set = small digit `d` noted. */
	notes: number[];
}

/** Box width and height for a grid size: 4 → 2×2, 6 → 3×2, 9 → 3×3. */
export function boxShape(size: number): { w: number; h: number } {
	const h = Math.floor(Math.sqrt(size));
	for (let bh = h; bh > 1; bh--) if (size % bh === 0) return { w: size / bh, h: bh };
	return { w: size, h: 1 };
}

export const SIZES = [4, 6, 9];

/** Mask with all digits 1..size noted. */
export const allMask = (size: number) => (1 << size) - 1;
export const bit = (d: number) => 1 << (d - 1);

export function popcount(mask: number): number {
	let n = 0;
	for (; mask; mask &= mask - 1) n++;
	return n;
}

/** Digits (1-based) contained in a mask, ascending. */
export function digitsOf(mask: number): number[] {
	const out: number[] = [];
	for (let d = 1; mask >> (d - 1); d++) if (mask & bit(d)) out.push(d);
	return out;
}

export interface Geometry {
	size: number;
	/** Rows, then columns, then boxes; each a list of cell indices. */
	units: number[][];
	/** Indices into `units` (row, column, box) per cell. */
	unitsOf: [number, number, number][];
	/** Cells sharing a row, column or box with each cell, without the cell itself. */
	peers: number[][];
	box: number[];
}

const geometries = new Map<number, Geometry>();

export function geometry(size: number): Geometry {
	let g = geometries.get(size);
	if (g) return g;
	const { w: bw, h: bh } = boxShape(size);
	const n = size * size;
	const box = Array.from({ length: n }, (_, i) => {
		const r = Math.floor(i / size);
		const c = i % size;
		return Math.floor(r / bh) * (size / bw) + Math.floor(c / bw);
	});
	const units: number[][] = Array.from({ length: 3 * size }, () => []);
	const unitsOf: [number, number, number][] = [];
	for (let i = 0; i < n; i++) {
		const r = Math.floor(i / size);
		const c = i % size;
		units[r].push(i);
		units[size + c].push(i);
		units[2 * size + box[i]].push(i);
		unitsOf.push([r, size + c, 2 * size + box[i]]);
	}
	const peers = unitsOf.map((us, i) => {
		const set = new Set(us.flatMap((u) => units[u]));
		set.delete(i);
		return [...set].sort((a, b) => a - b);
	});
	g = { size, units, unitsOf, peers, box };
	geometries.set(size, g);
	return g;
}

export function emptySudokuState(p: SudokuPuzzle): SudokuState {
	const n = p.givens.length;
	return { values: new Array(n).fill(0), notes: new Array(n).fill(0) };
}

/** The digit shown in every cell: the given, else the player's entry, else 0. */
export function currentGrid(p: SudokuPuzzle, s: SudokuState): number[] {
	return p.givens.map((g, i) => g || s.values[i]);
}

/** Cells sharing a row or column with cell `i`, without boxes. */
function linePeers(size: number, i: number): number[] {
	const r = Math.floor(i / size);
	const c = i % size;
	const out: number[] = [];
	for (let k = 0; k < size; k++) {
		if (k !== c) out.push(r * size + k);
		if (k !== r) out.push(k * size + c);
	}
	return out;
}

/** Digits that can still go in cell `i` without repeating one in its row, column or box. */
export function candidates(size: number, grid: readonly number[], i: number, boxes = true): number {
	let mask = allMask(size);
	const peers = boxes ? geometry(size).peers[i] : linePeers(size, i);
	for (const j of peers) if (grid[j]) mask &= ~bit(grid[j]);
	return mask;
}

/** Cells whose digit appears again in their row, column or box. */
export function conflicts(size: number, grid: readonly number[], boxes = true): boolean[] {
	if (!boxes) return latinConflicts(size, grid);
	const { peers } = geometry(size);
	return grid.map((d, i) => d !== 0 && peers[i].some((j) => grid[j] === d));
}

/** Cells where the player entered a digit other than the solution's. */
export function mistakes(p: SudokuPuzzle, s: SudokuState, solution: readonly number[]): boolean[] {
	return s.values.map((d, i) => !p.givens[i] && d !== 0 && d !== solution[i]);
}

/**
 * How often each digit can still be placed: index `d` holds `size` minus the cells showing `d`
 * (index 0 is unused). Negative when a digit was placed too often.
 */
export function remainingDigits(p: SudokuPuzzle, s: SudokuState): number[] {
	const out = new Array(p.width + 1).fill(p.width);
	out[0] = 0;
	for (const d of currentGrid(p, s)) if (d) out[d]--;
	return out;
}

/** True when every cell holds a digit and no row, column or box repeats one. */
export function isSolvedGrid(size: number, grid: readonly number[], boxes = true): boolean {
	return grid.every((d) => d >= 1 && d <= size) && !conflicts(size, grid, boxes).some(Boolean);
}

/** Enter digit `d` (0 clears) in cell `i`. Given cells cannot change. */
export function placeDigit(p: SudokuPuzzle, s: SudokuState, i: number, d: number): SudokuState {
	if (p.givens[i] || s.values[i] === d) return s;
	const values = s.values.slice();
	values[i] = d;
	return { ...s, values };
}

/** Toggle the small digit `d` in cell `i`. */
export function toggleNote(p: SudokuPuzzle, s: SudokuState, i: number, d: number): SudokuState {
	if (p.givens[i]) return s;
	const notes = s.notes.slice();
	notes[i] ^= bit(d);
	return { ...s, notes };
}

/** Note every digit that is still possible in each empty cell (replacing the notes there). */
export function fillNotes(p: SudokuPuzzle, s: SudokuState): SudokuState {
	const grid = currentGrid(p, s);
	const notes = grid.map((d, i) => (d ? s.notes[i] : candidates(p.width, grid, i, hasBoxes(p))));
	return { ...s, notes };
}

/** Note every possible digit in the empty cells that have no notes yet (auto notes). */
export function fillMissingNotes(p: SudokuPuzzle, s: SudokuState): SudokuState {
	const grid = currentGrid(p, s);
	let changed = false;
	const notes = s.notes.map((m, i) => {
		if (m || grid[i]) return m;
		const next = candidates(p.width, grid, i, hasBoxes(p));
		if (next) changed = true;
		return next;
	});
	return changed ? { ...s, notes } : s;
}

/**
 * Remove small digits that a big digit in the same row, column or box rules out. Notes in cells
 * that hold a digit are kept, so they come back when the digit is cleared.
 */
export function pruneNotes(p: SudokuPuzzle, s: SudokuState): SudokuState {
	const grid = currentGrid(p, s);
	let changed = false;
	const notes = s.notes.map((m, i) => {
		if (!m || grid[i]) return m;
		const next = m & candidates(p.width, grid, i, hasBoxes(p));
		if (next !== m) changed = true;
		return next;
	});
	return changed ? { ...s, notes } : s;
}
