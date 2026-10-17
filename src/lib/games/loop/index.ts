import { changedEdges } from '../../core/changes';
import type { GameModule } from '../../core/types';
import { LOOP_SETTINGS, type LoopSettingKey } from './settings';
import Board from './Board.svelte';
import { loopHint, type Reason } from './hint';
import { loopLogic } from './logic';
import { edgeKey, emptyLoopState, type LoopPuzzle, type LoopState } from './rules';
import { LOOP_TUTORIAL, LOOP_TUTORIAL_STEPS } from './tutorial';

/** Why crosses a line rests on stay empty, per kind of deduction that crossed them. */
export const EMPTY: Partial<Record<Reason, string>> = {
	clueZero: 'emptyZero',
	clueFull: 'emptyFull',
	dotFull: 'emptyDotFull',
	dotEnd: 'emptyDotEnd',
	loop: 'emptyLoop',
	cornerCross: 'emptyWindow',
	pairCross: 'emptyWindow',
	blockCross: 'emptyWindow',
	sidesSame: 'emptySides'
};

/** Loop: a board, hints and a tutorial, from 5×5 to 25×30. */
export const loop: GameModule<LoopPuzzle, LoopState, LoopSettingKey> = {
	...loopLogic,
	name: 'Loop',
	icon: '▢',
	tools: [
		{ id: 'rotate', label: 'Cycle', icon: '⇄', key: '1' },
		{ id: 'black', label: 'Line', icon: '╱', key: '2' },
		{ id: 'cross', label: 'Cross', icon: '✕', key: '3' },
		{ id: 'blank', label: 'Blank', icon: '⌫', key: '4' }
	],
	defaultTool: () => 'black',
	settings: LOOP_SETTINGS,
	tutorial: {
		puzzle: LOOP_TUTORIAL,
		start: emptyLoopState,
		steps: LOOP_TUTORIAL_STEPS
	},
	board: Board,
	changes: (puzzle, from, to) => changedEdges(puzzle.width, from, to),
	hint(puzzle, state) {
		const hint = loopHint(puzzle, state);
		if (!hint) return null;
		const spotlight = hint.edges.map((e) => edgeKey(puzzle, e));
		const key = (k: string) => `games.loop.hints.${k}`;
		if (hint.kind === 'mistake') return { kind: 'mistake', spotlight, text: ['game.hintMistake'] };
		if (hint.kind === 'stuck') return { kind: 'stuck', spotlight, text: [key('stuck')] };
		// The crosses it rests on that the player has not set are tinted too, and said why.
		const support = hint.support ?? [];
		const area = [
			...hint.cells.map((c) => `c:${c}`),
			...hint.dots.map((d) => `d:${d}`),
			...hint.path.map((e) => edgeKey(puzzle, e)),
			...support.flatMap((s) => [
				...s.edges.map((e) => edgeKey(puzzle, e)),
				...s.cells.map((c) => `c:${c}`),
				...s.dots.map((d) => `d:${d}`)
			])
		];
		const empty = [...new Set(support.map((s) => key(EMPTY[s.reason]!)))];
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
			area: [...new Set(area)],
			teaser: look,
			text: [...look, ...empty, key(hint.reason)],
			...(params && { params })
		};
	}
};
