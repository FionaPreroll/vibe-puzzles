import type { TutorialStep } from '../../core/types';
import type { TetroidPuzzle, TetroidState } from './rules';
import { CROSS, EMPTY, SHADED } from './rules';

/** First puzzle for new players: 5×5 with four regions (S, L, I, S); the top-left S is given. */
export const TETROID_TUTORIAL: TetroidPuzzle = {
	width: 5,
	height: 5,
	// prettier-ignore
	regions: [
		0, 0, 1, 1, 1,
		0, 0, 1, 3, 3,
		2, 0, 3, 3, 3,
		2, 0, 3, 3, 3,
		2, 2, 2, 2, 3
	]
};

export function tetroidTutorialStart(p: TetroidPuzzle): TetroidState {
	const marks = new Array(p.width * p.height).fill(EMPTY);
	for (const i of [0, 5, 6, 11]) marks[i] = SHADED;
	for (const i of [1, 16]) marks[i] = CROSS;
	return { marks, auto: new Array(p.width * p.height).fill(0) };
}

/**
 * A task that marks the given cells: done once they all have `mark` and none of `unshaded` is
 * shaded; "Show me" sets them. `spotlight` defaults to the cells.
 */
function markStep(
	cells: number[],
	mark: number,
	{ spotlight = cells, unshaded = [] }: { spotlight?: number[]; unshaded?: number[] } = {}
): TutorialStep<TetroidPuzzle, TetroidState> {
	return {
		spotlight: spotlight.map(String),
		done: (_, s) =>
			cells.every((i) => s.marks[i] === mark) && unshaded.every((i) => s.marks[i] !== SHADED),
		show: (_, s) => {
			const marks = s.marks.slice();
			const auto = s.auto.slice();
			for (const i of cells) {
				marks[i] = mark;
				auto[i] = 0;
			}
			return { marks, auto };
		}
	};
}

/** Texts under `games.tetroid.tutorial`, one per step. */
export const TETROID_TUTORIAL_STEPS: TutorialStep<TetroidPuzzle, TetroidState>[] = [
	// What a tetromino is, with the given S as the example.
	{ spotlight: ['0', '5', '6', '11'] },
	// The top-right region has exactly four cells: they are its tetromino (an L).
	markStep([2, 3, 4, 7], SHADED),
	// No 2×2 block: each of these cells would complete one, so all three stay empty.
	markStep([8, 10, 12], CROSS),
	// Connectivity: cell 9 is the top-left group's last way out, so it is shaded.
	markStep([9], SHADED),
	// The look-ahead of #99: an L at the bottom (15, 20, 21, 22) could only connect through cell 17,
	// which no tetromino with cell 9 reaches. So the bottom region holds the I.
	markStep([20, 21, 22, 23], SHADED, { spotlight: [15, 20, 21, 22, 23], unshaded: [15] }),
	// The same-shape rule, then the big region alone; the tutorial ends when the board is solved.
	{}
];
