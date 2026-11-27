import { packDigits, unpackDigits } from '../../core/grid';
import type { GameLogic } from '../../core/types';
import type { Variant } from '../../core/variants';
import type { BridgesSettingKey } from './settings';
import { fitsBridgesDifficulty, generateBridges } from './generator';
import {
	bridgesGraph,
	bridgesOf,
	CROSS,
	emptyBridgesState,
	graphOf,
	isSolvedState,
	linksOf,
	MAX_BRIDGES,
	type BridgesPuzzle,
	type BridgesState
} from './rules';
import { solveBridges } from './solver';

/**
 * Every type of Bridges, in their final order: puzzle IDs hold a type's place in this list, so
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

export const BRIDGES_VARIANTS: Variant[] = [
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

const ISLANDS = /^[.1-8]+$/;

/** Answer: the bridges of each link, one digit 0 to 2 per link in the puzzle's order. */
const answerOf = (s: BridgesState) => s.links.map((v) => bridgesOf(v)).join('');

export const bridgesLogic: GameLogic<BridgesPuzzle, BridgesState, BridgesSettingKey> = {
	id: 'bridges',
	variants: BRIDGES_VARIANTS,
	generate: (v, seed) => generateBridges(v.width, v.height, v.difficulty, seed).puzzle,
	countSolutions(p, limit) {
		const res = solveBridges(p, limit, 1_000_000);
		return { count: res.solutions.length, finished: res.finished };
	},
	// Normal: counting and closed groups decide it; hard: it needs more (see `fitsLevel`).
	fitsDifficulty: (p, v) => fitsBridgesDifficulty(p, v.difficulty),
	isValidPuzzle(p: unknown, v): p is BridgesPuzzle {
		if (!p || typeof p !== 'object') return false;
		const q = p as BridgesPuzzle;
		if (q.width !== v.width || q.height !== v.height) return false;
		if (typeof q.islands !== 'string' || q.islands.length !== v.width * v.height) return false;
		if (!ISLANDS.test(q.islands)) return false;
		const g = bridgesGraph(q);
		if (g.cells.length < 2) return false;
		// Every bridge counts at both its islands; no island takes more than its links can hold,
		// and none lies right next to another one.
		if (g.clue.reduce((a, b) => a + b, 0) % 2) return false;
		return g.cells.every(
			(cell, i) =>
				g.clue[i] <= MAX_BRIDGES * linksOf(g, i).length &&
				(cell % v.width === v.width - 1 || q.islands[cell + 1] === '.') &&
				(cell + v.width >= q.islands.length || q.islands[cell + v.width] === '.')
		);
	},
	emptyState: emptyBridgesState,
	isSolved: isSolvedState,
	answer: (_, s) => answerOf(s),
	verifyAnswer(p, answer) {
		const n = emptyBridgesState(p).links.length;
		if (answer.length !== n || !/^[0-2]*$/.test(answer)) return false;
		return isSolvedState(p, { links: Array.from(answer, Number) });
	},
	encodeState: (s) => packDigits(s.links),
	decodeState(p, text) {
		try {
			const s: BridgesState = { links: unpackDigits(text, emptyBridgesState(p).links.length) };
			return this.isValidState(p, s) ? s : null;
		} catch {
			return null;
		}
	},
	isValidState(p, s: unknown): s is BridgesState {
		if (!s || typeof s !== 'object') return false;
		const links = (s as BridgesState).links;
		const g = graphOf(p);
		if (!Array.isArray(links) || links.length !== g.ends.length / 2) return false;
		if (!links.every((x) => Number.isInteger(x) && x >= 0 && x <= CROSS)) return false;
		// The board never lets two bridges cross.
		return links.every((x, l) => !bridgesOf(x) || g.crossing[l].every((m) => !bridgesOf(links[m])));
	}
};
