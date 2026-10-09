import type { TutorialStep } from '../../core/types';
import type { SudokuPuzzle, SudokuState } from './rules';
import { digitStep, noteStep } from './tutorialSteps';

/**
 * First Calcudoku for new players, 4×4. The steps go from the easiest cage to the hardest: a
 * single cell, a "3−" whose order a column decides, a "7+" whose order is still open (notes), then
 * the rest alone, with a "18×" that holds a digit twice.
 */
export const CALC_TUTORIAL: SudokuPuzzle = {
	width: 4,
	height: 4,
	givens: new Array(16).fill(0),
	cages: [
		{ cells: [3], op: '=', target: 4 },
		{ cells: [6, 7], op: '-', target: 3 },
		{ cells: [8, 9], op: '+', target: 7 },
		{ cells: [0, 4], op: '/', target: 2 },
		{ cells: [1, 2, 5], op: '*', target: 18 },
		{ cells: [10, 11, 15], op: '+', target: 6 },
		{ cells: [12, 13, 14], op: '*', target: 8 }
	]
};

/** The solution, row by row. */
// prettier-ignore
export const CALC_TUTORIAL_SOLUTION = [
	1, 2, 3, 4,
	2, 3, 4, 1,
	3, 4, 1, 2,
	4, 1, 2, 3
];

type Step = TutorialStep<SudokuPuzzle, SudokuState>;

/** Texts under `games.sudoku.modes.calc.tutorial`, one per step. */
export const CALC_TUTORIAL_STEPS: Step[] = [
	// Rows and columns, no boxes.
	{},
	// What a cage label means.
	{ spotlight: ['1', '2', '5'] },
	// A cage with one cell: its digit.
	digitStep(CALC_TUTORIAL_SOLUTION, [3]),
	// "3−": only 4 and 1; the column with the 4 decides the order.
	digitStep(CALC_TUTORIAL_SOLUTION, [6, 7]),
	// "7+": 3 and 4, order still open, so note both.
	noteStep(CALC_TUTORIAL_SOLUTION, [8, 9], [3, 4]),
	// The rest alone; the tutorial ends when the board is solved.
	{}
];
