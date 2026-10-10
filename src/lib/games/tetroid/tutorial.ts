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

/** A task that marks the given cells: done once they all have `mark`; "Show me" sets them. */
function markStep(cells: number[], mark: number): TutorialStep<TetroidPuzzle, TetroidState> {
	return {
		spotlight: cells.map(String),
		done: (_, s) => cells.every((i) => s.marks[i] === mark),
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
	// No 2×2 block: each of these cells would complete one, so both stay empty.
	markStep([8, 10], CROSS),
	// The last two rules, still without a task; an L on cell 9 would touch the L above it.
	{ spotlight: ['9'] },
	// The rest alone; the tutorial ends when the board is solved.
	{}
];
