import { changedCells } from '../../core/changes';
import type { GameModule, Hint } from '../../core/types';
import { t } from '../../i18n/index.svelte';
import Board from './Board.svelte';
import { boardCells } from './draw';
import { pixelsHint } from './hint';
import { pixelsLogic } from './logic';
import {
	clueOf,
	cellKey,
	FILLED,
	lineCells,
	lineKey,
	type PixelsPuzzle,
	type PixelsState
} from './rules';
import { PIXELS_SETTINGS, type PixelsSettingKey } from './settings';

/** Pixels: fill the cells so that every row and column shows its blocks. */
export const pixels: GameModule<PixelsPuzzle, PixelsState, PixelsSettingKey> = {
	...pixelsLogic,
	// "Pixels", in German "Pixelbild": the name follows the language.
	get name() {
		return t('games.pixels.name');
	},
	earlyAccess: true,
	icon: '▦',
	tools: [
		{ id: 'black', label: 'Fill', icon: '■', key: '1' },
		{ id: 'cross', label: 'Cross', icon: '✕', key: '2' },
		{ id: 'rotate', label: 'Cycle', icon: '⇄', key: '3' }
	],
	defaultTool: (touch) => (touch ? 'rotate' : 'black'),
	settings: PIXELS_SETTINGS,
	board: Board,
	boardSize: (p) => boardCells(p),
	changes: (_, from, to) => changedCells(from.cells, to.cells),
	hint(puzzle, state): Hint | null {
		const hint = pixelsHint(puzzle, state);
		if (!hint) return null;
		const key = (k: string) => `games.pixels.hints.${k}`;
		const spotlight = hint.cells.map(cellKey);
		if (hint.kind !== 'step') {
			return { kind: hint.kind, spotlight, text: [key(hint.kind)] };
		}
		const row = hint.line < puzzle.height;
		const params = {
			n: (row ? hint.line : hint.line - puzzle.height) + 1,
			clue: clueOf(puzzle, hint.line).join(' ') || '0',
			len: hint.block ?? 0
		};
		const single = hint.cells.length === 1 ? '1' : '';
		const then = key(`${hint.value === FILLED ? 'thenFill' : 'thenCross'}${single}`);
		if (hint.technique === 'assumption') {
			// The cell tried the other way, and the line that breaks.
			const tried = hint.value === FILLED ? 'Empty' : 'Filled';
			return {
				kind: 'step',
				spotlight,
				area: [...spotlight, lineKey(puzzle, hint.line)],
				teaser: [key('assumeLook')],
				text: [key(`assume${tried}${row ? 'Row' : 'Col'}`), then],
				params
			};
		}
		// A line with one number (or a 0) has one block, or none.
		const one = clueOf(puzzle, hint.line).length <= 1 ? '1' : '';
		const look = key(`look${row ? 'Row' : 'Col'}${one}`);
		const lookAt = ['overlap', 'reach', 'line'].includes(hint.technique) ? one : '';
		const reason =
			hint.technique === 'overlap'
				? hint.block
					? 'overlap'
					: 'overlapMany'
				: hint.technique === 'line'
					? hint.value === FILLED
						? 'lineFill'
						: 'lineCross'
					: hint.technique;
		return {
			kind: 'step',
			spotlight,
			area: [...lineCells(puzzle, hint.line).map(cellKey), lineKey(puzzle, hint.line)],
			teaser: [look, key(`${hint.technique}Look${lookAt}`)],
			text: [look, key(reason), then],
			params
		};
	}
};
