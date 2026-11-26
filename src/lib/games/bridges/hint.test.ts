import { describe, expect, it } from 'vitest';
import de from '../../i18n/de';
import en from '../../i18n/en';
import { generateBridges } from './generator';
import { bridgesHint, bridgesSolution, solvesFrom, type BridgesHint } from './hint';
import { bridges } from './index';
import {
	CROSS,
	emptyBridgesState,
	isSolvedState,
	type BridgesPuzzle,
	type BridgesState
} from './rules';
import { BridgesLevel } from './solver';

const board = (...rows: string[]): BridgesPuzzle => ({
	width: rows[0].length,
	height: rows.length,
	islands: rows.join('')
});

/** See bridges.test.ts. */
const RING = board('2.2', '...', '2.2');
const RING3 = board('3.3', '...', '3.3');
const PLUS = board('.1.', '1.1', '.1.');
/**
 * Two rings of 3s joined by link 4 between the 4s. Four solutions (each ring has two), but all
 * need one bridge on link 4. Links 0 to 3 make the left ring, 5 to 8 the right one.
 */
const JOINED_ROWS = ['3.3....', '.......', '3.4.4.3', '.......', '....3.3'];
const JOINED = board(...JOINED_ROWS);

/** `s` with the bridges a step asks for. */
const apply = (s: BridgesState, h: Extract<BridgesHint, { kind: 'step' }>): BridgesState => ({
	links: s.links.map((v, l) => (h.links.includes(l) ? h.bridges : v))
});

/** Follows the hints from `s` while they give steps; every hint on the way goes to `seen`. */
function follow(
	p: BridgesPuzzle,
	s: BridgesState,
	seen: (h: BridgesHint, s: BridgesState) => void
) {
	for (let n = 0; n <= s.links.length * 2; n++) {
		const h = bridgesHint(p, s);
		if (!h) break;
		seen(h, s);
		if (h.kind !== 'step') break;
		s = apply(s, h);
	}
	return s;
}

const lookup = (dict: object, key: string) =>
	key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], dict);

describe('bridges hints', () => {
	it('lead from the empty board to the solution, a correct step at a time', () => {
		const techniques = new Set<string>();
		const reasons = new Set<string>();
		for (const [difficulty, seeds] of [
			['normal', [1, 3, 4, 6]],
			['hard', [1, 4, 5, 10, 184]]
		] as const) {
			for (const seed of seeds) {
				const { puzzle, solution } = generateBridges(7, 7, difficulty, seed);
				const end = follow(puzzle, emptyBridgesState(puzzle), (h, s) => {
					expect(h.kind, `${difficulty} ${seed}`).toBe('step');
					if (h.kind !== 'step') return;
					techniques.add(h.technique);
					for (const x of h.support) {
						reasons.add(`${x.reason} ${x.most}`);
						// A support link takes no more than it says, and the player has not crossed it.
						expect(solution[x.link]).toBeLessThanOrEqual(x.most);
						expect(s.links[x.link]).not.toBe(CROSS);
					}
					for (const l of h.links) {
						expect(solution[l]).toBeGreaterThanOrEqual(h.bridges);
						expect(s.links[l]).toBeLessThan(h.bridges);
					}
					expect(h.area).toEqual(expect.arrayContaining(h.links));
				});
				expect(isSolvedState(puzzle, end)).toBe(true);
				expect(bridgesHint(puzzle, end)).toBeNull();
			}
		}
		expect([...techniques].sort()).toEqual(['assumption', 'combo', 'connect', 'need']);
		expect([...reasons].sort()).toEqual([
			'blocked 0',
			'capacity 1',
			'full 0',
			'full 1',
			'isolation 0',
			'isolation 1'
		]);
	});

	it('take the player’s crosses into account', () => {
		const { puzzle, solution } = generateBridges(7, 7, 'hard', 4);
		const crossed = { links: solution.map((v) => (v ? 0 : CROSS)) };
		expect(solvesFrom(puzzle, crossed, BridgesLevel.Isolation)).toBe(true);
		expect(solvesFrom(puzzle, emptyBridgesState(puzzle), BridgesLevel.Connect)).toBe(false);
		expect(solvesFrom(puzzle, emptyBridgesState(puzzle), BridgesLevel.Trial)).toBe(true);
		follow(puzzle, crossed, (h) => {
			expect(h.kind).toBe('step');
			// No link needs a reason why it stays empty: the player crossed them all.
			if (h.kind === 'step') expect(h.support.filter((x) => !x.most)).toEqual([]);
		});
	});

	it('start with the island that takes all its links can hold', () => {
		expect(bridgesHint(board('2.4.2'), { links: [0, 0] })).toEqual({
			kind: 'step',
			technique: 'need',
			links: [0],
			bridges: 2,
			island: 0,
			islands: [0, 1],
			area: [0],
			support: [],
			all: true
		});
		expect(bridgesHint(board('1.2.1'), { links: [0, 0] })).toMatchObject({
			technique: 'need',
			links: [0],
			bridges: 1
		});
	});

	it('point out bridges and crosses that do not match the solution', () => {
		expect(bridgesHint(RING, { links: [2, 0, 0, 0] })).toEqual({ kind: 'mistake', links: [0] });
		expect(bridgesHint(RING, { links: [1, CROSS, 0, 1] })).toEqual({ kind: 'mistake', links: [1] });
		expect(bridgesHint(RING, { links: [1, 1, 1, 1] })).toBeNull();
	});

	it('find the only way left between two parts of the board', () => {
		expect(bridgesHint(JOINED, { links: [1, 1, 1, 1, 0, 1, 1, 1, 1] })).toEqual({
			kind: 'step',
			technique: 'connect',
			links: [4],
			bridges: 1,
			islands: [4, 5, 7, 6],
			area: [5, 6, 7, 8, 4],
			support: []
		});
		// With a ninth island below the right ring, the left ring is the smaller part: the hint
		// tints that one.
		const nine = board(...JOINED_ROWS.slice(0, 4), '....3.4', '.......', '......1');
		expect(bridgesHint(nine, { links: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1] })).toMatchObject({
			technique: 'connect',
			links: [4],
			islands: [0, 1, 2, 3]
		});
	});

	it('say so where no rule decides a link', () => {
		const solution = bridgesSolution(RING3)!;
		const hint = bridgesHint(RING3, { links: [1, 1, 1, 1] });
		expect(hint?.kind).toBe('stuck');
		// A link that lacks a bridge in the solution the hints follow.
		expect(hint?.kind === 'stuck' && solution[hint.links[0]]).toBe(2);
	});

	it('work on a board without a solution, short of a mistake', () => {
		expect(bridgesSolution(PLUS)).toBeNull();
		// The top island has its bridge: the left one can get none, whatever comes.
		expect(bridgesHint(PLUS, { links: [1, 0] })).toMatchObject({
			technique: 'assumption',
			links: [0],
			bridges: 2,
			breaks: 'count'
		});
		// Bridges that cross, which the board never builds.
		expect(bridgesHint(PLUS, { links: [1, 1] })).toMatchObject({
			technique: 'assumption',
			breaks: 'cross'
		});
		// Two bridges for a 1: nothing is open.
		expect(bridgesHint(PLUS, { links: [2, CROSS] })).toEqual({ kind: 'stuck', links: [] });
		expect(bridgesHint(PLUS, { links: [0, 0] })).toMatchObject({ kind: 'step', links: [0] });
	});

	it('come with texts in every language, first where to look, then the bridges', () => {
		const keys = new Set<string>();
		const kinds = new Set<string>();
		const collect = (p: BridgesPuzzle, s: BridgesState) =>
			follow(p, s, (_, at) => {
				const hint = bridges.hint!(p, at)!;
				kinds.add(hint.kind);
				for (const key of [...hint.text, ...(hint.teaser ?? [])]) keys.add(key);
				if (hint.kind !== 'step') return;
				expect(hint.text.at(-1)).toMatch(/^games\.bridges\.hints\.then[12](Each)?$/);
				expect(hint.area).not.toContain(hint.spotlight[0]);
			});
		for (const [difficulty, seed] of [
			['normal', 3],
			['hard', 1],
			['hard', 4],
			['hard', 184]
		] as const) {
			const { puzzle } = generateBridges(7, 7, difficulty, seed);
			collect(puzzle, emptyBridgesState(puzzle));
		}
		collect(RING, { links: [2, 0, 0, 0] });
		collect(RING3, { links: [1, 1, 1, 1] });
		expect([...kinds].sort()).toEqual(['mistake', 'step', 'stuck']);
		for (const key of Object.keys(en.games.bridges.hints)) keys.add(`games.bridges.hints.${key}`);
		for (const key of keys) {
			expect(lookup(en, key), key).toBeTypeOf('string');
			expect(lookup(de, key), key).toBeTypeOf('string');
		}
		expect(Object.keys(de.games.bridges.hints).sort()).toEqual(
			Object.keys(en.games.bridges.hints).sort()
		);
	});

	it('word a need step from the look to the bridges', () => {
		const hint = bridges.hint!(board('2.4.2'), { links: [0, 0] })!;
		expect(hint).toEqual({
			kind: 'step',
			spotlight: ['l:0'],
			area: ['c:0', 'c:2'],
			teaser: ['games.bridges.hints.needLook'],
			text: [
				'games.bridges.hints.needLook',
				'games.bridges.hints.needAll',
				'games.bridges.hints.then2'
			]
		});
		expect(bridges.hint!(RING, { links: [1, 1, 1, 1] })).toBeNull();
		expect(bridges.hint!(RING, { links: [2, 0, 0, 0] })).toEqual({
			kind: 'mistake',
			spotlight: ['l:0'],
			text: ['games.bridges.hints.mistake']
		});
		expect(bridges.hint!(PLUS, { links: [1, 0] })).toMatchObject({
			kind: 'step',
			spotlight: ['l:0'],
			teaser: ['games.bridges.hints.assumeLook'],
			text: [
				'games.bridges.hints.assumeOne',
				'games.bridges.hints.breaksCount',
				'games.bridges.hints.then2'
			]
		});
		expect(bridges.hint!(RING3, { links: [1, 1, 1, 1] })).toMatchObject({
			kind: 'stuck',
			text: ['games.bridges.hints.stuck']
		});
	});

	it('word a tried link by what breaks', () => {
		const { puzzle } = generateBridges(7, 7, 'hard', 4);
		const texts: string[][] = [];
		follow(puzzle, emptyBridgesState(puzzle), (h, at) => {
			if (h.kind === 'step' && h.technique === 'assumption')
				texts.push(bridges.hint!(puzzle, at)!.text);
		});
		expect(texts.length).toBeGreaterThan(0);
		for (const text of texts) {
			expect(text[0]).toMatch(/^games\.bridges\.hints\.assume(None|One)$/);
			expect(text[1]).toMatch(/^games\.bridges\.hints\.breaks(Count|Closed|Cut|Cross)$/);
		}
	});
});
