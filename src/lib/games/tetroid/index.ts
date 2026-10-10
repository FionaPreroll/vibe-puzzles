import { TETROID_TUTORIAL, TETROID_TUTORIAL_STEPS, tetroidTutorialStart } from './tutorial';
import type { GameModule } from '../../core/types';
import { TETROID_SETTINGS, type TetroidSettingKey } from './settings';
import Board from './Board.svelte';
import { tetroidHint } from './hint';
import { tetroidLogic } from './logic';
import type { TetroidPuzzle, TetroidState } from './rules';

export const tetroid: GameModule<TetroidPuzzle, TetroidState, TetroidSettingKey> = {
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
	settings: TETROID_SETTINGS,
	tutorial: {
		puzzle: TETROID_TUTORIAL,
		start: tetroidTutorialStart,
		steps: TETROID_TUTORIAL_STEPS
	},
	board: Board,
	hint(puzzle, state) {
		const hint = tetroidHint(puzzle, state);
		if (!hint) return null;
		const spotlight = hint.cells.map(String);
		if (hint.kind === 'mistake') return { kind: 'mistake', spotlight, text: ['game.hintMistake'] };
		if (hint.kind === 'stuck')
			return { kind: 'stuck', spotlight, text: ['games.tetroid.hints.stuck'] };
		const key = (k: string) => `games.tetroid.hints.${k}`;
		// The region and the neighbours its options hang on, or the placement that was tried.
		const area =
			hint.assumed ??
			puzzle.regions.flatMap((r, i) => (r === hint.region || hint.context.includes(i) ? [i] : []));
		return {
			kind: 'step',
			spotlight,
			area: area.map(String),
			teaser: [key(hint.technique)],
			text: [key(hint.technique), key(hint.mark)]
		};
	}
};
