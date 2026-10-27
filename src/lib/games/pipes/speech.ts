import { cellPlace, direction, withStates, type Direction } from '../../client/speech';
import { t } from '../../i18n/index.svelte';
import { kindOf, sourceOf, type PipesAnalysis, type PipesPuzzle, type PipesState } from './rules';

/** What the board shows: errors in red, the water in the pipes joined to the source. */
export interface PipesShown {
	errors: boolean;
	water: boolean;
}

const SIDES: Direction[] = ['up', 'right', 'down', 'left'];

/**
 * What a screen reader says about the tile in `cell`: where it is, its kind and the sides its
 * pipe opens to, and what holds there, e.g. "Row 2, column 3: corner, open up, right (water,
 * locked)".
 */
export function sayTile(
	p: PipesPuzzle,
	s: PipesState,
	a: PipesAnalysis,
	cell: number,
	shown: PipesShown
): string {
	const mask = s.tiles[cell];
	const tile = t('games.pipes.speech.tile', {
		kind: t(`games.pipes.speech.${kindOf(mask)}`),
		list: SIDES.filter((_, k) => mask & (1 << k))
			.map(direction)
			.join(', ')
	});
	return `${cellPlace(Math.floor(cell / p.width), cell % p.width)}: ${withStates(tile, [
		cell === sourceOf(p) && t('games.pipes.speech.source'),
		shown.water && a.water[cell] && t('games.pipes.speech.water'),
		!!s.locks[cell] && t('games.pipes.speech.locked'),
		shown.errors && a.errors[cell] !== 0 && t('speech.error')
	])}`;
}
