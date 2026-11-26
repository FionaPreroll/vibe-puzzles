import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { isPlayable } from '../../core/variants';
import { i18n } from '../../i18n/index.svelte';
import { groupRings, joinedTo } from './draw';
import {
	fitsBridgesDifficulty,
	fitsLevel,
	generateBridges,
	puzzleOf,
	randomBridges,
	randomIslands
} from './generator';
import { bridges } from './index';
import { linkAt, linkBetween, nextValue, setLinks } from './input';
import { BRIDGES_VARIANTS, bridgesLogic } from './logic';
import {
	across,
	analyze,
	blocked,
	bridgesGraph,
	CROSS,
	emptyBridgesState,
	graphOf,
	isSolvedState,
	islandKey,
	linkKey,
	linksOf,
	type BridgesPuzzle
} from './rules';
import {
	BridgesLevel,
	BridgesSolver,
	decidedLink,
	fewest,
	most,
	solveBridges,
	type Known
} from './solver';

/** A puzzle from its rows. */
const board = (...rows: string[]): BridgesPuzzle => ({
	width: rows[0].length,
	height: rows.length,
	islands: rows.join('')
});

/**
 * Four 2s in the corners of a 3×3 board. Links: 0 the top, 1 the left, 2 the right, 3 the
 * bottom. One solution, a ring of single bridges: two double bridges would close off two pairs.
 */
const RING = board('2.2', '...', '2.2');
/** The same with 3s: a double bridge on the top and bottom, or on the left and right. */
const RING3 = board('3.3', '...', '3.3');
/** A row of three: 0 the link on the left, 1 the one on the right. */
const LINE = board('1.2.1');
/** Two 1s above each other and two beside each other: their links cross in the middle. */
const PLUS = board('.1.', '1.1', '.1.');
/** Two rings of 3s that no link joins. */
const APART = board('3.3...', '......', '3.3...', '...3.3', '......', '...3.3');
/** A frame of eight islands with a link across and one down through the middle, crossing. */
const FRAME = board('2.3.2', '.....', '3...3', '.....', '2.3.2');

/** `k` as `[fewest, most]` per link. */
const bounds = (k: Known) =>
	Array.from({ length: k.length / 2 }, (_, l) => [k[2 * l], k[2 * l + 1]]);

describe('rules', () => {
	it('numbers the links island by island, the one to the right first', () => {
		const g = bridgesGraph(RING);
		expect(g.cells).toEqual([0, 2, 6, 8]);
		expect(g.clue).toEqual([2, 2, 2, 2]);
		expect([...g.ends]).toEqual([0, 1, 0, 2, 1, 3, 2, 3]);
		expect([...g.across]).toEqual([1, 0, 0, 1]);
		expect([...g.islandAt]).toEqual([0, -1, 1, -1, -1, -1, 2, -1, 3]);
		// Up, right, down, left.
		expect([...g.sides.slice(0, 4)]).toEqual([-1, 0, 1, -1]);
		expect([...g.sides.slice(12)]).toEqual([2, -1, -1, 3]);
		expect([...g.acrossAt]).toEqual([-1, 0, -1, -1, -1, -1, -1, 3, -1]);
		expect([...g.downAt]).toEqual([-1, -1, -1, 1, -1, 2, -1, -1, -1]);
		expect(g.crossing).toEqual([[], [], [], []]);
		expect(linksOf(g, 3)).toEqual([2, 3]);
		expect(across(g, 0, 0)).toBe(1);
		expect(across(g, 0, 1)).toBe(0);
	});

	it('knows which links cross, and which a bridge blocks', () => {
		const g = bridgesGraph(PLUS);
		// Link 0 runs down from the top island, link 1 across from the left one.
		expect([...g.ends]).toEqual([0, 3, 1, 2]);
		expect(g.crossing).toEqual([[1], [0]]);
		expect(blocked(g, [1, 0], 1)).toBe(true);
		expect(blocked(g, [CROSS, 0], 1)).toBe(false);
		expect(blocked(g, [0, 2], 1)).toBe(false);
	});

	it('keeps the graph per puzzle and starts without bridges', () => {
		expect(graphOf(RING)).toBe(graphOf(RING));
		expect(emptyBridgesState(RING)).toEqual({ links: [0, 0, 0, 0] });
		expect(linkKey(3)).toBe('l:3');
		expect(islandKey(graphOf(RING), 1)).toBe('c:2');
	});

	it('counts the bridges and joins the islands into groups', () => {
		const a = analyze(RING, { links: [1, 1, 1, 1] });
		expect(a).toEqual({
			count: [2, 2, 2, 2],
			error: [false, false, false, false],
			crossed: [false, false, false, false],
			group: [0, 0, 0, 0],
			groups: 1
		});
		expect(isSolvedState(RING, { links: [1, 1, 1, 1] })).toBe(true);
		expect(isSolvedState(RING, { links: [1, 1, 1, 0] })).toBe(false);
	});

	it('marks a finished group that leaves islands out', () => {
		const a = analyze(RING, { links: [2, 0, 0, 2] });
		expect(a.error).toEqual([true, true, true, true]);
		expect(a.group).toEqual([0, 0, 2, 2]);
		expect(a.groups).toBe(2);
		expect(isSolvedState(RING, { links: [2, 0, 0, 2] })).toBe(false);
		// Not yet finished: the other two can still join them.
		expect(analyze(RING, { links: [2, 0, 0, 0] }).error).toEqual([true, true, false, false]);
	});

	it('marks islands with too many bridges, and those that cannot get enough', () => {
		// The top left has four; the bottom right can only reach full islands.
		expect(analyze(RING, { links: [2, 2, 0, 0] }).error).toEqual([true, false, false, true]);
		// The middle island has its double bridge on the left and room for two more on the right.
		expect(analyze(board('2.4.2'), { links: [2, 0] }).error).toEqual([false, false, false]);
		// A cross takes the room away.
		expect(analyze(board('2.4.2'), { links: [2, CROSS] }).error).toEqual([false, true, true]);
		// So does a bridge across the link.
		expect(analyze(PLUS, { links: [1, 0] }).error).toEqual([true, true, true, true]);
	});

	it('finds bridges that cross', () => {
		const links = graphOf(FRAME).ends.length / 2;
		const s = { links: new Array<number>(links).fill(1) };
		const a = analyze(FRAME, s);
		expect(a.groups).toBe(1);
		expect(a.count).toEqual(graphOf(FRAME).clue);
		expect(a.crossed.filter(Boolean)).toHaveLength(2);
		expect(isSolvedState(FRAME, s)).toBe(false);
	});
});

describe('solver', () => {
	it('starts with up to two bridges on every link', () => {
		const solver = new BridgesSolver(RING);
		const k = solver.start();
		expect(bounds(k)).toEqual([
			[0, 2],
			[0, 2],
			[0, 2],
			[0, 2]
		]);
		expect(solver.done(k)).toBe(false);
		expect([fewest(k, 0), most(k, 0), decidedLink(k, 0)]).toEqual([0, 2, false]);
		expect(solver.countAt(k, 0)).toEqual([
			[0, 2],
			[0, 2]
		]);
		k[1] = 0;
		k[3] = 1;
		// Two bridges at most for the 2: the other link takes one at most.
		expect(solver.countAt(k, 0)).toBeNull();
	});

	it('rates a puzzle by the strongest technique it needs', () => {
		const line = new BridgesSolver(LINE).rate()!;
		expect(line.level).toBe(BridgesLevel.Count);
		expect(bounds(line.known)).toEqual([
			[1, 1],
			[1, 1]
		]);
		const ring = new BridgesSolver(RING).rate()!;
		expect(ring.level).toBe(BridgesLevel.Isolation);
		expect(new BridgesSolver(RING).values(ring.known)).toEqual([1, 1, 1, 1]);
		// Two solutions: nothing decides it.
		expect(new BridgesSolver(RING3).rate()).toBeNull();
	});

	it('blocks the links across a sure bridge', () => {
		const solver = new BridgesSolver(PLUS);
		const k = solver.start();
		expect(solver.propagate(k, BridgesLevel.Count)).toBe(false);
		expect(solver.broken).toBe('count');
		expect(solver.rate()).toBeNull();
		const both = solver.start();
		both[0] = both[2] = 1;
		expect(solver.propagate(both)).toBe(false);
		expect(solver.broken).toBe('cross');
	});

	it('finds a group that closes itself off', () => {
		const solver = new BridgesSolver(RING);
		const k = solver.start();
		k[0] = k[6] = 2;
		expect(solver.propagate(k)).toBe(false);
		expect(solver.broken).toBe('closed');
		// Count alone sees nothing wrong.
		const count = solver.start();
		count[0] = count[6] = 2;
		expect(solver.propagate(count, BridgesLevel.Count)).toBe(true);
	});

	it('works out what closing off a group would mean for the ways to fill an island', () => {
		const solver = new BridgesSolver(RING);
		const k = solver.start();
		const groups = solver.groups(k);
		expect([...groups.root]).toEqual([0, 1, 2, 3]);
		expect([...groups.rest]).toEqual([2, 2, 2, 2]);
		expect(solver.closes(k, groups, 0, 2)).toBe(true);
		expect(solver.closes(k, groups, 0, 1)).toBe(false);
		expect(solver.closes(k, groups, 0, 0)).toBe(false);
		// A double bridge on either link closes it off with the island across.
		expect(solver.combosAt(k, groups, 0)).toEqual([
			[1, 1],
			[1, 1]
		]);
	});

	it('finds the links that are the only way between two parts', () => {
		// Two rings joined by the link between the 4s, link 4.
		const joined = board('3.3....', '.......', '3.4.4.3', '.......', '....3.3');
		const solver = new BridgesSolver(joined);
		const k = solver.start();
		expect(solver.cuts(k)).toEqual([{ link: 4, side: [4, 5, 7, 6] }]);
		expect(solver.propagate(k)).toBe(true);
		expect(bounds(k)[4]).toEqual([1, 2]);
		// Apart, the two rings can never join.
		const apart = new BridgesSolver(APART);
		expect(apart.cuts(apart.start())).toBeNull();
		expect(apart.propagate(apart.start())).toBe(false);
		expect(apart.broken).toBe('cut');
		expect(solveBridges(APART)).toEqual({ solutions: [], finished: true, nodes: 1 });
	});

	it('tries links out, and fails where neither way works', () => {
		// Connect leaves it open, but there is no solution.
		const p = board('.2..1', '.....', '.4..3', '.....', '.2..1');
		const solver = new BridgesSolver(p);
		const k = solver.start();
		expect(solver.propagate(k)).toBe(true);
		expect(solver.done(k)).toBe(false);
		expect(solver.propagate(k, BridgesLevel.Trial)).toBe(false);
		expect(solver.broken).toBe('count');
		expect(solveBridges(p).solutions).toEqual([]);
	});

	it('solves generated puzzles of either difficulty, with the solution they were made from', () => {
		for (const [difficulty, seed, level] of [
			['normal', 1, BridgesLevel.Count],
			['normal', 3, BridgesLevel.Isolation],
			['hard', 1, BridgesLevel.Connect],
			['hard', 4, BridgesLevel.Trial]
		] as const) {
			const { puzzle, solution } = generateBridges(7, 7, difficulty, seed);
			expect(new BridgesSolver(puzzle).rate()?.level, `${difficulty} ${seed}`).toBe(level);
			const res = solveBridges(puzzle, 2);
			expect(res.finished).toBe(true);
			expect(res.solutions).toEqual([solution]);
			expect(isSolvedState(puzzle, { links: solution })).toBe(true);
		}
	});

	it('stops at the limit and at the node budget', () => {
		expect(solveBridges(RING3, 5).solutions).toHaveLength(2);
		expect(solveBridges(RING3, 1).solutions).toHaveLength(1);
		const res = solveBridges(RING3, 5, 1);
		expect(res.finished).toBe(false);
		expect(res.solutions).toEqual([]);
	});
});

describe('generator', () => {
	it('places islands in line with each other, never side by side', () => {
		const rng = new Rng(3);
		for (let n = 0; n < 20; n++) {
			const cells = randomIslands(7, 7, rng);
			const islands = cells.flatMap((c, i) => (c === '.' ? [] : [i]));
			expect(islands.length).toBeGreaterThanOrEqual(8);
			for (const i of islands) {
				const [r, c] = [Math.floor(i / 7), i % 7];
				expect(islands.some((j) => j !== i && (j % 7 === c || Math.floor(j / 7) === r))).toBe(true);
				expect(islands).not.toContain(i + 7);
				if (c < 6) expect(islands).not.toContain(i + 1);
			}
		}
	});

	it('joins them with bridges that do not cross, if it can', () => {
		const rng = new Rng(5);
		let made = 0;
		for (let n = 0; n < 20; n++) {
			const islands = randomIslands(7, 7, rng);
			const values = randomBridges(islands, 7, 7, rng);
			if (!values) continue;
			made++;
			expect(isSolvedState(puzzleOf(7, 7, islands, values), { links: values })).toBe(true);
		}
		expect(made).toBeGreaterThan(10);
		// The two links of the plus cross: no tree joins its four islands.
		expect(randomBridges([...'.0.0.0.0.'], 3, 3, rng)).toBeNull();
	});

	it('writes the bridges at each island as its number', () => {
		expect(puzzleOf(3, 3, [...'0.0...0.0'], [1, 1, 1, 1])).toEqual(RING);
		expect(puzzleOf(5, 1, [...'0.0.0'], [2, 1])).toEqual(board('2.3.1'));
	});

	it('tells the difficulties apart by the techniques a puzzle needs', () => {
		expect(fitsLevel(BridgesLevel.Count, 'normal')).toBe(true);
		expect(fitsLevel(BridgesLevel.Isolation, 'normal')).toBe(true);
		expect(fitsLevel(BridgesLevel.Connect, 'normal')).toBe(false);
		expect(fitsLevel(BridgesLevel.Isolation, 'hard')).toBe(false);
		expect(fitsLevel(BridgesLevel.Trial, 'hard')).toBe(true);
		const hard = generateBridges(7, 7, 'hard', 2).puzzle;
		expect(fitsBridgesDifficulty(hard, 'hard')).toBe(true);
		expect(fitsBridgesDifficulty(hard, 'normal')).toBe(false);
		// Two solutions fit no difficulty.
		expect(fitsBridgesDifficulty(RING3, 'normal')).toBe(false);
	});

	it('is the same for the same seed', () => {
		expect(generateBridges(7, 7, 'normal', 9)).toEqual(generateBridges(7, 7, 'normal', 9));
		expect(generateBridges(7, 7, 'normal', 9)).not.toEqual(generateBridges(7, 7, 'normal', 10));
	});

	it('gives up where no puzzle fits', () => {
		// On 2×2 no second island fits: no hard puzzle.
		expect(() => generateBridges(2, 2, 'hard', 1)).toThrow('generation failed for 2x2 hard #1');
	});
});

describe('logic', () => {
	const seven = BRIDGES_VARIANTS[0];

	it('plays 7×7 so far, and lists the rest as coming soon', () => {
		expect(BRIDGES_VARIANTS.filter(isPlayable).map((v) => v.key)).toEqual(['7n', '7h']);
		expect(BRIDGES_VARIANTS.find((v) => v.key === '7h')?.label).toBe('7x7 Hard');
	});

	it('generates valid puzzles with one solution', () => {
		const p = bridgesLogic.generate(seven, 1);
		expect(bridgesLogic.isValidPuzzle(p, seven)).toBe(true);
		expect(bridgesLogic.countSolutions(p, 2)).toEqual({ count: 1, finished: true });
		expect(bridgesLogic.fitsDifficulty!(p, seven)).toBe(true);
	});

	it('rejects broken puzzles', () => {
		const v = { ...seven, width: 3, height: 3 };
		expect(bridgesLogic.isValidPuzzle(RING, v)).toBe(true);
		for (const p of [
			null,
			'2.2...2.2',
			{ ...RING, width: 4 },
			{ ...RING, islands: 5 },
			{ ...RING, islands: '2.2...2.' },
			{ ...RING, islands: '2.2...2.0' },
			// One island, an odd sum, more than the links hold, islands side by side.
			{ ...RING, islands: '2........' },
			{ ...RING, islands: '2.2...2.1' },
			{ ...RING, islands: '5.2...2.1' },
			{ ...RING, islands: '22....2.2' },
			{ ...RING, islands: '2.2..22..' }
		]) {
			expect(bridgesLogic.isValidPuzzle(p, v), JSON.stringify(p)).toBe(false);
		}
	});

	it('checks answers: the bridges per link', () => {
		const solved = { links: [1, 1, 1, 1] };
		expect(bridgesLogic.answer(RING, solved)).toBe('1111');
		expect(bridgesLogic.answer(RING, { links: [1, CROSS, 0, 2] })).toBe('1002');
		expect(bridgesLogic.verifyAnswer(RING, '1111')).toBe(true);
		expect(bridgesLogic.verifyAnswer(RING, '2002')).toBe(false);
		expect(bridgesLogic.verifyAnswer(RING, '111')).toBe(false);
		expect(bridgesLogic.verifyAnswer(RING, '1131')).toBe(false);
		expect(bridgesLogic.isSolved(RING, solved)).toBe(true);
		expect(bridgesLogic.emptyState(RING)).toEqual({ links: [0, 0, 0, 0] });
	});

	it('saves positions and checks the ones it reads', () => {
		const s = { links: [1, CROSS, 2, 0] };
		expect(bridgesLogic.decodeState(RING, bridgesLogic.encodeState(s))).toEqual(s);
		expect(bridgesLogic.decodeState(RING, '!')).toBeNull();
		// Bridges that cross are never saved by the board.
		expect(bridgesLogic.decodeState(PLUS, bridgesLogic.encodeState({ links: [1, 1] }))).toBeNull();
		expect(bridgesLogic.isValidState(PLUS, { links: [1, CROSS] })).toBe(true);
		for (const bad of [
			null,
			1,
			{ links: 'x' },
			{ links: [0] },
			{ links: [0, 4] },
			{ links: [0.5, 0] }
		]) {
			expect(bridgesLogic.isValidState(PLUS, bad), JSON.stringify(bad)).toBe(false);
		}
	});
});

describe('input', () => {
	it('adds a bridge per click, round to none, and crosses with the other button', () => {
		expect([0, 1, 2, CROSS].map((v) => nextValue('bridge', v, false))).toEqual([1, 2, 0, 1]);
		expect([0, 1, 2, CROSS].map((v) => nextValue('bridge', v, true))).toEqual([
			CROSS,
			CROSS,
			CROSS,
			0
		]);
		expect([0, 1, CROSS].map((v) => nextValue('cross', v, false))).toEqual([CROSS, CROSS, 0]);
		expect(nextValue('cross', 0, true)).toBe(1);
	});

	it('finds the link a click means', () => {
		const g = graphOf(RING);
		expect(linkAt(g, [0, 0, 0, 0], 1.5, 0.5)).toBe(0);
		expect(linkAt(g, [0, 0, 0, 0], 2.5, 1.2)).toBe(2);
		// An island, the middle with no link, outside the board.
		expect(linkAt(g, [0, 0, 0, 0], 0.5, 0.5)).toBe(-1);
		expect(linkAt(g, [0, 0, 0, 0], 1.5, 1.5)).toBe(-1);
		expect(linkAt(g, [0, 0, 0, 0], -0.5, 1)).toBe(-1);
		expect(linkAt(g, [0, 0, 0, 0], 1, 3)).toBe(-1);
	});

	it('picks the link with bridges where two cross, else the nearer one', () => {
		const g = graphOf(PLUS);
		expect(linkAt(g, [0, 0], 1.5, 1.2)).toBe(0);
		expect(linkAt(g, [0, 0], 1.2, 1.5)).toBe(1);
		expect(linkAt(g, [1, 0], 1.2, 1.5)).toBe(0);
		expect(linkAt(g, [CROSS, 2], 1.5, 1.2)).toBe(1);
	});

	it('follows a drag from cell to cell', () => {
		const g = graphOf(RING);
		expect(linkBetween(g, 0, 1)).toBe(0);
		expect(linkBetween(g, 1, 2)).toBe(0);
		expect(linkBetween(g, 0, 3)).toBe(1);
		expect(linkBetween(g, 5, 8)).toBe(2);
		// Not next to each other, over a row's end, water without a link.
		expect(linkBetween(g, 0, 4)).toBe(-1);
		expect(linkBetween(g, 2, 3)).toBe(-1);
		expect(linkBetween(g, 1, 4)).toBe(-1);
		expect(linkBetween(graphOf(PLUS), 1, 4)).toBe(0);
		// Two islands side by side have no water between them.
		expect(linkBetween(bridgesGraph(board('11')), 0, 1)).toBe(-1);
	});

	it('sets links, bridges only where none crosses them', () => {
		const g = graphOf(PLUS);
		expect(setLinks(g, [1, 0], [1], 1)).toEqual({ values: [1, 0], changed: [] });
		expect(setLinks(g, [1, 0], [0, 1], CROSS)).toEqual({ values: [CROSS, CROSS], changed: [0, 1] });
		expect(setLinks(g, [1, 0], [0], 1)).toEqual({ values: [1, 0], changed: [] });
		expect(setLinks(g, [0, 0], [0, 1], 2)).toEqual({ values: [2, 0], changed: [0] });
	});
});

describe('draw', () => {
	it('finds the islands joined to the last change', () => {
		const s = { links: [1, 0, 0, 0] };
		const a = analyze(RING, s);
		expect([...joinedTo(RING, a, ['l:0', 'c:8'])]).toEqual([0, 1]);
		// Islands without bridges join nothing.
		expect([...joinedTo(RING, a, ['l:3'])]).toEqual([]);
	});

	it('counts the rings of the win animation from the first island', () => {
		expect(groupRings(RING, { links: [1, 1, 1, 1] })).toEqual([0, 1, 1, 2]);
		expect(groupRings(RING, { links: [1, 0, 0, 0] })).toEqual([0, 1, 0, 0]);
	});
});

describe('module', () => {
	it('names the game in the language of the page', () => {
		expect(bridges.name).toBe('Bridges');
		i18n.locale = 'de';
		expect(bridges.name).toBe('Brücken');
		i18n.locale = 'en';
		expect(bridges.earlyAccess).toBe(true);
		expect(bridges.defaultTool(false)).toBe('bridge');
	});

	it('names the changed links', () => {
		expect(bridges.changes!(RING, { links: [0, 0, 0, 0] }, { links: [0, 2, 0, CROSS] })).toEqual([
			'l:1',
			'l:3'
		]);
	});
});
