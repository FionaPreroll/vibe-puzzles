import { describe, expect, it } from 'vitest';
import { packDigits } from '../../core/grid';
import { Rng } from '../../core/rng';
import { isPlayable } from '../../core/variants';
import { nearestSide, quartersBetween, spinFrom, tilePath, waterRings } from './draw';
import { generatePipes, randomTree } from './generator';
import { PIPES_VARIANTS, pipesLogic } from './logic';
import {
	analyze,
	changedMarks,
	connections,
	CROSS,
	dealt,
	DOWN,
	emptyPipesState,
	isSolvedTiles,
	JOIN,
	kindOf,
	LEFT,
	loopSides,
	markable,
	markAt,
	markedSides,
	markKey,
	markList,
	neighbourTable,
	NO_MARK,
	openings,
	parseMarkKey,
	reach,
	RIGHT,
	sourceOf,
	turn,
	turnsOf,
	turnToMarks,
	unfitTiles,
	UP,
	validMarks,
	withMark,
	withMarks,
	type PipesPuzzle
} from './rules';
import { count, masksOf, PipesLevel, PipesSolver, solvePipes, type SolveResult } from './solver';

const hex = (tiles: readonly number[]) => tiles.map((t) => t.toString(16)).join('');

/** A puzzle dealt as `tiles`, by rows. */
const board = (width: number, tiles: number[], wrap = false): PipesPuzzle => ({
	width,
	height: tiles.length / width,
	wrap,
	tiles: hex(tiles)
});

/**
 * A 3×3 network that uses the wrap at every row: the middle column leads up and down from the
 * source, and each row runs from its middle tile out over the left edge and back in on the right.
 */
// prettier-ignore
const WRAPPED = [
	RIGHT | LEFT, DOWN | LEFT, RIGHT,
	RIGHT | LEFT, UP | DOWN | LEFT, RIGHT,
	RIGHT | LEFT, UP | LEFT, RIGHT
];

/**
 * A 3×3 network without wrap: the T in the middle of the top row and the one in the middle of the
 * bottom row, joined by the straight through the source.
 */
// prettier-ignore
const PLAIN = [
	RIGHT | DOWN, RIGHT | DOWN | LEFT, DOWN | LEFT,
	UP, UP | DOWN, UP,
	RIGHT, UP | RIGHT | LEFT, LEFT
];

describe('rules', () => {
	it('turns a tile by rotating its openings', () => {
		expect(turn(UP, 1)).toBe(RIGHT);
		expect(turn(LEFT, 1)).toBe(UP);
		expect(turn(UP | RIGHT, 1)).toBe(RIGHT | DOWN);
		expect(turn(UP | RIGHT | DOWN, 2)).toBe(DOWN | LEFT | UP);
		expect(turn(UP, -1)).toBe(LEFT);
		expect(turn(UP | RIGHT, 4)).toBe(UP | RIGHT);
		// A straight lies two ways, the others four.
		expect(turnsOf(UP | DOWN)).toEqual([UP | DOWN, RIGHT | LEFT]);
		expect(turnsOf(UP)).toHaveLength(4);
		expect(turnsOf(UP | RIGHT | DOWN)).toHaveLength(4);
	});

	it('names the kinds of tile', () => {
		expect(kindOf(LEFT)).toBe('end');
		expect(kindOf(UP | DOWN)).toBe('straight');
		expect(kindOf(RIGHT | LEFT)).toBe('straight');
		expect(kindOf(UP | LEFT)).toBe('corner');
		expect(kindOf(UP | RIGHT | LEFT)).toBe('tee');
		expect(openings(UP | RIGHT | LEFT)).toBe(3);
	});

	it('finds the neighbours of a tile, across the edges with wrap', () => {
		const plain = neighbourTable({ width: 3, height: 2, wrap: false });
		expect([...plain.slice(0, 4)]).toEqual([-1, 1, 3, -1]);
		expect([...plain.slice(5 * 4, 6 * 4)]).toEqual([2, -1, -1, 4]);
		const wrapped = neighbourTable({ width: 3, height: 2, wrap: true });
		expect([...wrapped.slice(0, 4)]).toEqual([3, 1, 3, 2]);
		expect([...wrapped.slice(5 * 4, 6 * 4)]).toEqual([2, 3, 2, 4]);
	});

	it('puts the source in the middle', () => {
		expect(sourceOf({ width: 5, height: 5 })).toBe(12);
		expect(sourceOf({ width: 4, height: 4 })).toBe(10);
		expect(sourceOf({ width: 3, height: 3 })).toBe(4);
	});

	it('takes all tiles in the solution as solved (acceptance 1)', () => {
		expect(isSolvedTiles(board(3, PLAIN), PLAIN)).toBe(true);
		const a = analyze(board(3, PLAIN), PLAIN);
		expect(a.water.every(Boolean)).toBe(true);
		expect(a.reached).toBe(9);
		expect(a.closed).toBe(true);
		expect(a.errors.every((e) => e === 0)).toBe(true);
	});

	it('takes a tile turned a quarter wrong as not solved (acceptance 2)', () => {
		for (let c = 0; c < 9; c++) {
			const tiles = PLAIN.slice();
			tiles[c] = turn(tiles[c], 1);
			expect(isSolvedTiles(board(3, PLAIN), tiles), `tile ${c}`).toBe(false);
		}
	});

	it('takes a pipe that leads off the board as not solved, and marks it (acceptance 3, 20)', () => {
		// The end at the bottom left points down instead of right.
		const tiles = PLAIN.slice();
		tiles[6] = DOWN;
		const p = board(3, PLAIN);
		expect(isSolvedTiles(p, tiles)).toBe(false);
		const a = analyze(p, tiles);
		expect(a.errors[6]).toBe(DOWN);
		// The pipe it no longer meets ends loose: unfinished, not wrong.
		expect(a.errors[7]).toBe(0);
		expect(a.closed).toBe(false);
	});

	it('joins pipes across the edges with wrap, and fills them with water (acceptance 4)', () => {
		const p = board(3, WRAPPED, true);
		expect(isSolvedTiles(p, WRAPPED)).toBe(true);
		const a = analyze(p, WRAPPED);
		expect(a.water.every(Boolean)).toBe(true);
		expect(a.errors.every((e) => e === 0)).toBe(true);
		// Without wrap, the same tiles lead off the board.
		const plain = { ...p, wrap: false };
		expect(isSolvedTiles(plain, WRAPPED)).toBe(false);
		expect(analyze(plain, WRAPPED).errors[2]).toBe(RIGHT);
		expect(analyze(plain, WRAPPED).water[2]).toBe(false);
	});

	it('marks four corners that form a ring, and takes it as not solved (acceptance 5)', () => {
		// The top left 2×2 tiles close a ring; the pipes that leave it are not on it, and the
		// bottom right corner still ends loose.
		// prettier-ignore
		const ring = [
			RIGHT | DOWN, RIGHT | DOWN | LEFT, LEFT,
			UP | RIGHT, UP | DOWN | LEFT, LEFT,
			RIGHT, UP | RIGHT | LEFT, UP
		];
		const p = board(3, ring);
		const a = analyze(p, ring);
		expect(a.errors[0]).toBe(RIGHT | DOWN);
		expect(a.errors[1]).toBe(DOWN | LEFT);
		expect(a.errors[3]).toBe(UP | RIGHT);
		expect(a.errors[4]).toBe(UP | LEFT);
		expect(a.errors[7]).toBe(0);
		expect(isSolvedTiles(p, ring)).toBe(false);
		expect(loopSides(p, connections(p, ring))).toEqual([6, 12, 0, 3, 9, 0, 0, 0, 0]);
	});

	it('marks exactly the pipes that lie on a loop', () => {
		const rng = new Rng(3);
		for (const wrap of [false, true]) {
			const p = board(6, new Array<number>(36).fill(UP), wrap);
			const nb = neighbourTable(p);
			for (let k = 0; k < 100; k++) {
				const met = connections(
					p,
					Array.from({ length: 36 }, () => 1 + rng.int(14))
				);
				const sides = loopSides(p, met);
				// A pipe lies on a loop if its two tiles stay joined without it.
				met.forEach((mask, c) => {
					for (let side = 0; side < 4; side++) {
						if (!(mask & (1 << side))) continue;
						const m = nb[c * 4 + side];
						const without = met.slice();
						without[c] &= ~(1 << side);
						without[m] &= ~(1 << ((side + 2) % 4));
						const onLoop = reach(p, without, c)[m];
						expect(!!(sides[c] & (1 << side)), `${wrap} #${k} tile ${c} side ${side}`).toBe(onLoop);
					}
				});
			}
		}
	});

	it('takes a straight turned half round as still solved (acceptance 6)', () => {
		const straight = PLAIN.findIndex((t) => kindOf(t) === 'straight');
		const tiles = PLAIN.slice();
		if (straight >= 0) tiles[straight] = turn(tiles[straight], 2);
		expect(isSolvedTiles(board(3, PLAIN), tiles)).toBe(true);
		const { puzzle, solution } = generatePipes(7, 7, false, 3);
		const turned = solution.map((t) => (kindOf(t) === 'straight' ? turn(t, 2) : t));
		expect(turned).toEqual(solution);
		expect(isSolvedTiles(puzzle, turned)).toBe(true);
	});

	it('marks two ends that face each other: a group cut off from the rest', () => {
		// Two rows of four: two ends facing each other at the top left, cut off from the rest,
		// which still has loose ends.
		// prettier-ignore
		const tiles = [
			RIGHT, LEFT, DOWN, DOWN,
			UP, RIGHT | LEFT, UP | RIGHT | LEFT, UP | LEFT
		];
		const p = board(4, tiles);
		expect(analyze(p, tiles).errors).toEqual([RIGHT, LEFT, 0, 0, 0, 0, 0, 0]);
		// Turned away from each other, they end loose: unfinished, not wrong.
		const apart = tiles.slice();
		apart[1] = DOWN;
		expect(analyze(p, apart).errors[0]).toBe(0);
	});

	it('marks a pipe between two locked tiles that meets a closed side, not between free ones', () => {
		const tiles = PLAIN.slice();
		tiles[0] = DOWN | LEFT; // off the board on the left, and closed to the right
		const p = board(3, PLAIN);
		const free = analyze(p, tiles);
		expect(free.errors[1] & LEFT).toBe(0);
		const locks = [1, 1, 0, 0, 0, 0, 0, 0, 0];
		const locked = analyze(p, tiles, locks);
		expect(locked.errors[1] & LEFT).toBe(LEFT);
		expect(locked.errors[0]).toBe(LEFT);
	});

	it('lets the water reach the tiles joined to the source', () => {
		const p = board(3, PLAIN);
		const tiles = PLAIN.slice();
		tiles[1] = turn(tiles[1], 2); // the top T now opens up, away from the source
		const water = reach(p, connections(p, tiles), sourceOf(p));
		expect(water).toEqual([false, false, false, false, true, false, true, true, true]);
	});
});

describe('marks', () => {
	const p = board(3, PLAIN);
	const w = board(3, WRAPPED, true);
	const none = new Array<number>(9).fill(0);
	/** `marks` on `q`, each `[tile, side, mark]` set in turn. */
	const marked = (q: PipesPuzzle, ...list: [number, number, number][]) =>
		list.reduce<number[]>((m, [c, k, mark]) => withMark(q, m, c, k, mark), none);

	it('lie on the side between two tiles, the same for both', () => {
		const right = withMark(p, undefined, 0, 1, JOIN);
		expect(markAt(p, right, 0, 1)).toBe(JOIN);
		expect(markAt(p, right, 1, 3)).toBe(JOIN);
		expect(markAt(p, undefined, 1, 3)).toBe(NO_MARK);
		expect([markKey(p, 0, 1), markKey(p, 1, 3)]).toEqual(['r:0', 'r:0']);
		// Above the source is below the top T.
		const both = withMark(p, right, 4, 0, CROSS);
		expect(markAt(p, both, 1, 2)).toBe(CROSS);
		expect(markKey(p, 4, 0)).toBe('d:1');
		expect(markList(both)).toEqual([
			[0, 1, JOIN],
			[1, 2, CROSS]
		]);
		expect(withMark(p, both, 1, 2, NO_MARK)).toEqual(right);
		const { joins, crosses } = markedSides(p, both);
		expect(joins).toEqual([RIGHT, LEFT, 0, 0, 0, 0, 0, 0, 0]);
		expect(crosses).toEqual([0, DOWN, 0, 0, UP, 0, 0, 0, 0]);
	});

	it('take no place on the edge of a board without wrap, and cross it with wrap', () => {
		expect([markable(p, 2, 1), markable(p, 0, 0), markable(p, 6, 2), markable(p, 3, 3)]).toEqual([
			false,
			false,
			false,
			false
		]);
		expect(withMark(p, undefined, 2, 1, JOIN)).toEqual(none);
		expect(markAt(p, [15, 15, 15, 15, 15, 15, 15, 15, 15], 0, 3)).toBe(NO_MARK);
		// With wrap, the left side of the top left tile is the right side of the top right one.
		const across = withMark(w, undefined, 0, 3, CROSS);
		expect(markKey(w, 0, 3)).toBe('r:2');
		expect(markAt(w, across, 2, 1)).toBe(CROSS);
		expect(markKey(w, 1, 0)).toBe('d:7');
		expect(markedSides(w, across).crosses).toEqual([LEFT, 0, RIGHT, 0, 0, 0, 0, 0, 0]);
	});

	it('name the sides whose marks changed by their keys', () => {
		const a = marked(p, [0, 1, JOIN]);
		const b = marked(p, [0, 1, CROSS], [1, 2, JOIN]);
		expect(changedMarks(a, b)).toEqual(['r:0', 'd:1']);
		expect(changedMarks(undefined, a)).toEqual(['r:0']);
		expect(changedMarks(a, undefined)).toEqual(['r:0']);
		expect(changedMarks(undefined, undefined)).toEqual([]);
		expect(parseMarkKey('d:12')).toEqual({ cell: 12, side: 2 });
		expect(parseMarkKey('r:0')).toEqual({ cell: 0, side: 1 });
		expect(parseMarkKey('12')).toBeNull();
	});

	it('are left out of a position while there are none', () => {
		const s = emptyPipesState(p);
		expect(withMarks(s, marked(p, [0, 1, JOIN])).marks).toEqual(withMark(p, none, 0, 1, JOIN));
		expect(withMarks(s, none)).toEqual(s);
		expect('marks' in withMarks(s, none)).toBe(false);
		expect(withMarks({ ...s, marks: marked(p, [0, 1, JOIN]) }, undefined)).toEqual(s);
	});

	it('take two bits for each side, and none off the board', () => {
		expect(validMarks(p, none)).toBe(true);
		expect(validMarks(p, marked(p, [0, 1, CROSS], [4, 2, JOIN]))).toBe(true);
		const at = (c: number, value: number) => none.map((_, i) => (i === c ? value : 0));
		const bad: unknown[] = [
			undefined,
			'0',
			none.slice(1),
			at(0, 3),
			at(0, 12),
			at(0, 16),
			at(0, -1),
			at(0, 0.5),
			// The right side of the last column, the lower side of the last row.
			at(2, JOIN),
			at(6, JOIN << 2)
		];
		for (const m of bad) expect(validMarks(p, m), JSON.stringify(m)).toBe(false);
		// With wrap, those sides lead across the edge.
		expect(validMarks(w, at(2, JOIN))).toBe(true);
		expect(validMarks(w, at(6, JOIN << 2))).toBe(true);
	});

	it('find the tiles that no way of turning keeps to their marks', () => {
		const unfit = (...list: [number, number, number][]) =>
			unfitTiles(p, { ...emptyPipesState(p), marks: marked(p, ...list) }).flatMap((u, c) =>
				u ? [c] : []
			);
		expect(unfitTiles(p, emptyPipesState(p)).some(Boolean)).toBe(false);
		// A straight with "=" on two sides that meet, an end with two "=", a T with two "x".
		expect(unfit([4, 0, JOIN], [4, 1, JOIN])).toEqual([4]);
		expect(unfit([3, 0, JOIN], [3, 1, JOIN])).toEqual([3]);
		expect(unfit([7, 1, CROSS], [7, 3, CROSS])).toEqual([7]);
		// A corner with "=" below and "x" to its right lies one way, and its neighbours fit too.
		expect(unfit([0, 2, JOIN], [0, 1, CROSS])).toEqual([]);
	});

	it('turn a tile on to the next way that keeps to its marks', () => {
		// The corner at the top left, dealt right and down, with "=" to its right: it may also
		// lie up and right, three quarters on, or one back.
		const s = { ...emptyPipesState(p), marks: marked(p, [0, 1, JOIN]) };
		expect(turnToMarks(p, s, 0, 1)).toBe(3);
		expect(turnToMarks(p, s, 0, -1)).toBe(-1);
		// With "=" below as well, only the way it lies keeps to them.
		const only = { ...s, marks: marked(p, [0, 1, JOIN], [0, 2, JOIN]) };
		expect(turnToMarks(p, only, 0, 1)).toBe(0);
		// Without marks of its own, or with marks that no way keeps to, it turns as usual.
		expect(turnToMarks(p, emptyPipesState(p), 0, 1)).toBeNull();
		expect(turnToMarks(p, only, 8, 1)).toBeNull();
		const unfit = { ...s, marks: marked(p, [4, 0, JOIN], [4, 1, JOIN]) };
		expect(turnToMarks(p, unfit, 4, 1)).toBeNull();
		// A straight lies two ways: with "x" to its left, upright only.
		const upright = { ...emptyPipesState(p), marks: marked(p, [4, 3, CROSS]) };
		expect(turnToMarks(p, upright, 4, 1)).toBe(0);
		const across = { ...upright, tiles: PLAIN.map((t, c) => (c === 4 ? LEFT | RIGHT : t)) };
		expect(turnToMarks(p, across, 4, 1)).toBe(1);
		expect(turnToMarks(p, across, 4, -1)).toBe(-1);
	});
});

describe('solver', () => {
	it('fits a tile to the edge of the board', () => {
		const p = board(3, PLAIN);
		const solver = new PipesSolver(p);
		const opts = solver.start();
		// The corner at the top left can only lead right and down.
		expect(masksOf(solver.fitting(opts, 0))).toEqual([RIGHT | DOWN]);
		// The T in the middle of the top row cannot open up.
		expect(masksOf(solver.fitting(opts, 1))).toEqual([RIGHT | DOWN | LEFT]);
		// The straight in the middle fits both ways while nothing around it is known.
		expect(count(solver.fitting(opts, 4))).toBe(2);
	});

	it('rules out a way that closes a loop', () => {
		// Two rows of three. The corner at the top left, the corner below it and the straight
		// next to that are settled: they join the top middle tile (through the corner's pipe to
		// the right) and the bottom middle one, so a pipe between those two would close a loop.
		// prettier-ignore
		const tiles = [
			RIGHT | DOWN, DOWN | LEFT, LEFT,
			UP | RIGHT, LEFT | RIGHT, LEFT
		];
		const solver = new PipesSolver(board(3, tiles));
		const opts = solver.start();
		for (const c of [0, 3, 4]) opts[c] = 1 << tiles[c];
		expect(solver.joinGroups(opts)).toBe(true);
		expect(solver.groupOf(1)).toBe(solver.groupOf(4));
		expect(solver.breaks(opts, 1, DOWN | LEFT, PipesLevel.Loop)).toBe('loop');
	});

	it('rules out two ends that face each other', () => {
		// A 2×2 board: two ends at the top, two corners below.
		const solver = new PipesSolver(board(2, [DOWN, DOWN, UP | RIGHT, UP | LEFT]));
		const opts = solver.start();
		for (const c of [0, 1]) opts[c] = solver.fitting(opts, c);
		expect(masksOf(opts[0])).toEqual([RIGHT, DOWN]);
		expect(solver.joinGroups(opts)).toBe(true);
		expect(solver.breaks(opts, 0, RIGHT, PipesLevel.Closed)).toBe('closed');
		// Only the third technique sees it.
		expect(solver.breaks(opts, 0, RIGHT, PipesLevel.Loop)).toBeNull();
		expect(solver.breaks(opts, 0, DOWN, PipesLevel.Closed)).toBeNull();
	});

	it('finds what Fit alone leaves: a loop, or a group cut off from the rest', () => {
		// Four corners on a 2×2 board can only face inwards: they form a ring.
		const ring = new PipesSolver(board(2, [RIGHT | DOWN, DOWN | LEFT, UP | RIGHT, UP | LEFT]));
		const opts = ring.start();
		expect(ring.propagate(opts, PipesLevel.Fit)).toBe(true);
		expect(opts.every((set) => count(set) === 1)).toBe(true);
		expect(ring.joinGroups(opts)).toBe(false);
		expect(ring.propagate(ring.start())).toBe(false);
		// Four ends in a row pair up: Fit decides every tile, but the water reaches only two.
		const ends = new PipesSolver(board(4, [RIGHT, LEFT, RIGHT, LEFT]));
		const pairs = ends.start();
		expect(ends.propagate(pairs, PipesLevel.Fit)).toBe(true);
		expect(Array.from(pairs, (set) => masksOf(set))).toEqual([[RIGHT], [LEFT], [RIGHT], [LEFT]]);
		expect(ends.solvesAlone(PipesLevel.Fit)).toBeNull();
		expect(ends.joinGroups(pairs)).toBe(false);
		expect(ends.solvesAlone()).toBeNull();
	});

	it('solves a generated puzzle by the techniques alone, and its solution is the only one', () => {
		const { puzzle, solution } = generatePipes(10, 10, true, 5);
		const opts = new PipesSolver(puzzle).solvesAlone();
		expect(opts && Array.from(opts, (s) => masksOf(s)[0])).toEqual(solution);
		const all = solvePipes(puzzle, 2);
		expect(all.finished).toBe(true);
		expect(all.solutions).toEqual([solution]);
	});

	it('finds several solutions of an ambiguous puzzle, none of an impossible one', () => {
		// Four ends on a 2×2 board always pair up into two networks.
		const ends = solvePipes(board(2, [DOWN, DOWN, UP, UP]), 5);
		expect(ends).toMatchObject({ solutions: [], finished: true });
		// A random network with wrap, before the generator changes it, often lies more than one way.
		const nb = neighbourTable({ width: 5, height: 5, wrap: true });
		const rng = new Rng(1);
		let found: { p: PipesPuzzle; res: SolveResult } | null = null;
		for (let k = 0; k < 50 && !found; k++) {
			const p = board(5, randomTree(5, 5, nb, rng), true);
			const res = solvePipes(p, 3);
			if (res.solutions.length > 1) found = { p, res };
		}
		expect(found).not.toBeNull();
		const { p, res } = found!;
		expect(new PipesSolver(p).solvesAlone()).toBeNull();
		for (const s of res.solutions) expect(isSolvedTiles(p, s)).toBe(true);
	});

	it('gives up after its node budget', () => {
		const nb = neighbourTable({ width: 15, height: 15, wrap: true });
		const res = solvePipes(board(15, randomTree(15, 15, nb, new Rng(1)), true), 1000, 3);
		expect(res.finished).toBe(false);
		expect(res.nodes).toBeLessThanOrEqual(4);
	});
});

describe('generator', () => {
	it('grows spanning trees without a tile that opens all four ways', () => {
		for (const wrap of [false, true]) {
			const nb = neighbourTable({ width: 8, height: 6, wrap });
			const rng = new Rng(7);
			for (let k = 0; k < 20; k++) {
				const tiles = randomTree(8, 6, nb, rng);
				const p = board(8, tiles, wrap);
				expect(tiles.every((t) => t > 0 && t < 15)).toBe(true);
				expect(tiles.reduce((sum, t) => sum + openings(t), 0)).toBe(2 * (48 - 1));
				expect(isSolvedTiles(p, tiles)).toBe(true);
			}
		}
	});

	it('never deals a solved board, even where a random deal often is', () => {
		// Two ends side by side: one deal in 16 would be solved.
		for (let seed = 1; seed <= 100; seed++) {
			const { puzzle } = generatePipes(2, 1, false, seed);
			expect(isSolvedTiles(puzzle, dealt(puzzle)), `#${seed}`).toBe(false);
		}
	});

	it('makes the same puzzle from the same seed (acceptance 13)', () => {
		expect(generatePipes(10, 10, true, 42)).toEqual(generatePipes(10, 10, true, 42));
		expect(generatePipes(10, 10, true, 42)).not.toEqual(generatePipes(10, 10, true, 43));
		expect(generatePipes(10, 10, true, 42).puzzle).not.toEqual(
			generatePipes(10, 10, false, 42).puzzle
		);
	});

	// Acceptance 14 asks for 1000 per type: the small types here, the big ones measured in
	// docs/generators.md, where a few would take too long for every test run.
	it.each([
		[5, 1000],
		[7, 1000],
		[10, 200],
		[15, 10],
		[20, 3],
		[25, 2]
	])(
		'deals puzzles of size %i (%i seeds each, with and without wrap) with one solution, no cross and an unsolved start',
		(size, runs) => {
			for (const wrap of [false, true]) {
				for (let seed = 1; seed <= runs; seed++) {
					const { puzzle, solution } = generatePipes(size, size, wrap, seed);
					const tiles = dealt(puzzle);
					const where = `${size}${wrap ? 'w' : 'n'} #${seed}`;
					expect(
						tiles.every((t) => t > 0 && t < 15),
						where
					).toBe(true);
					expect(isSolvedTiles(puzzle, tiles), where).toBe(false);
					expect(new PipesSolver(puzzle).solvesAlone(), where).not.toBeNull();
					const all = solvePipes(puzzle, 2);
					expect(all.solutions, where).toEqual([solution]);
				}
			}
		},
		60_000
	);
});

describe('pipes logic', () => {
	const v = PIPES_VARIANTS.find((x) => x.key === '7w')!;
	const MORE: Record<string, string> = { '1': '3', '2': '6', '4': 'c', '8': '9' };
	const { puzzle, solution } = generatePipes(7, 7, true, 9);

	it('lists all fifteen types in their final order, all playable', () => {
		expect(PIPES_VARIANTS.map((x) => x.key)).toEqual([
			...['5', '7', '10', '15', '20', '25'].flatMap((size) => [`${size}n`, `${size}w`]),
			'daily',
			'weekly',
			'monthly'
		]);
		expect(PIPES_VARIANTS.every(isPlayable)).toBe(true);
		expect(PIPES_VARIANTS.filter((x) => x.wrap).map((x) => x.key)).toEqual([
			'5w',
			'7w',
			'10w',
			'15w',
			'20w',
			'25w',
			'weekly',
			'monthly'
		]);
	});

	it('generates the same puzzle as the generator for a seed', () => {
		expect(pipesLogic.generate(v, 9)).toEqual(puzzle);
		expect(pipesLogic.fitsDifficulty(puzzle, v)).toBe(true);
		expect(pipesLogic.countSolutions(puzzle, 2)).toEqual({ count: 1, finished: true });
	});

	it('accepts generated puzzles and rejects malformed ones', () => {
		expect(pipesLogic.isValidPuzzle(puzzle, v)).toBe(true);
		const tiles = puzzle.tiles;
		const bad: unknown[] = [
			null,
			7,
			{ ...puzzle, width: 6 },
			{ ...puzzle, wrap: false },
			{ ...puzzle, tiles: tiles.slice(1) },
			{ ...puzzle, tiles: [...tiles] },
			{ ...puzzle, tiles: '0' + tiles.slice(1) },
			{ ...puzzle, tiles: 'f' + tiles.slice(1) },
			{ ...puzzle, tiles: 'x' + tiles.slice(1) },
			// An end made a corner: one opening too many for a network without a loop.
			{ ...puzzle, tiles: tiles.replace(/[1248]/, (end) => MORE[end]) }
		];
		for (const p of bad) expect(pipesLogic.isValidPuzzle(p, v), JSON.stringify(p)).toBe(false);
		expect(pipesLogic.isValidPuzzle(puzzle, PIPES_VARIANTS[2])).toBe(false);
	});

	it('verifies the solution as an answer and rejects others', () => {
		const solved = { tiles: solution, locks: solution.map(() => 0) };
		const answer = pipesLogic.answer(puzzle, solved);
		expect(pipesLogic.isSolved(puzzle, solved)).toBe(true);
		expect(pipesLogic.verifyAnswer(puzzle, answer)).toBe(true);
		expect(pipesLogic.verifyAnswer(puzzle, puzzle.tiles)).toBe(false);
		expect(pipesLogic.verifyAnswer(puzzle, answer + '1')).toBe(false);
		expect(pipesLogic.verifyAnswer(puzzle, 'x' + answer.slice(1))).toBe(false);
		// A tile that its dealt tile cannot turn into.
		const swapped = solution.slice();
		const end = swapped.findIndex((t) => kindOf(t) === 'end');
		swapped[end] = turn(swapped[end], 1) | swapped[end];
		expect(pipesLogic.verifyAnswer(puzzle, hex(swapped))).toBe(false);
	});

	it('round-trips encoded states', () => {
		const s = emptyPipesState(puzzle);
		s.tiles[3] = turn(s.tiles[3], 1);
		s.locks[3] = 1;
		s.locks[48] = 1;
		expect(pipesLogic.decodeState(puzzle, pipesLogic.encodeState(s))).toEqual(s);
	});

	it('round-trips marks, and reads positions from before marks', () => {
		const s = emptyPipesState(puzzle);
		// Across the right and the lower edge: the board has wrap.
		const marks = withMark(puzzle, withMark(puzzle, undefined, 6, 1, JOIN), 48, 2, CROSS);
		const marked = withMarks(s, marks);
		const text = pipesLogic.encodeState(marked);
		expect(text.split('.')).toHaveLength(3);
		expect(pipesLogic.decodeState(puzzle, text)).toEqual(marked);
		// Without marks, a position is written as before, and read so.
		expect(pipesLogic.encodeState(s).split('.')).toHaveLength(2);
		expect(pipesLogic.encodeState({ ...s, marks: s.tiles.map(() => 0) })).toBe(
			pipesLogic.encodeState(s)
		);
		expect(pipesLogic.decodeState(puzzle, `${pipesLogic.encodeState(s)}.AA`)).toEqual(s);
		expect(pipesLogic.isValidState(puzzle, { tiles: s.tiles, locks: s.locks })).toBe(true);
		expect(pipesLogic.isValidState(puzzle, marked)).toBe(true);
		expect(pipesLogic.isValidState(puzzle, { ...s, marks: [] })).toBe(false);
		const broken = marks.map((m, c) => (c === 0 ? 3 : m));
		expect(
			pipesLogic.decodeState(
				puzzle,
				`${text.slice(0, text.lastIndexOf('.'))}.${packDigits(broken)}`
			)
		).toBeNull();
	});

	it('rejects corrupt saved states', () => {
		expect(pipesLogic.decodeState(puzzle, 'one.two.three.four')).toBeNull();
		expect(pipesLogic.decodeState(puzzle, '!.!')).toBeNull();
		const s = emptyPipesState(puzzle);
		s.locks[0] = 2;
		expect(pipesLogic.decodeState(puzzle, pipesLogic.encodeState(s))).toBeNull();
		// A tile that its dealt tile cannot turn into.
		const t = emptyPipesState(puzzle);
		t.tiles[0] = openings(t.tiles[0]) === 1 ? UP | RIGHT : UP;
		expect(pipesLogic.decodeState(puzzle, pipesLogic.encodeState(t))).toBeNull();
		expect(pipesLogic.isValidState(puzzle, undefined)).toBe(false);
		expect(pipesLogic.isValidState(puzzle, { ...emptyPipesState(puzzle), locks: [] })).toBe(false);
		expect(pipesLogic.isValidState(puzzle, { ...emptyPipesState(puzzle), tiles: [] })).toBe(false);
	});
});

describe('drawing', () => {
	it('draws pipes from the middle of the tile to the sides it opens', () => {
		expect(tilePath(UP, 10)).toBe('M0 0L0 -10');
		expect(tilePath(UP | DOWN, 10)).toBe('M0 -10L0 10');
		expect(tilePath(RIGHT | DOWN, 10)).toBe('M10 0L0 0L0 10');
		expect(tilePath(UP | RIGHT | DOWN, 10)).toBe('M0 -10L0 10M0 0L10 0');
	});

	it('finds the side of a tile nearest to a point, none in its middle', () => {
		expect(nearestSide(0.5, 0.1)).toBe(0);
		expect(nearestSide(0.9, 0.4)).toBe(1);
		expect(nearestSide(0.3, 0.95)).toBe(2);
		expect(nearestSide(-0.05, 0.5)).toBe(3);
		expect(nearestSide(0.5, 0.5)).toBeNull();
		expect(nearestSide(0.6, 0.4)).toBeNull();
	});

	it('counts the turns of each tile from how it was dealt, the short way round', () => {
		expect(spinFrom([UP, UP | RIGHT, UP | DOWN], [LEFT, RIGHT | DOWN, RIGHT | LEFT])).toEqual([
			3, 1, 1
		]);
		expect(quartersBetween(UP, RIGHT)).toBe(1);
		expect(quartersBetween(UP, LEFT)).toBe(-1);
		expect(quartersBetween(UP, DOWN)).toBe(2);
		expect(quartersBetween(UP | DOWN, RIGHT | LEFT)).toBe(1);
		expect(quartersBetween(UP, UP)).toBe(0);
	});

	it('spreads the win animation in rings from the source, two tiles deep', () => {
		const p = board(3, PLAIN);
		const rings = waterRings(neighbourTable(p), connections(p, PLAIN), sourceOf(p));
		// The source and its neighbours, then the tiles two and three pipes away.
		expect(rings[4]).toBe(0);
		expect(rings[1]).toBe(0);
		expect(rings[0]).toBe(1);
		// A tile without water comes last.
		const cut = PLAIN.slice();
		cut[6] = DOWN;
		const later = waterRings(neighbourTable(p), connections(p, cut), sourceOf(p));
		expect(later[6]).toBeGreaterThan(Math.max(...later.filter((_, c) => c !== 6)));
	});
});

describe('tutorial', () => {
	it('is solved by the techniques alone, with one solution', async () => {
		const { PIPES_TUTORIAL: p } = await import('./tutorial');
		expect(pipesLogic.isValidPuzzle(p, PIPES_VARIANTS[0])).toBe(true);
		expect(new PipesSolver(p).solvesAlone()).not.toBeNull();
		expect(solvePipes(p, 2).solutions).toHaveLength(1);
	});

	it('shows every task as it lies in the solution', async () => {
		const { PIPES_TUTORIAL: p, PIPES_TUTORIAL_STEPS: steps } = await import('./tutorial');
		const [solution] = solvePipes(p, 1).solutions;
		let s = emptyPipesState(p);
		for (const step of steps) {
			if (!step.show) continue;
			expect(step.done!(p, s)).toBe(false);
			s = step.show(p, s);
			expect(step.done!(p, s)).toBe(true);
		}
		const turned = s.tiles.flatMap((t, c) => (t !== dealt(p)[c] ? [c] : []));
		for (const c of turned) expect(s.tiles[c], `tile ${c}`).toBe(solution[c]);
		expect(isSolvedTiles(p, s.tiles)).toBe(false);
	});

	it('keeps the marks when it shows a task', async () => {
		const { PIPES_TUTORIAL: p, PIPES_TUTORIAL_STEPS: steps } = await import('./tutorial');
		const s = withMarks(emptyPipesState(p), withMark(p, undefined, 12, 0, CROSS));
		for (const step of steps) if (step.show) expect(step.show(p, s).marks).toEqual(s.marks);
	});
});
