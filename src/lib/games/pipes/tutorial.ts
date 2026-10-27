import type { TutorialStep } from '../../core/types';
import type { PipesPuzzle, PipesState } from './rules';

/**
 * First puzzle for new players, 5×5, as dealt. Most tiles already lie right, so that the water
 * shows from the start. The steps: the corner piece in the top left corner fits only one way;
 * locking it; the end below it has to meet its pipe; the end in the top right corner must not
 * face the end next to it. Three more tiles are left for the player.
 */
// prettier-ignore
const DEALT = [
	9, 10, 14, 8, 8,
	2, 4, 13, 2, 13,
	6, 14, 11, 5, 9,
	5, 6, 14, 10, 12,
	3, 8, 1, 2, 9
];

export const PIPES_TUTORIAL: PipesPuzzle = {
	width: 5,
	height: 5,
	wrap: false,
	tiles: DEALT.map((t) => t.toString(16)).join('')
};

/** The tiles the steps are about, and how they lie in the solution. */
const CORNER = 0;
const BELOW = 5;
const TOP_RIGHT = 4;
const LEFT_OF_IT = 3;

/** `list` with `value` at `index`. */
const replaced = (list: readonly number[], index: number, value: number) =>
	list.map((x, i) => (i === index ? value : x));

/** A task that turns `cell` to lie as `mask`; "Show me" turns it. */
function turnStep(
	cell: number,
	mask: number,
	spotlight: number[]
): TutorialStep<PipesPuzzle, PipesState> {
	return {
		spotlight: spotlight.map(String),
		done: (_, s) => s.tiles[cell] === mask,
		show: (_, s) => ({ tiles: replaced(s.tiles, cell, mask), locks: s.locks })
	};
}

/** Texts under `games.pipes.tutorial`, one per step. */
export const PIPES_TUTORIAL_STEPS: TutorialStep<PipesPuzzle, PipesState>[] = [
	// The goal: one network of pipes, the source and its water.
	{},
	// No pipe leads off the board: a corner piece in a corner of the board fits one way only.
	turnStep(CORNER, 6, [CORNER]),
	// Locking what is settled.
	{
		spotlight: [String(CORNER)],
		done: (_, s) => s.locks[CORNER] === 1 && s.tiles[CORNER] === 6,
		show: (_, s) => ({
			tiles: replaced(s.tiles, CORNER, 6),
			locks: replaced(s.locks, CORNER, 1)
		})
	},
	// A pipe needs a pipe back: the end below the corner points up.
	turnStep(BELOW, 1, [BELOW, CORNER]),
	// Two ends must not face each other: the end in the top right corner points down.
	turnStep(TOP_RIGHT, 4, [TOP_RIGHT, LEFT_OF_IT]),
	// The rest alone; the tutorial ends when the network is complete.
	{}
];
