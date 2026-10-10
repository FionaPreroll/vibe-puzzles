import { withCommon } from '../../core/settings';
import type { GameModule } from '../../core/types';
import Board from './Board.svelte';
import { calcHint } from './calc/hint';
import { sudokuHint } from './hint';
import { sudokuLogic } from './logic';
import { emptySudokuState, type SudokuPuzzle, type SudokuState } from './rules';
import { CALC_TUTORIAL, CALC_TUTORIAL_STEPS } from './calcTutorial';
import { SUDOKU_TUTORIAL, SUDOKU_TUTORIAL_STEPS } from './tutorial';

export const sudoku: GameModule<SudokuPuzzle, SudokuState> = {
	...sudokuLogic,
	name: 'Sudoku',
	icon: '⑨',
	tools: [
		{ id: 'digit', label: 'Digit', icon: '9', key: 'v' },
		{ id: 'note', label: 'Note', icon: '✎', key: 'n' }
	],
	defaultTool: () => 'digit',
	settings: withCommon([
		{
			key: 'markMistakes',
			label: 'Paint wrong digits red',
			default: false,
			countsAsHint: true
		},
		{ key: 'autoNotes', label: 'Fill in notes automatically', default: false },
		{ key: 'autoRemoveNotes', label: 'Remove notes ruled out by a new digit', default: false },
		{ key: 'highlightLines', label: 'Highlight row, column and box', default: true },
		{ key: 'highlightSame', label: 'Highlight the same digit', default: true },
		{ key: 'showRemaining', label: 'Show how many of each digit are left', default: true },
		{ key: 'digitFirst', label: 'Pick the digit first, then the cells', default: false }
	]),
	tutorial: { puzzle: SUDOKU_TUTORIAL, start: emptySudokuState, steps: SUDOKU_TUTORIAL_STEPS },
	modeTutorials: {
		calc: { puzzle: CALC_TUTORIAL, start: emptySudokuState, steps: CALC_TUTORIAL_STEPS }
	},
	board: Board,
	padRows: 1.2,
	hint(puzzle, state) {
		const { width, height, cages } = puzzle;
		const hint = cages ? calcHint({ width, height, cages }, state) : sudokuHint(puzzle, state);
		if (!hint) return null;
		const key = (k: string) => `games.sudoku.hints.${k}`;
		// Calcudoku explains with rows, columns and cages; the conclusions are the same.
		const own = (k: string) => (cages ? `games.sudoku.modes.calc.hints.${k}` : key(k));
		if (hint.kind === 'mistake')
			return { kind: 'mistake', spotlight: hint.cells.map(String), text: ['game.hintMistake'] };
		const spotlight = [String(hint.cell)];
		if (hint.kind === 'stuck') return { kind: 'stuck', spotlight, text: [key('stuck')] };
		const { digit, unit, elimination } = hint;
		const text = elimination
			? [own(elimination), key(unit ? `then.${unit}` : 'thenNaked')]
			: [own(unit ? `hidden.${unit}` : 'naked')];
		return { kind: 'step', spotlight, text, params: { digit } };
	}
};
