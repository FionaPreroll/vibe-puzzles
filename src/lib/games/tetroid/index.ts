import { withCommon } from '../../core/settings';
import type { GameModule } from '../../core/types';
import Board from './Board.svelte';
import { tetroidLogic } from './logic';
import type { TetroidPuzzle, TetroidState } from './rules';

export const tetroid: GameModule<TetroidPuzzle, TetroidState> = {
	...tetroidLogic,
	name: 'Tetroid',
	tagline: 'Shade one tetromino in every region.',
	icon: '▙',
	rules: [
		'Place one tetromino in each region.',
		'Two tetrominoes of matching types cannot touch each other horizontally or vertically. Rotations and reflections count as matching.',
		'The shaded cells should form a single connected area.',
		'2×2 shaded areas are not allowed.'
	],
	notes: [
		'A tetromino is a shape made of 4 connected cells. There are 5 types, named L, I, T, S and O after their shape. O is not used because it is a 2×2 shape, which is not allowed.'
	],
	tools: [
		{ id: 'rotate', label: 'Rotate', key: '1' },
		{ id: 'black', label: 'Black', key: '2' },
		{ id: 'cross', label: 'Cross', key: '3' },
		{ id: 'blank', label: 'Blank', key: '4' }
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
	board: Board
};
