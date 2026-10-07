import { withCommon } from '../../core/settings';
import { PINWHEEL_TUTORIAL } from './tutorial';
import type { GameModule } from '../../core/types';
import Board, { NOTE_COLOURS } from './Board.svelte';
import { pinwheelLogic } from './logic';
import { emptyPinwheelState, type PinwheelPuzzle, type PinwheelState } from './rules';

const SWATCH_NAMES = ['', 'Violet', 'Red', 'Yellow', 'Green', 'Blue'];

export const pinwheel: GameModule<PinwheelPuzzle, PinwheelState> = {
	...pinwheelLogic,
	name: 'Pinwheel',
	icon: '✺',
	tools: [
		{ id: 'rotate', label: 'Rotate', icon: '⟳', key: '1' },
		{ id: 'black', label: 'Line', icon: '╱', key: '2' },
		{ id: 'cross', label: 'Cross', icon: '✕', key: '3' },
		{ id: 'blank', label: 'Blank', icon: '⌫', key: '4' },
		{ id: 'color', label: 'Colour', icon: '●', key: '5' }
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
	tutorial: { puzzle: PINWHEEL_TUTORIAL, start: emptyPinwheelState },
	board: Board
};
