import type { BasePuzzle } from '../../core/types';

/**
 * Pixels: the numbers beside each row and above each column are the blocks of filled cells in
 * it, in order, with at least one empty cell between two blocks. The player fills the cells so
 * that every row and column shows its blocks; the filled cells make a picture.
 */
export interface PixelsPuzzle extends BasePuzzle {
	/** The blocks of each row, top to bottom, each from left to right; none for an empty row. */
	rows: number[][];
	/** The blocks of each column, left to right, each from top to bottom. */
	cols: number[][];
}

export interface PixelsState {
	/** `EMPTY`, `FILLED` or `CROSS` per cell, row by row. */
	cells: number[];
}

/** A cell the player has not marked. */
export const EMPTY = 0;
/** A filled cell. */
export const FILLED = 1;
/** A cell the player crossed out: it stays empty. */
export const CROSS = 2;

/** The blocks of a line of cells (`filled(i)` for its `n` cells): the lengths of its runs. */
export function blocksOf(n: number, filled: (i: number) => boolean): number[] {
	const out: number[] = [];
	let run = 0;
	for (let i = 0; i <= n; i++) {
		if (i < n && filled(i)) run++;
		else if (run) {
			out.push(run);
			run = 0;
		}
	}
	return out;
}

/** The puzzle a picture makes (`filled` per cell, row by row): its rows' and columns' blocks. */
export function puzzleOf(width: number, height: number, filled: ArrayLike<number>): PixelsPuzzle {
	return {
		width,
		height,
		rows: Array.from({ length: height }, (_, r) =>
			blocksOf(width, (c) => filled[r * width + c] === 1)
		),
		cols: Array.from({ length: width }, (_, c) =>
			blocksOf(height, (r) => filled[r * width + c] === 1)
		)
	};
}

/**
 * The lines of a puzzle: rows first (line `r` is row `r`), then columns (line `height + c`).
 * Hints, the solver and the board name lines by these numbers.
 */
export const lineCount = (p: BasePuzzle) => p.width + p.height;

/** The cells of line `line`, in order: left to right in a row, top to bottom in a column. */
export function lineCells(p: BasePuzzle, line: number): number[] {
	const { width: w, height: h } = p;
	if (line < h) return Array.from({ length: w }, (_, c) => line * w + c);
	return Array.from({ length: h }, (_, r) => r * w + line - h);
}

/** The blocks of line `line`. */
export const clueOf = (p: PixelsPuzzle, line: number) =>
	line < p.height ? p.rows[line] : p.cols[line - p.height];

const same = (a: readonly number[], b: readonly number[]) =>
	a.length === b.length && a.every((x, i) => x === b[i]);

/** Whether every row and column shows its blocks (crosses count as empty). */
export function isSolvedState(p: PixelsPuzzle, s: PixelsState): boolean {
	const filled = (i: number) => s.cells[i] === FILLED;
	for (let line = 0; line < lineCount(p); line++) {
		const cells = lineCells(p, line);
		if (
			!same(
				blocksOf(cells.length, (i) => filled(cells[i])),
				clueOf(p, line)
			)
		)
			return false;
	}
	return true;
}

/** What the board shows of a position: which numbers are done and which lines surely break. */
export interface PixelsAnalysis {
	/**
	 * Per line, per block: the player's filled cells already show this block where it must be
	 * (the line's filled cells are exactly its blocks), so the number can be greyed out.
	 */
	done: boolean[][];
	/** Per line: its marks break its numbers whatever comes (too many filled, no room left). */
	error: boolean[];
}

/**
 * Whether the marks of a line (`FILLED`, `CROSS` or not marked) leave a way to place `clue`'s
 * blocks: every filled cell in a block, every crossed one outside.
 */
export function lineFits(clue: readonly number[], marks: readonly number[]): boolean {
	const n = marks.length;
	const k = clue.length;
	// fit[j][i]: the first j blocks fit into the first i cells.
	let prev = new Uint8Array(n + 1);
	prev[0] = 1;
	for (let i = 1; i <= n; i++) prev[i] = prev[i - 1] && marks[i - 1] !== FILLED ? 1 : 0;
	for (let j = 1; j <= k; j++) {
		const b = clue[j - 1];
		const next = new Uint8Array(n + 1);
		let crossed = -1;
		for (let i = 1; i <= n; i++) {
			if (marks[i - 1] === CROSS) crossed = i - 1;
			const start = i - b;
			let ok = next[i - 1] === 1 && marks[i - 1] !== FILLED;
			if (!ok && start >= 0 && crossed < start) {
				ok =
					j === 1
						? prev[start] === 1
						: start >= 1 && marks[start - 1] !== FILLED && prev[start - 1] === 1;
			}
			next[i] = ok ? 1 : 0;
		}
		prev = next;
	}
	return prev[n] === 1;
}

/**
 * The blocks of `clue` that the marks show from one end of the line (the left or top one with
 * `fromLeft`): walking in from the end over crosses, each run of filled cells closed off by a
 * cross (or the other end) that is as long as the next block. Stops at the first cell not
 * marked, or at a run of another length.
 */
function doneFromEnd(marks: readonly number[], clue: readonly number[], fromLeft: boolean) {
	const n = marks.length;
	const at = (i: number) => marks[fromLeft ? i : n - 1 - i];
	const out: number[] = [];
	let i = 0;
	for (let b = 0; b < clue.length; b++) {
		while (i < n && at(i) === CROSS) i++;
		if (at(i) !== FILLED) break;
		let end = i;
		while (end < n && at(end) === FILLED) end++;
		const block = fromLeft ? b : clue.length - 1 - b;
		if (end - i !== clue[block] || (end < n && at(end) !== CROSS)) break;
		out.push(block);
		i = end;
	}
	return out;
}

/** Numbers greyed out and lines marked wrong, for the board. */
export function analyze(p: PixelsPuzzle, s: PixelsState): PixelsAnalysis {
	const done: boolean[][] = [];
	const error: boolean[] = [];
	for (let line = 0; line < lineCount(p); line++) {
		const marks = lineCells(p, line).map((c) => s.cells[c]);
		const clue = clueOf(p, line);
		const wrong = !lineFits(clue, marks);
		error.push(wrong);
		// A line whose filled cells are its blocks has every number done; else the blocks closed
		// off from either end are.
		const flags = clue.map(() => false);
		if (!wrong) {
			if (
				same(
					blocksOf(marks.length, (i) => marks[i] === FILLED),
					clue
				)
			)
				flags.fill(true);
			for (const b of doneFromEnd(marks, clue, true)) flags[b] = true;
			for (const b of doneFromEnd(marks, clue, false)) flags[b] = true;
		}
		done.push(flags);
	}
	return { done, error };
}

/** The key of a cell as the board names changes, hints and highlights: its index. */
export const cellKey = (cell: number) => String(cell);
/** The key of a line's numbers: `r:<row>` or `c:<column>`. */
export function lineKey(p: BasePuzzle, line: number): string {
	return line < p.height ? `r:${line}` : `c:${line - p.height}`;
}
