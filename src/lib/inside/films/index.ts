import { puzzleCheck } from '../../core/filmLink';
import type { BasePuzzle } from '../../core/types';
import { decodePuzzleId, parsePlayableId, type Variant } from '../../core/variants';
import { GAME_LOGIC } from '../../games/logic';
import type { Film, FilmType } from '../film';
import { LOOP_TYPE, loopFilm } from './loop';
import { PINWHEEL_TYPE, pinwheelFilm } from './pinwheel';
import { SUDOKU_TYPE, sudokuFilm } from './sudoku';
import { TETROID_TYPE, tetroidFilm } from './tetroid';

/** A game's film: its own example, and the types of puzzle it shows as they were made. */
export interface FilmEntry {
	/** The game. */
	id: string;
	name: string;
	/** The type of the film's example. */
	type: FilmType;
	/** Whether the film explains how puzzles of this type are made: small ones, of some difficulties. */
	replays(variant: Variant): boolean;
	make(seed?: number, type?: FilmType): Film<BasePuzzle, unknown>;
}

const square = (v: Variant, most: number) => v.width === v.height && v.width <= most;

/** One film per game, in the order of the page's buttons. */
export const FILMS: FilmEntry[] = [
	{
		id: 'sudoku',
		name: 'Sudoku',
		type: SUDOKU_TYPE,
		replays: (v) => !v.mode && v.difficulty !== 'hard',
		make: sudokuFilm
	},
	{
		id: 'pinwheel',
		name: 'Pinwheel',
		type: PINWHEEL_TYPE,
		replays: (v) => square(v, 7),
		make: pinwheelFilm
	},
	{
		id: 'tetroid',
		name: 'Tetroid',
		type: TETROID_TYPE,
		replays: (v) => v.difficulty === 'normal' && square(v, 8),
		make: tetroidFilm
	},
	{
		id: 'loop',
		name: 'Loop',
		type: LOOP_TYPE,
		replays: (v) => v.difficulty === 'normal' && square(v, 7),
		make: loopFilm
	}
];

/**
 * A puzzle the page was asked for, and why it has no film if it has none: the film does not show
 * its type, or it is not the puzzle the generator makes of its ID now (a collection puzzle made
 * by an earlier version).
 */
export interface AskedPuzzle {
	id: number;
	variant: Variant;
	missing?: 'type' | 'version';
}

export interface Showing {
	entry: FilmEntry;
	/** The type the film shows, also for "Another example". */
	type: FilmType;
	film: Film<BasePuzzle, unknown>;
	asked?: AskedPuzzle;
}

/**
 * What the page shows for its address, as a game links to it (`insideQuery`): the film of the
 * puzzle `id` of `game` where it has one and `p` (if given) checks out, or else the game's
 * example. Null for an address without a game that has a film.
 */
export function filmFor(query: URLSearchParams): Showing | null {
	const entry = FILMS.find((f) => f.id === query.get('game'));
	if (!entry) return null;
	const logic = GAME_LOGIC[entry.id];
	const example = (asked?: AskedPuzzle): Showing => ({
		entry,
		type: entry.type,
		film: entry.make(),
		asked
	});
	const id = parsePlayableId(query.get('id'), logic.variants);
	if (!id) return example();
	const { variantIndex, seed } = decodePuzzleId(id);
	const variant = logic.variants[variantIndex];
	if (!entry.replays(variant)) return example({ id, variant, missing: 'type' });
	const check = query.get('p');
	if (check && check !== puzzleCheck(logic.generate(variant, seed))) {
		return example({ id, variant, missing: 'version' });
	}
	return { entry, type: variant, film: entry.make(seed, variant), asked: { id, variant } };
}
