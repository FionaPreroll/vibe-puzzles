import { withCommon } from '../../core/settings';
import type { GameModule } from '../../core/types';
import Board, { NOTE_COLOURS } from './Board.svelte';
import { pinwheelLogic } from './logic';
import type { PinwheelPuzzle, PinwheelState } from './rules';

const SWATCH_NAMES = ['', 'Violet', 'Red', 'Yellow', 'Green', 'Blue'];

export const pinwheel: GameModule<PinwheelPuzzle, PinwheelState> = {
	...pinwheelLogic,
	name: 'Pinwheel',
	tagline: 'Split the grid into regions that look the same upside down.',
	icon: '✺',
	rules: [
		'Each region has exactly one white circle in it.',
		'The circle is the centre of its rotational symmetry: rotating the region by 180° around the circle gives the same shape, position and orientation.',
		'A region cannot be a neighbour to itself.'
	],
	notes: [
		'Click between dots to draw a line, right click to set a cross, Shift+click to colour a cell. Right click a circle to lock a finished region.'
	],
	tools: [
		{ id: 'rotate', label: 'Rotate', key: '1' },
		{ id: 'black', label: 'Black', key: '2' },
		{ id: 'cross', label: 'Cross', key: '3' },
		{ id: 'blank', label: 'Blank', key: '4' },
		{ id: 'color', label: 'Color', key: '5' }
	],
	defaultTool: () => 'black',
	toolOptions: {
		tool: 'color',
		default: 3,
		values: [1, 2, 3, 4, 5].map((value, k) => ({
			value,
			label: SWATCH_NAMES[value],
			key: ['6', '7', '8', '9', '0'][k],
			color: NOTE_COLOURS[value]
		}))
	},
	settings: withCommon([
		{ key: 'showGrid', label: 'Show grid', default: true },
		{ key: 'continuousLine', label: 'Draw continuous line', default: true },
		{ key: 'symmetryHelper', label: 'Enable symmetry helper', default: true },
		{ key: 'blackHoles', label: 'Black hole in completed galaxies', default: false },
		{ key: 'autoColor', label: 'Auto color completed galaxies', default: false }
	]),
	board: Board
};
