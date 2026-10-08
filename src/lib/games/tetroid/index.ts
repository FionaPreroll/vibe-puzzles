import { withCommon } from '../../core/settings';
import { TETROID_TUTORIAL, tetroidTutorialStart } from './tutorial';
import type { GameModule } from '../../core/types';
import Board from './Board.svelte';
import { tetroidLogic } from './logic';
import type { TetroidPuzzle, TetroidState } from './rules';

export const tetroid: GameModule<TetroidPuzzle, TetroidState> = {
	...tetroidLogic,
	name: 'Tetroid',
	icon: '▙',
	tools: [
		{ id: 'rotate', label: 'Cycle', icon: '⇄', key: '1' },
		{ id: 'black', label: 'Black', icon: '■', key: '2' },
		{ id: 'cross', label: 'Cross', icon: '✕', key: '3' },
		{ id: 'blank', label: 'Blank', icon: '□', key: '4' }
	],
	defaultTool: (touch) => (touch ? 'rotate' : 'black'),
	settings: withCommon([
		{ key: 'highlightBlock', label: 'Highlight current block', default: false },
		{ key: 'highlightGroup', label: 'Highlight current group of cells [Shift]', default: false },
		{ key: 'thickBorders', label: 'Thicker block borders', default: false },
		{ key: 'colorTetrominoes', label: 'Color tetrominoes', default: false },
		{ key: 'autoCrossCorners', label: 'Auto place X on corners', default: false },
		{ key: 'autoCrossRegions', label: 'Auto place X in completed regions', default: false }
	]),
	tutorial: { puzzle: TETROID_TUTORIAL, start: tetroidTutorialStart },
	board: Board
};
