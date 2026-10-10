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
		3, 0, 1, 2,
		2, 1, 0, 0,
		0, 0, 0, 0
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
 * Texts under `games.sudoku.tutorial`, one per step. The first two tasks find the one digit a row
 * and a box lack; the third turns the question round, as most steps in real puzzles do: where can
 * a digit go in a box? Then the player fills the rest alone.
 */
export const SUDOKU_TUTORIAL_STEPS: TutorialStep<SudokuPuzzle, SudokuState>[] = [
	// The rules, with the top-left box as an example.
	{ spotlight: ['0', '1', '4', '5'] },
	// The top row lacks only the 3.
	digitStep(SUDOKU_TUTORIAL_SOLUTION, [2]),
	// The top-left box lacks only the 4.
	digitStep(SUDOKU_TUTORIAL_SOLUTION, [5]),
	// The bottom-right box needs a 1: the 1s in the third row and column leave it one cell.
	{ ...digitStep(SUDOKU_TUTORIAL_SOLUTION, [15]), spotlight: ['10', '11', '14', '15'] },
	// The rest alone; the tutorial ends when the board is solved.
	{}
];
