import { neighbours } from '../../core/grid';
import { FILLED, type PixelsPuzzle } from './rules';

/** Room for one number of a column, in cells: the numbers stand one above the other. */
export const COLUMN_SLOT = 0.62;
/** Room for one number of a row, in cells, for numbers up to 9 and for longer ones. */
const ROW_SLOT = 0.62;
const WIDE_ROW_SLOT = 0.95;
/** Space between the numbers and the grid, in cells. */
export const CLUE_GAP = 0.3;

/** Room each number of a row takes, in cells. */
export const rowSlot = (p: PixelsPuzzle) =>
	p.rows.some((clue) => clue.some((b) => b > 9)) ? WIDE_ROW_SLOT : ROW_SLOT;

/**
 * The room the numbers take beside the grid, in cells: `left` of it for the rows, `top` above
 * it for the columns. A line without blocks shows a 0.
 */
export function clueSpace(p: PixelsPuzzle): { left: number; top: number } {
	const most = (clues: number[][]) => Math.max(1, ...clues.map((c) => c.length));
	return {
		left: most(p.rows) * rowSlot(p) + CLUE_GAP,
		top: most(p.cols) * COLUMN_SLOT + CLUE_GAP
	};
}

/** The whole board in cells: the grid and the numbers beside and above it. */
export function boardCells(p: PixelsPuzzle): { width: number; height: number } {
	const { left, top } = clueSpace(p);
	return { width: p.width + left, height: p.height + top };
}

/**
 * For the win animation: a region per cell, so that each group of filled cells joined along
 * their sides gets a colour of its own (the empty cells make regions too, never drawn).
 */
export function pictureRegions(p: PixelsPuzzle, cells: readonly number[]): number[] {
	const { width: w, height: h } = p;
	const region = new Array<number>(w * h).fill(-1);
	let next = 0;
	for (let start = 0; start < w * h; start++) {
		if (region[start] >= 0) continue;
		const filled = cells[start] === FILLED;
		region[start] = next;
		const stack = [start];
		while (stack.length) {
			for (const n of neighbours(stack.pop()!, w, h)) {
				if (region[n] < 0 && (cells[n] === FILLED) === filled) {
					region[n] = next;
					stack.push(n);
				}
			}
		}
		next++;
	}
	return region;
}
