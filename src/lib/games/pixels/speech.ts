import { cellPlace, withStates } from '../../client/speech';
import { t } from '../../i18n/index.svelte';
import {
	clueOf,
	CROSS,
	FILLED,
	type PixelsAnalysis,
	type PixelsPuzzle,
	type PixelsState
} from './rules';

/** What the board shows of the rules: lines that break their numbers in red, done ones in grey. */
export interface PixelsShown {
	errors: boolean;
	dimDone: boolean;
}

/**
 * What a screen reader says about `cell`: where it is, its mark, and the numbers of its row and
 * column, e.g. "Row 2, column 3: filled. Row: 3 1 (error). Column: 4 (complete)".
 */
export function sayCell(
	p: PixelsPuzzle,
	s: PixelsState,
	a: PixelsAnalysis,
	cell: number,
	shown: PixelsShown
): string {
	const row = Math.floor(cell / p.width);
	const col = cell % p.width;
	const mark = s.cells[cell];
	const what =
		mark === FILLED
			? t('games.pixels.speech.filled')
			: mark === CROSS
				? t('games.pixels.speech.cross')
				: t('speech.empty');
	const numbers = (line: number, key: string) => {
		const clue = clueOf(p, line);
		const error = shown.errors && a.error[line];
		const done = !error && shown.dimDone && clue.length > 0 && a.done[line].every(Boolean);
		return t(key, {
			clue: withStates(clue.join(' ') || '0', [
				error && t('speech.error'),
				done && t('speech.complete')
			])
		});
	};
	return [
		`${cellPlace(row, col)}: ${what}`,
		numbers(row, 'games.pixels.speech.row'),
		numbers(p.height + col, 'games.pixels.speech.column')
	].join('. ');
}
