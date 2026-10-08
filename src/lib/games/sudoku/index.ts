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
	settings: withCommon([]),
	tutorial: { puzzle: SUDOKU_TUTORIAL, start: emptySudokuState },
	board: Board,
	padRows: 1.2
};
