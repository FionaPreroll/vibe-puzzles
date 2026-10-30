import type { GameModule } from '../../core/types';
import { PIPES_SETTINGS, type PipesSettingKey } from './settings';
import Board from './Board.svelte';
import { pipesHint } from './hint';
import { pipesLogic } from './logic';
import { changedMarks, emptyPipesState, type PipesPuzzle, type PipesState } from './rules';
import { PIPES_TUTORIAL, PIPES_TUTORIAL_STEPS } from './tutorial';

/** Pipes: a board, hints and a tutorial, from 5×5 to 25×25, each with and without wrap. */
export const pipes: GameModule<PipesPuzzle, PipesState, PipesSettingKey> = {
	...pipesLogic,
	name: 'Pipes',
	icon: '╬',
	tools: [
		{ id: 'turn', label: 'Turn', icon: '↻', key: '1' },
		{ id: 'lock', label: 'Lock', icon: '▣', key: '2' },
		{ id: 'note', label: 'Note', icon: '✎', key: '3' }
	],
	defaultTool: () => 'turn',
	settings: PIPES_SETTINGS,
	tutorial: {
		puzzle: PIPES_TUTORIAL,
		start: emptyPipesState,
		steps: PIPES_TUTORIAL_STEPS
	},
	board: Board,
	// A tile changes when it turns or its lock does; a side between tiles when its mark does.
	changes: (_, from, to) => [
		...to.tiles.flatMap((mask, c) =>
			mask !== from.tiles[c] || to.locks[c] !== from.locks[c] ? [String(c)] : []
		),
		...changedMarks(from.marks, to.marks)
	],
	hint(puzzle, state) {
		const hint = pipesHint(puzzle, state);
		if (!hint) return null;
		const key = (k: string) => `games.pipes.hints.${k}`;
		if (hint.kind === 'mistake') {
			const { cells, marks } = hint;
			const text = !marks.length ? 'mistake' : cells.length ? 'mistakeBoth' : 'mistakeMarks';
			return { kind: 'mistake', spotlight: [...cells.map(String), ...marks], text: [key(text)] };
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
