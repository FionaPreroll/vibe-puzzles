import { withCommon } from '../../core/settings';

export const SUDOKU_SETTINGS = withCommon([
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
]);

export type SudokuSettingKey = (typeof SUDOKU_SETTINGS)[number]['key'];
