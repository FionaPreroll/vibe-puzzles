import { packDigits, unpackDigits } from '../../core/grid';
import type { GameLogic } from '../../core/types';
import type { Variant } from '../../core/variants';
import type { LoopSettingKey } from './settings';
import { generateLoop, solvesWithoutGuessing } from './generator';
import {
	CROSS,
	edgeValues,
	emptyLoopState,
	isSolvedState,
	LINE,
	MAX_CLUE,
	stateFromEdges,
	type LoopPuzzle,
	type LoopState
} from './rules';
import { solveLoop } from './solver';

/**
 * Every type Loop will have. Only the first one is playable in early access; the others are
 * listed as coming soon until their generator settings are tuned (`comingSoon`). Their place in
 * this list is final already, as puzzle IDs hold it.
 */
const regular = (width: number, height: number, key: string, comingSoon: boolean): Variant[] => [
	{
		key: `${key}n`,
		label: `${width}x${height} Normal`,
		width,
		height,
		difficulty: 'normal',
		...(comingSoon && { comingSoon })
	},
	{
		key: `${key}h`,
		label: `${width}x${height} Hard`,
		width,
		height,
		difficulty: 'hard',
		comingSoon: true
	}
];

export const LOOP_VARIANTS: Variant[] = [
	...regular(5, 5, '5', false),
	...regular(7, 7, '7', true),
	...regular(10, 10, '10', true),
	...regular(15, 15, '15', true),
	...regular(20, 20, '20', true),
	...regular(25, 30, '25x30', true),
	{
		key: 'daily',
		label: 'Special Daily',
		width: 10,
		height: 10,
		difficulty: 'normal',
		special: 'daily',
		comingSoon: true
	},
	{
		key: 'weekly',
		label: 'Special Weekly',
		width: 15,
		height: 15,
		difficulty: 'hard',
		special: 'weekly',
		comingSoon: true
	},
	{
		key: 'monthly',
		label: 'Special Monthly',
		width: 25,
		height: 30,
		difficulty: 'hard',
		special: 'monthly',
		comingSoon: true
	}
];

const isArray = (a: unknown, n: number, max: number): a is number[] =>
	Array.isArray(a) && a.length === n && a.every((x) => Number.isInteger(x) && x >= 0 && x <= max);

const CLUES = new RegExp(`^[.0-${MAX_CLUE}]+$`);

/** Answer: one character per edge (h edges first, then v edges), 1 = line. */
const answerOf = (s: LoopState) =>
	edgeValues(s)
		.map((x) => (x === LINE ? '1' : '0'))
		.join('');

export const loopLogic: GameLogic<LoopPuzzle, LoopState, LoopSettingKey> = {
	id: 'loop',
	variants: LOOP_VARIANTS,
	generate: (v, seed) => generateLoop(v.width, v.height, v.difficulty, seed).puzzle,
	countSolutions(p, limit) {
		const res = solveLoop(p, { limit, maxNodes: 2_000_000 });
		return { count: res.solutions.length, finished: res.finished };
	},
	// Normal: propagation alone solves it; hard: it needs case analysis.
	fitsDifficulty: (p, v) => solvesWithoutGuessing(p) === (v.difficulty === 'normal'),
	isValidPuzzle(p: unknown, v): p is LoopPuzzle {
		if (!p || typeof p !== 'object') return false;
		const q = p as LoopPuzzle;
		return (
			q.width === v.width &&
			q.height === v.height &&
			typeof q.clues === 'string' &&
			q.clues.length === v.width * v.height &&
			CLUES.test(q.clues)
		);
	},
	emptyState: emptyLoopState,
	isSolved: isSolvedState,
	answer: (_, s) => answerOf(s),
	verifyAnswer(p, answer) {
		const n = edgeValues(emptyLoopState(p)).length;
		if (answer.length !== n || !/^[01]+$/.test(answer)) return false;
		return isSolvedState(
			p,
			stateFromEdges(
				p,
				[...answer].map((x) => (x === '1' ? LINE : 0))
			)
		);
	},
	encodeState: (s) => [s.h, s.v].map(packDigits).join('.'),
	decodeState(p, text) {
		try {
			const parts = text.split('.');
			if (parts.length !== 2) return null;
			const e = emptyLoopState(p);
			const s: LoopState = {
				h: unpackDigits(parts[0], e.h.length),
				v: unpackDigits(parts[1], e.v.length)
			};
			return this.isValidState(p, s) ? s : null;
		} catch {
			return null;
		}
	},
	isValidState(p, s: unknown): s is LoopState {
		if (!s || typeof s !== 'object') return false;
		const t = s as LoopState;
		const e = emptyLoopState(p);
		return isArray(t.h, e.h.length, CROSS) && isArray(t.v, e.v.length, CROSS);
	}
};
