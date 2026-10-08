import { withCommon } from '../../core/settings';
import type { GameModule } from '../../core/types';
import Board from './Board.svelte';
import { sudokuLogic } from './logic';
import { emptySudokuState, type SudokuPuzzle, type SudokuState } from './rules';
import { SUDOKU_TUTORIAL } from './tutorial';

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
		{ key: 'markMistakes', label: 'Paint wrong digits red', default: false },
		{ key: 'autoNotes', label: 'Fill in notes automatically', default: false },
		{ key: 'autoRemoveNotes', label: 'Remove notes ruled out by a new digit', default: false },
		{ key: 'highlightLines', label: 'Highlight row, column and box', default: true },
		{ key: 'highlightSame', label: 'Highlight the same digit', default: true },
		{ key: 'showRemaining', label: 'Show how many of each digit are left', default: true }
	]),
	tutorial: { puzzle: SUDOKU_TUTORIAL, start: emptySudokuState },
	board: Board,
	padRows: 1.2
};
