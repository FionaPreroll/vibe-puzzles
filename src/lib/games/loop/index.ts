import type { GameModule } from '../../core/types';
import { LOOP_SETTINGS, type LoopSettingKey } from './settings';
import Board from './Board.svelte';
import { loopLogic } from './logic';
import type { LoopPuzzle, LoopState } from './rules';

/** Loop: early access, with a board and the 5×5 Normal type. No tutorial or hints yet. */
export const loop: GameModule<LoopPuzzle, LoopState, LoopSettingKey> = {
	...loopLogic,
	name: 'Loop',
	icon: '▢',
	earlyAccess: true,
	tools: [
		{ id: 'rotate', label: 'Cycle', icon: '⇄', key: '1' },
		{ id: 'black', label: 'Line', icon: '╱', key: '2' },
		{ id: 'cross', label: 'Cross', icon: '✕', key: '3' },
		{ id: 'blank', label: 'Blank', icon: '⌫', key: '4' }
	],
	defaultTool: () => 'black',
	settings: LOOP_SETTINGS,
	board: Board
};
