import type { GameModule } from '../../core/types';
import { LOOP_SETTINGS, type LoopSettingKey } from './settings';
import Board from './Board.svelte';
import { loopHint } from './hint';
import { loopLogic } from './logic';
import { edgeKey, type LoopPuzzle, type LoopState } from './rules';

/** Loop: early access, with a board, hints and the 5×5 and 7×7 types. No tutorial yet. */
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
	board: Board,
	hint(puzzle, state) {
		const hint = loopHint(puzzle, state);
		if (!hint) return null;
		const spotlight = hint.edges.map((e) => edgeKey(puzzle, e));
		const key = (k: string) => `games.loop.hints.${k}`;
		if (hint.kind === 'mistake') return { kind: 'mistake', spotlight, text: ['game.hintMistake'] };
		if (hint.kind === 'stuck') return { kind: 'stuck', spotlight, text: [key('stuck')] };
		const area = [
			...hint.cells.map((c) => `c:${c}`),
			...hint.dots.map((d) => `d:${d}`),
			...hint.path.map((e) => edgeKey(puzzle, e))
		];
		const params = hint.clue === undefined ? undefined : { clue: hint.clue };
		if (hint.technique === 'assumption') {
			// Suppose the opposite, say what breaks, then what follows.
			const breaks = `breaks${hint.breaks![0].toUpperCase()}${hint.breaks!.slice(1)}`;
			const then = hint.mark === 'line' ? 'thenLine' : 'thenCross';
			return {
				kind: 'step',
				spotlight,
				area,
				teaser: [key('assumeLook')],
				text: [key(hint.reason), key(breaks), key(then)]
			};
		}
		const look = [key(`${hint.technique}Look`)];
		return {
			kind: 'step',
			spotlight,
			area,
			teaser: look,
			text: [...look, key(hint.reason)],
			...(params && { params })
		};
	}
};
