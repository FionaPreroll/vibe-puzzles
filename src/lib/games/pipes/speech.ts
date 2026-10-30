import { cellPlace, direction, withStates, type Direction } from '../../client/speech';
import { t } from '../../i18n/index.svelte';
import {
	kindOf,
	markedSides,
	sourceOf,
	unfitTiles,
	type PipesAnalysis,
	type PipesPuzzle,
	type PipesState
} from './rules';

/**
 * What the board shows: errors in red, the water in the pipes joined to the source, tiles that
 * cannot keep to their marks.
 */
export interface PipesShown {
	errors: boolean;
	water: boolean;
	markErrors?: boolean;
}

const SIDES: Direction[] = ['up', 'right', 'down', 'left'];

/** The sides among `mask`, as a list: "up, right". */
const sides = (mask: number) =>
	SIDES.filter((_, k) => mask & (1 << k))
		.map(direction)
		.join(', ');

/**
 * What a screen reader says about the tile in `cell`: where it is, its kind and the sides its
 * pipe opens to, and what holds there, e.g. "Row 2, column 3: corner, open up, right (water,
 * locked, marked = left)".
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
		list: sides(mask)
	});
	const { joins, crosses } = markedSides(p, s.marks);
	return `${cellPlace(Math.floor(cell / p.width), cell % p.width)}: ${withStates(tile, [
		cell === sourceOf(p) && t('games.pipes.speech.source'),
		shown.water && a.water[cell] && t('games.pipes.speech.water'),
		!!s.locks[cell] && t('games.pipes.speech.locked'),
		!!joins[cell] && t('games.pipes.speech.joins', { list: sides(joins[cell]) }),
		!!crosses[cell] && t('games.pipes.speech.crosses', { list: sides(crosses[cell]) }),
		shown.errors && a.errors[cell] !== 0 && t('speech.error'),
		!!shown.markErrors && unfitTiles(p, s)[cell] && t('games.pipes.speech.unfit')
	])}`;
}
