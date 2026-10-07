/**
 * The puzzle collection: pre-generated puzzles in `static/puzzles/<game>/<variant>.json`, grown
 * by a scheduled GitHub workflow (scripts/grow-puzzle-bank.ts). Each entry is checked for a
 * unique solution before it is added, and again by the tests.
 */
export interface PuzzleBank<P = unknown> {
	version: 1;
	game: string;
	variant: string;
	puzzles: { id: number; puzzle: P }[];
}

export const bankPath = (game: string, variant: string) => `puzzles/${game}/${variant}.json`;
