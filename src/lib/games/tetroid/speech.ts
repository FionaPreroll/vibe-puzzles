import { cellPlace, withStates } from '../../client/speech';
import { t } from '../../i18n/index.svelte';
import { CROSS, SHADED, type TetroidAnalysis, type TetroidPuzzle } from './rules';

/** What the board shows of the rules: errors in red, finished tetrominoes in their colours. */
export interface TetroidShown {
	errors: boolean;
	shapes: boolean;
}

/**
 * What a screen reader says about `cell`: where it is, its region (counted from 1 in reading
 * order of their first cells) and its mark, e.g. "Row 3, column 4, region 5: shaded (L tetromino)".
 */
export function sayCell(
	p: TetroidPuzzle,
	marks: readonly number[],
	a: TetroidAnalysis,
	cell: number,
	shown: TetroidShown
): string {
	const region = p.regions[cell];
	const place = t('games.tetroid.speech.place', {
		place: cellPlace(Math.floor(cell / p.width), cell % p.width),
		region: [...new Set(p.regions)].indexOf(region) + 1
	});
	if (marks[cell] !== SHADED) {
		return `${place}: ${t(marks[cell] === CROSS ? 'games.tetroid.speech.cross' : 'speech.empty')}`;
	}
	// As on the board: a cell in red does not show its tetromino's colour.
	const error = shown.errors && a.errors[cell];
	const type = error || !shown.shapes ? null : a.regionType[region];
	return `${place}: ${withStates(t('games.tetroid.speech.shaded'), [
		error && t('speech.error'),
		type ? t('games.tetroid.speech.shape', { shape: type }) : false
	])}`;
}
