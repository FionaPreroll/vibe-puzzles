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
