import type { GameModule } from '../../core/types';
import { PIPES_SETTINGS, type PipesSettingKey } from './settings';
import Board from './Board.svelte';
import { pipesHint } from './hint';
import { pipesLogic } from './logic';
import { emptyPipesState, type PipesPuzzle, type PipesState } from './rules';
import { PIPES_TUTORIAL, PIPES_TUTORIAL_STEPS } from './tutorial';

/** Pipes: a board, hints and a tutorial, from 5×5 to 25×25, each with and without wrap. */
export const pipes: GameModule<PipesPuzzle, PipesState, PipesSettingKey> = {
	...pipesLogic,
	name: 'Pipes',
	icon: '╬',
	tools: [
		{ id: 'turn', label: 'Turn', icon: '↻', key: '1' },
		{ id: 'lock', label: 'Lock', icon: '▣', key: '2' }
	],
	defaultTool: () => 'turn',
	settings: PIPES_SETTINGS,
	tutorial: {
		puzzle: PIPES_TUTORIAL,
		start: emptyPipesState,
		steps: PIPES_TUTORIAL_STEPS
	},
	board: Board,
	// A tile changes when it turns or its lock does.
	changes: (_, from, to) =>
		to.tiles.flatMap((mask, c) =>
			mask !== from.tiles[c] || to.locks[c] !== from.locks[c] ? [String(c)] : []
		),
	hint(puzzle, state) {
		const hint = pipesHint(puzzle, state);
		if (!hint) return null;
		const key = (k: string) => `games.pipes.hints.${k}`;
		if (hint.kind === 'mistake') {
			return { kind: 'mistake', spotlight: hint.cells.map(String), text: [key('mistake')] };
		}
		if (hint.kind === 'stuck') {
			return { kind: 'stuck', spotlight: [String(hint.cell)], text: [key('stuck')] };
		}
		const look = key(`${hint.technique}Look`);
		return {
			kind: 'step',
			spotlight: [String(hint.cell)],
			area: hint.area.map(String),
			teaser: [look],
			text: [look, key(hint.technique), key(`turn${hint.turns}`)]
		};
	}
};
