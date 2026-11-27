import { packDigits, unpackDigits } from '../../core/grid';
import type { GameLogic } from '../../core/types';
import type { Variant } from '../../core/variants';
import type { PixelsSettingKey } from './settings';
import { fitsPixelsDifficulty, generatePixels } from './generator';
import { CROSS, EMPTY, FILLED, isSolvedState, type PixelsPuzzle, type PixelsState } from './rules';
import { solvePixels } from './solver';

/**
 * Every type of Pixels, in their final order: puzzle IDs hold a type's place in this list, so
 * new types may only be appended.
 */
const regular = (size: number): Variant[] =>
	(['normal', 'hard'] as const).map((difficulty) => ({
		key: `${size}${difficulty[0]}`,
		label: `${size}x${size} ${difficulty === 'normal' ? 'Normal' : 'Hard'}`,
		width: size,
		height: size,
		difficulty
	}));

export const PIXELS_VARIANTS: Variant[] = [
	...[5, 10, 15, 20, 25].flatMap(regular),
	{
		key: 'daily',
		label: 'Special Daily',
		width: 10,
		height: 10,
		difficulty: 'normal',
		special: 'daily'
	},
	{
		key: 'weekly',
		label: 'Special Weekly',
		width: 15,
		height: 15,
		difficulty: 'hard',
		special: 'weekly'
	},
	{
		key: 'monthly',
		label: 'Special Monthly',
		width: 25,
		height: 25,
		difficulty: 'hard',
		special: 'monthly'
	}
];

/** Whether `clue` is a line's blocks: whole numbers from 1, that fit into `length` cells. */
function isClue(clue: unknown, length: number): clue is number[] {
	if (!Array.isArray(clue) || clue.length > length) return false;
	if (!clue.every((b) => Number.isInteger(b) && b >= 1)) return false;
	return clue.reduce((sum, b) => sum + b, 0) + clue.length - 1 <= length;
}

const filledIn = (clues: number[][]) =>
	clues.reduce((sum, clue) => sum + clue.reduce((a, b) => a + b, 0), 0);

export const pixelsLogic: GameLogic<PixelsPuzzle, PixelsState, PixelsSettingKey> = {
	id: 'pixels',
	variants: PIXELS_VARIANTS,
	generate: (v, seed) => generatePixels(v.width, v.height, v.difficulty, seed).puzzle,
	countSolutions(p, limit) {
		const res = solvePixels(p, limit, 5_000);
		return { count: res.solutions.length, finished: res.finished };
	},
	// Normal: the lines alone decide every cell; hard: it needs the probe (`fitsPixelsDifficulty`).
	fitsDifficulty: (p, v) => fitsPixelsDifficulty(p, v.difficulty),
	isValidPuzzle(p: unknown, v): p is PixelsPuzzle {
		if (!p || typeof p !== 'object') return false;
		const q = p as PixelsPuzzle;
		if (q.width !== v.width || q.height !== v.height) return false;
		if (!Array.isArray(q.rows) || q.rows.length !== v.height) return false;
		if (!Array.isArray(q.cols) || q.cols.length !== v.width) return false;
		if (!q.rows.every((clue) => isClue(clue, v.width))) return false;
		if (!q.cols.every((clue) => isClue(clue, v.height))) return false;
		// The rows and the columns fill the same cells.
		return filledIn(q.rows) === filledIn(q.cols);
	},
	emptyState: (p) => ({ cells: new Array<number>(p.width * p.height).fill(EMPTY) }),
	isSolved: isSolvedState,
	answer: (_, s) => s.cells.map((m) => (m === FILLED ? '1' : '0')).join(''),
	verifyAnswer(p, answer) {
		if (answer.length !== p.width * p.height || !/^[01]+$/.test(answer)) return false;
		return isSolvedState(p, { cells: Array.from(answer, Number) });
	},
	encodeState: (s) => packDigits(s.cells),
	decodeState(p, text) {
		try {
			const cells = unpackDigits(text, p.width * p.height);
			return cells.every((m) => m <= CROSS) ? { cells } : null;
		} catch {
			return null;
		}
	},
	isValidState(p, s: unknown): s is PixelsState {
		if (!s || typeof s !== 'object') return false;
		const cells = (s as PixelsState).cells;
		return (
			Array.isArray(cells) &&
			cells.length === p.width * p.height &&
			cells.every((m) => Number.isInteger(m) && m >= EMPTY && m <= CROSS)
		);
	}
};
