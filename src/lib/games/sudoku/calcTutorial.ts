import type { TutorialStep } from '../../core/types';
import { bit, type SudokuPuzzle, type SudokuState } from './rules';

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

/** A task to enter the solution's digits in `cells`. */
function digitStep(cells: number[]): Step {
	return {
		spotlight: cells.map(String),
		done: (_, s) => cells.every((i) => s.values[i] === CALC_TUTORIAL_SOLUTION[i]),
		show: (_, s) => {
			const values = s.values.slice();
			const notes = s.notes.slice();
			for (const i of cells) {
				values[i] = CALC_TUTORIAL_SOLUTION[i];
				notes[i] = 0;
			}
			return { values, notes };
		}
	};
}

/** A task to note exactly `digits` in `cells` (the right digits entered count too). */
function noteStep(cells: number[], digits: number[]): Step {
	const mask = digits.reduce((m, d) => m | bit(d), 0);
	return {
		spotlight: cells.map(String),
		done: (_, s) =>
			cells.every(
				(i) => s.values[i] === CALC_TUTORIAL_SOLUTION[i] || (!s.values[i] && s.notes[i] === mask)
			),
		show: (_, s) => {
			const values = s.values.slice();
			const notes = s.notes.slice();
			for (const i of cells) {
				values[i] = 0;
				notes[i] = mask;
			}
			return { values, notes };
		}
	};
}

/** Texts under `games.sudoku.modes.calc.tutorial`, one per step. */
export const CALC_TUTORIAL_STEPS: Step[] = [
	// Rows and columns, no boxes.
	{},
	// What a cage label means.
	{ spotlight: ['1', '2', '5'] },
	// A cage with one cell: its digit.
	digitStep([3]),
	// "3−": only 4 and 1; the column with the 4 decides the order.
	digitStep([6, 7]),
	// "7+": 3 and 4, order still open, so note both.
	noteStep([8, 9], [3, 4]),
	// The rest alone; the tutorial ends when the board is solved.
	{}
];
