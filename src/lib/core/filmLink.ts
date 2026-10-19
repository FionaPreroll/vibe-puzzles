import { hashString } from './rng';
import type { Variant } from './variants';

/**
 * The game's side of the Inside page, which shows how puzzles are made as films: which games have
 * a film, and how the page knows the puzzle a game links to. Which types a film shows as they
 * were made is up to the page (`src/lib/inside/films/index.ts`); the game never imports it.
 */

/** The games with a film. Sudoku's Calcudoku mode has none. */
export const FILM_GAMES: readonly string[] = ['sudoku', 'pinwheel', 'tetroid', 'loop'];

/**
 * A short check of a puzzle, the same for equal puzzles whatever the order of their keys. The page
 * compares it with the puzzle the generator makes from the ID now, which differs for a collection
 * puzzle made by an earlier version of the generator.
 */
export function puzzleCheck(puzzle: unknown): string {
	const sorted = (x: unknown): unknown => {
		if (Array.isArray(x)) return x.map(sorted);
		if (typeof x !== 'object' || x === null) return x;
		const o = x as Record<string, unknown>;
		return Object.fromEntries(
			Object.keys(o)
				.sort()
				.map((k) => [k, sorted(o[k])])
		);
	};
	return hashString(JSON.stringify(sorted(puzzle))).toString(36);
}

/** The Inside page's query for the making of a puzzle, or null where its game has no film. */
export function insideQuery(
	game: string,
	variant: Variant,
	puzzleId: number,
	puzzle: unknown
): string | null {
	if (!FILM_GAMES.includes(game) || variant.mode) return null;
	return `game=${game}&id=${puzzleId}&p=${puzzleCheck(puzzle)}`;
}
