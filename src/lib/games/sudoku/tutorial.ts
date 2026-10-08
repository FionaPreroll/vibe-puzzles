import type { SudokuPuzzle } from './rules';

/** First puzzle for new players: 4×4 with 2×2 boxes, the digits 1–4 and singles only. */
export const SUDOKU_TUTORIAL: SudokuPuzzle = {
	width: 4,
	height: 4,
	// prettier-ignore
	givens: [
		1, 2, 0, 4,
		0, 4, 1, 0,
		0, 1, 4, 0,
		4, 0, 2, 1
	]
};
