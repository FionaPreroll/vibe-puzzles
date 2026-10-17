import type { Film } from '../lib/inside/film';

const frame = (key: string, hold?: number) => ({
	puzzle: null,
	state: null,
	caption: { key },
	hold
});

/** A film for the player's tests: three chapters of 3, 1 and 4 frames. */
export const FILM: Film<null, null> = {
	game: 'sudoku',
	chapters: [
		{ title: 'a', frames: [frame('a0', 2), frame('a1'), frame('a2')] },
		{ title: 'b', frames: [frame('b0')] },
		{ title: 'c', frames: [frame('c0'), frame('c1'), frame('c2'), frame('c3', 0.5)] }
	]
};
