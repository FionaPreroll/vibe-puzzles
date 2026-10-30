import { packDigits, unpackDigits } from '../../core/grid';
import type { GameLogic } from '../../core/types';
import type { Variant } from '../../core/variants';
import type { PipesSettingKey } from './settings';
import { generatePipes } from './generator';
import {
	dealt,
	emptyPipesState,
	isSolvedTiles,
	openings,
	turnsOf,
	validMarks,
	withMarks,
	type PipesPuzzle,
	type PipesState
} from './rules';
import { PipesSolver, solvePipes } from './solver';

/**
 * Every type of Pipes, in their final order: puzzle IDs hold a type's place in this list, so new
 * types may only be appended. Each size comes with a board edge and without one (wrap). There are
 * no difficulty levels: size and wrap make a puzzle harder.
 */
const regular = (size: number): Variant[] =>
	[false, true].map((wrap) => ({
		key: `${size}${wrap ? 'w' : 'n'}`,
		label: `${size}x${size} ${wrap ? 'Wrap' : 'Normal'}`,
		width: size,
		height: size,
		difficulty: 'normal' as const,
		...(wrap && { wrap })
	}));

export const PIPES_VARIANTS: Variant[] = [
	...regular(5),
	...regular(7),
	...regular(10),
	...regular(15),
	...regular(20),
	...regular(25),
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
		difficulty: 'normal',
		wrap: true,
		special: 'weekly'
	},
	{
		key: 'monthly',
		label: 'Special Monthly',
		width: 25,
		height: 25,
		difficulty: 'normal',
		wrap: true,
		special: 'monthly'
	}
];

/** One hex digit per tile, 1 to 14: no tile without an opening, and no cross (15). */
const TILES = /^[1-9a-e]+$/;

/** Whether `tiles` lie as the dealt tiles of `p` can, each turned some way. */
const turnsOfDealt = (p: PipesPuzzle, tiles: readonly number[]) => {
	const start = dealt(p);
	return tiles.length === start.length && tiles.every((t, c) => turnsOf(start[c]).includes(t));
};

const hex = (tiles: readonly number[]) => tiles.map((t) => t.toString(16)).join('');

export const pipesLogic: GameLogic<PipesPuzzle, PipesState, PipesSettingKey> = {
	id: 'pipes',
	variants: PIPES_VARIANTS,
	generate: (v, seed) => generatePipes(v.width, v.height, !!v.wrap, seed).puzzle,
	countSolutions(p, limit) {
		const res = solvePipes(p, limit);
		return { count: res.solutions.length, finished: res.finished };
	},
	// Every puzzle is made so that the techniques solve it without trying anything.
	fitsDifficulty: (p) => new PipesSolver(p).solvesAlone() !== null,
	isValidPuzzle(p: unknown, v): p is PipesPuzzle {
		if (!p || typeof p !== 'object') return false;
		const q = p as PipesPuzzle;
		if (q.width !== v.width || q.height !== v.height || q.wrap !== !!v.wrap) return false;
		if (typeof q.tiles !== 'string' || q.tiles.length !== v.width * v.height) return false;
		if (!TILES.test(q.tiles)) return false;
		// The pipes of a network that joins every tile without a loop: one fewer than the tiles.
		const ends = dealt(q).reduce((sum, t) => sum + openings(t), 0);
		return ends === 2 * (q.tiles.length - 1);
	},
	emptyState: emptyPipesState,
	isSolved: (p, s) => isSolvedTiles(p, s.tiles),
	answer: (_, s) => hex(s.tiles),
	verifyAnswer(p, answer) {
		if (answer.length !== p.width * p.height || !TILES.test(answer)) return false;
		const tiles = Array.from(answer, (ch) => parseInt(ch, 16));
		return turnsOfDealt(p, tiles) && isSolvedTiles(p, tiles);
	},
	// The marks come third, only where there are any: a position without them reads as before.
	encodeState: (s) =>
		[s.tiles, s.locks, ...(s.marks?.some(Boolean) ? [s.marks] : [])].map(packDigits).join('.'),
	decodeState(p, text) {
		try {
			const parts = text.split('.');
			if (parts.length !== 2 && parts.length !== 3) return null;
			const n = p.width * p.height;
			const [tiles, locks, marks] = parts.map((part) => unpackDigits(part, n));
			const s = withMarks({ tiles, locks }, marks);
			return this.isValidState(p, s) ? s : null;
		} catch {
			return null;
		}
	},
	isValidState(p, s: unknown): s is PipesState {
		if (!s || typeof s !== 'object') return false;
		const t = s as PipesState;
		const n = p.width * p.height;
		return (
			Array.isArray(t.tiles) &&
			Array.isArray(t.locks) &&
			t.locks.length === n &&
			t.locks.every((x) => x === 0 || x === 1) &&
			t.tiles.every((x) => Number.isInteger(x)) &&
			turnsOfDealt(p, t.tiles) &&
			(t.marks === undefined || validMarks(p, t.marks))
		);
	}
};
