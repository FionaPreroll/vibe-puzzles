import type { TutorialStep } from '../../core/types';
import type { SudokuPuzzle, SudokuState } from './rules';
import { digitStep } from './tutorialSteps';

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

/** The solution, row by row. */
// prettier-ignore
export const SUDOKU_TUTORIAL_SOLUTION = [
	1, 2, 3, 4,
	3, 4, 1, 2,
	2, 1, 4, 3,
	4, 3, 2, 1
];

/**
 * Texts under `games.sudoku.tutorial`, one per step. Each task finds the missing digit in a
 * different unit: a row, a box, then a column; the player fills the rest alone.
 */
export const SUDOKU_TUTORIAL_STEPS: TutorialStep<SudokuPuzzle, SudokuState>[] = [
	// The rules, with the top-left box as an example.
	{ spotlight: ['0', '1', '4', '5'] },
	// The top row lacks only the 3.
	digitStep(SUDOKU_TUTORIAL_SOLUTION, [2]),
	// The top-left box lacks only the 3.
	digitStep(SUDOKU_TUTORIAL_SOLUTION, [4]),
	// The left column lacks only the 2.
	digitStep(SUDOKU_TUTORIAL_SOLUTION, [8]),
	// The rest alone; the tutorial ends when the board is solved.
	{}
];
