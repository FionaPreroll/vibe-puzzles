import type { TutorialStep } from '../../core/types';
import { bit, type SudokuPuzzle, type SudokuState } from './rules';

type Step = TutorialStep<SudokuPuzzle, SudokuState>;

/** A task to enter the solution's digits in `cells`. */
export function digitStep(solution: readonly number[], cells: number[]): Step {
	return {
		spotlight: cells.map(String),
		done: (_, s) => cells.every((i) => s.values[i] === solution[i]),
		show: (_, s) => {
			const values = s.values.slice();
			const notes = s.notes.slice();
			for (const i of cells) {
				values[i] = solution[i];
				notes[i] = 0;
			}
			return { values, notes };
		}
	};
}

/** A task to note exactly `digits` in `cells` (the right digits entered count too). */
export function noteStep(solution: readonly number[], cells: number[], digits: number[]): Step {
	const mask = digits.reduce((m, d) => m | bit(d), 0);
	return {
		spotlight: cells.map(String),
		done: (_, s) =>
			cells.every((i) => s.values[i] === solution[i] || (!s.values[i] && s.notes[i] === mask)),
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
