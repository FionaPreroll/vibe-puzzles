import type { PinwheelPuzzle } from './rules';

/** First puzzle for new players: 5×5 with seven regions of different shapes. */
export const PINWHEEL_TUTORIAL: PinwheelPuzzle = {
	width: 5,
	height: 5,
	centres: [
		[0, 4],
		[0, 7],
		[2, 1],
		[3, 5],
		[3, 8],
		[7, 0],
		[7, 5]
	]
};
