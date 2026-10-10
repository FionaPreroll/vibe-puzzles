import { withCommon } from '../../core/settings';
import { PINWHEEL_TUTORIAL, PINWHEEL_TUTORIAL_STEPS } from './tutorial';
import type { GameModule } from '../../core/types';
import Board, { NOTE_COLOURS } from './Board.svelte';
import { pinwheelHint } from './hint';
import { pinwheelLogic } from './logic';
import { emptyPinwheelState, type PinwheelPuzzle, type PinwheelState } from './rules';

const SWATCH_NAMES = ['', 'Violet', 'Red', 'Yellow', 'Green', 'Blue'];

export const pinwheel: GameModule<PinwheelPuzzle, PinwheelState> = {
	...pinwheelLogic,
	name: 'Pinwheel',
	icon: '✺',
	tools: [
		{ id: 'rotate', label: 'Cycle', icon: '⇄', key: '1' },
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
		{ key: 'blackHoles', label: 'Black hole in completed regions', default: false },
		{ key: 'autoColor', label: 'Auto color completed regions', default: false }
	]),
	tutorial: {
		puzzle: PINWHEEL_TUTORIAL,
		start: emptyPinwheelState,
		steps: PINWHEEL_TUTORIAL_STEPS
	},
	board: Board,
	hint(puzzle, state) {
		const hint = pinwheelHint(puzzle, state);
		if (!hint) return null;
		if (hint.kind === 'stuck')
			return { kind: 'stuck', spotlight: [`c:${hint.cell}`], text: ['games.pinwheel.hints.stuck'] };
		const spotlight = hint.edges.map((e) => `${e.kind}:${e.i}:${e.j}`);
		if (hint.kind === 'mistake') return { kind: 'mistake', spotlight, text: ['game.hintMistake'] };
		const key = (k: string) => `games.pinwheel.hints.${k}`;
		// The assumption names its cells itself; other deductions first say where to look.
		const why =
			hint.technique === 'assumption' ? [key(hint.technique)] : [key('look'), key(hint.technique)];
		return {
			kind: 'step',
			spotlight,
			area: hint.area.map((c) => `c:${c}`),
			teaser: why,
			text: [...why, key(hint.mark)]
		};
	}
};
