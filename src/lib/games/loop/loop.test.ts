import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { isPlayable } from '../../core/variants';
import { fitsLoopDifficulty, generateLoop, randomLoop } from './generator';
import { LOOP_VARIANTS, loopLogic } from './logic';
import {
	analyze,
	clueAt,
	CROSS,
	edgeKey,
	edgeValues,
	emptyLoopState,
	hIndex,
	isSolvedState,
	LINE,
	loopGraph,
	stateFromEdges,
	vIndex,
	type LoopPuzzle,
	type LoopState
} from './rules';
import { LoopLevel, rateLoop, solveLoop } from './solver';

/** A state with lines on the given edges, as `h:i:j` / `v:i:j` keys. */
function lines(p: LoopPuzzle, ...keys: string[]): LoopState {
	const s = emptyLoopState(p);
	for (const key of keys) {
		const [kind, i, j] = key.split(':');
		if (kind === 'h') s.h[hIndex(p, Number(i), Number(j))] = LINE;
		else s.v[vIndex(p, Number(i), Number(j))] = LINE;
	}
	return s;
}

/** The loop around a rectangle of cells, rows r0..r1 and columns c0..c1. */
function box(r0: number, c0: number, r1: number, c1: number): string[] {
	const keys: string[] = [];
	for (let j = c0; j <= c1; j++) keys.push(`h:${r0}:${j}`, `h:${r1 + 1}:${j}`);
	for (let i = r0; i <= r1; i++) keys.push(`v:${i}:${c0}`, `v:${i}:${c1 + 1}`);
	return keys;
}

const square: LoopPuzzle = { width: 2, height: 2, clues: '2222' };

describe('rules', () => {
	it('numbers the edges, dots and cells of the grid', () => {
		const g = loopGraph(2, 2);
		expect(g.edges).toBe(12);
		expect(g.dots).toBe(9);
		// The middle dot has four edges, a corner two.
		expect([...g.dotEdges.slice(16, 20)].every((e) => e >= 0)).toBe(true);
		expect([...g.dotEdges.slice(0, 4)].filter((e) => e >= 0)).toHaveLength(2);
		expect(loopGraph(2, 2)).toBe(g);
		expect(edgeKey(square, 0)).toBe('h:0:0');
		expect(edgeKey(square, 6)).toBe('v:0:0');
		expect(edgeKey(square, 11)).toBe('v:1:2');
		expect(clueAt(square, 0)).toBe(2);
		expect(clueAt({ ...square, clues: '.222' }, 0)).toBe(-1);
	});

	it('accepts one closed loop that matches every clue', () => {
		expect(isSolvedState(square, lines(square, ...box(0, 0, 1, 1)))).toBe(true);
		// The same loop through the graph's edge numbering.
		const s = lines(square, ...box(0, 0, 1, 1));
		expect(stateFromEdges(square, edgeValues(s))).toEqual(s);
	});

	it('rejects open paths, branches, two loops and wrong counts', () => {
		const wide: LoopPuzzle = { width: 3, height: 1, clues: '...' };
		const full = box(0, 0, 0, 2);
		expect(isSolvedState(wide, lines(wide, ...full))).toBe(true);
		expect(isSolvedState(wide, lines(wide, ...full.slice(1)))).toBe(false);
		// A line through the middle makes a branch at two dots.
		expect(isSolvedState(wide, lines(wide, ...full, 'v:0:1'))).toBe(false);
		// Two separate loops around the outer cells.
		expect(isSolvedState(wide, lines(wide, ...box(0, 0, 0, 0), ...box(0, 2, 0, 2)))).toBe(false);
		expect(isSolvedState(wide, emptyLoopState(wide))).toBe(false);
		// The loop around one cell gives the others the wrong count.
		expect(isSolvedState(square, lines(square, ...box(0, 0, 0, 0)))).toBe(false);
	});

	it('finds clues and dots that break the rules', () => {
		const s = lines(square, 'h:0:0', 'v:0:0', 'v:0:1');
		const a = analyze(square, s);
		expect(a.count).toEqual([3, 1, 0, 0]);
		expect(a.clueError).toEqual([true, false, false, false]);
		// The dot between the top cells has a line ending at it but open edges left: no error.
		expect(a.dotError.some(Boolean)).toBe(false);
		expect(a.pieces).toBe(1);
		expect(a.closed).toBe(false);
		// Crosses that leave too few edges for a clue, and a dead end.
		s.v[vIndex(square, 0, 1)] = 0;
		s.h[hIndex(square, 0, 1)] = CROSS;
		s.h[hIndex(square, 1, 1)] = CROSS;
		s.v[vIndex(square, 0, 2)] = CROSS;
		const b = analyze(square, s);
		expect(b.clueError[1]).toBe(true);
		// The top middle dot: one line in, crosses on the other edges except the one down.
		s.v[vIndex(square, 0, 1)] = CROSS;
		expect(analyze(square, s).dotError[1]).toBe(true);
	});
});

/** The edge number of an `h:i:j` / `v:i:j` key. */
const edge = (p: LoopPuzzle, key: string) => edgeValues(lines(p, key)).indexOf(LINE);
const OPEN_EDGE = 0;

describe('rating solver', () => {
	it('draws the outer edges of a 3 in the corner of the grid', () => {
		// The corner dot has only those two edges: both lines or none, and a 3 needs one of them.
		const p: LoopPuzzle = { width: 3, height: 3, clues: '3........' };
		const { solved, edges } = rateLoop(p, LoopLevel.Basic);
		expect(solved).toBe(false);
		expect(edges[edge(p, 'h:0:0')]).toBe(LINE);
		expect(edges[edge(p, 'v:0:0')]).toBe(LINE);
		expect(edges.filter((x) => x !== 0)).toHaveLength(2);
	});

	it('passes a corner on to the cell diagonally across its dot', () => {
		// Two 3s on a diagonal: each uses one edge at the dot between them, so the far sides of
		// both are drawn.
		const q: LoopPuzzle = { width: 4, height: 4, clues: '.....3....3.....' };
		const { edges } = rateLoop(q, LoopLevel.Basic);
		for (const key of ['h:1:1', 'v:1:1', 'h:3:2', 'v:2:3'])
			expect(edges[edge(q, key)], key).toBe(LINE);
	});

	it('crosses an edge that would close a loop too early', () => {
		// Three sides of the left cell are drawn. Closing the fourth would leave the 1 on the
		// right without a line.
		const p: LoopPuzzle = { width: 3, height: 1, clues: '..1' };
		const drawn = edgeValues(lines(p, 'h:0:0', 'v:0:0', 'h:1:0'));
		expect(rateLoop(p, LoopLevel.Basic, drawn).edges[edge(p, 'v:0:1')]).toBe(CROSS);
		// Without the 1, that loop is a solution, so the edge is drawn.
		const free: LoopPuzzle = { ...p, clues: '...' };
		expect(rateLoop(free, LoopLevel.Basic, drawn).edges[edge(free, 'v:0:1')]).not.toBe(CROSS);
	});

	it('solves a normal puzzle with the basic techniques alone', () => {
		const { puzzle, solution } = generateLoop(5, 5, 'normal', 3);
		const r = rateLoop(puzzle);
		expect(r).toMatchObject({ solved: true, level: LoopLevel.Basic, advancedSteps: 0 });
		expect(
			stateFromEdges(
				puzzle,
				r.edges.map((x) => (x === LINE ? LINE : 0))
			)
		).toEqual(solution);
	});

	it('needs inside and outside for a hard puzzle', () => {
		const { puzzle, solution } = generateLoop(5, 5, 'hard', 1);
		expect(rateLoop(puzzle, LoopLevel.Basic).solved).toBe(false);
		const r = rateLoop(puzzle);
		expect(r.solved).toBe(true);
		expect(r.level).toBe(LoopLevel.Advanced);
		expect(r.advancedSteps).toBeGreaterThan(0);
		expect(
			stateFromEdges(
				puzzle,
				r.edges.map((x) => (x === LINE ? LINE : 0))
			)
		).toEqual(solution);
		// Four 2s: the loop runs around the grid. Only inside and outside sees that.
		expect(rateLoop(square, LoopLevel.Basic).solved).toBe(false);
		expect(rateLoop(square).solved).toBe(true);
	});

	it('stops without guessing on an ambiguous or impossible puzzle', () => {
		expect(rateLoop({ width: 3, height: 3, clues: '.........' })).toMatchObject({
			solved: false,
			level: LoopLevel.Advanced
		});
		expect(rateLoop({ width: 2, height: 2, clues: '3333' }).solved).toBe(false);
		expect(rateLoop({ width: 1, height: 1, clues: '0' }).solved).toBe(false);
		// Impossible puzzles that the basic rules let pass, and inside and outside does not.
		for (const [width, height, clues] of [
			[3, 2, '0...2.'],
			[4, 2, '..3.211.'],
			[3, 4, '...1..3...12'],
			[3, 4, '.3...211.222'],
			[4, 3, '2.2...12.0..']
		] as const) {
			const p = { width, height, clues };
			expect(solveLoop(p).solutions, clues).toHaveLength(0);
			expect(rateLoop(p).solved, clues).toBe(false);
		}
		// One line leaves the dots around the middle cell, which the basic rules let pass: the
		// cells around them would have to be inside and outside at once.
		const open: LoopPuzzle = { width: 3, height: 3, clues: '.........' };
		const out = ['v:0:1', 'h:1:0', 'v:0:2', 'h:1:2', 'h:2:0', 'v:2:1', 'h:2:2', 'v:2:2'];
		const from = edgeValues(lines(open, out[0]));
		for (const key of out.slice(1)) from[edge(open, key)] = CROSS;
		expect(
			rateLoop(open, LoopLevel.Basic, from).edges.filter((x) => x === OPEN_EDGE).length
		).toBeGreaterThan(0);
		expect(rateLoop(open, LoopLevel.Advanced, from).solved).toBe(false);
	});

	it('never draws a wrong loop, whatever edges it starts from', () => {
		// Starting from part of the solution, with some edges flipped: a solved result is the
		// one solution and keeps the edges it started from; without flips it always solves.
		const rng = new Rng(7);
		for (const [size, difficulty] of [
			[5, 'hard'],
			[7, 'hard'],
			[5, 'normal']
		] as const) {
			for (let seed = 1; seed <= 6; seed++) {
				const { puzzle, solution } = generateLoop(size, size, difficulty, seed);
				const right = edgeValues(solution).map((x) => (x === LINE ? LINE : CROSS));
				for (let round = 0; round < 25; round++) {
					const from = right.map((x) => (rng.next() < 0.3 ? x : 0));
					const flips = round % 5;
					for (let k = 0; k < flips; k++) {
						const e = rng.int(from.length);
						from[e] = right[e] === LINE ? CROSS : LINE;
					}
					const r = rateLoop(puzzle, LoopLevel.Advanced, from);
					if (flips === 0) expect(r.solved).toBe(true);
					if (!r.solved) continue;
					expect([...r.edges]).toEqual(right);
					from.forEach((x, e) => x && expect(r.edges[e]).toBe(x));
				}
			}
		}
	});
});

describe('complete solver', () => {
	it('solves a puzzle that the rules alone do not, by case analysis', () => {
		const p: LoopPuzzle = { width: 3, height: 3, clues: '.1.....1.' };
		expect(solveLoop(p, { branch: false }).solutions).toHaveLength(0);
		const res = solveLoop(p, { limit: 1 });
		expect(res.solutions).toHaveLength(1);
		expect(res.branched).toBe(true);
		expect(isSolvedState(p, stateFromEdges(p, res.solutions[0]))).toBe(true);
	});

	it('finds several solutions of an ambiguous puzzle, and none of an impossible one', () => {
		const open: LoopPuzzle = { width: 3, height: 3, clues: '.........' };
		expect(solveLoop(open, { limit: 2 }).solutions).toHaveLength(2);
		// Four 3s around a 2×2 grid cannot all hold, and a 0 leaves no line for a loop.
		expect(solveLoop({ width: 2, height: 2, clues: '3333' }).solutions).toHaveLength(0);
		expect(solveLoop({ width: 1, height: 1, clues: '0' }).solutions).toHaveLength(0);
	});

	it('gives up after its node budget', () => {
		const open: LoopPuzzle = { width: 6, height: 6, clues: '.'.repeat(36) };
		const res = solveLoop(open, { limit: 1000, maxNodes: 50 });
		expect(res.finished).toBe(false);
	});
});

describe('generator', () => {
	it('draws random loops that are one simple loop', () => {
		for (const [w, h] of [
			[5, 5],
			[7, 4],
			[10, 10]
		]) {
			for (let seed = 1; seed <= 20; seed++) {
				const inside = randomLoop(w, h, new Rng(seed));
				expect(inside.some(Boolean)).toBe(true);
				const p: LoopPuzzle = { width: w, height: h, clues: '.'.repeat(w * h) };
				const s = emptyLoopState(p);
				const at = (r: number, c: number) =>
					r >= 0 && c >= 0 && r < h && c < w && inside[r * w + c];
				for (let i = 0; i <= h; i++)
					for (let j = 0; j < w; j++) if (at(i - 1, j) !== at(i, j)) s.h[hIndex(p, i, j)] = LINE;
				for (let i = 0; i < h; i++)
					for (let j = 0; j <= w; j++) if (at(i, j - 1) !== at(i, j)) s.v[vIndex(p, i, j)] = LINE;
				expect(isSolvedState(p, s), `${w}x${h} #${seed}`).toBe(true);
			}
		}
	});

	it.each([
		[5, 'normal', 1],
		[5, 'normal', 2],
		[5, 'hard', 1],
		[5, 'hard', 2],
		[7, 'normal', 1],
		[7, 'normal', 2],
		[7, 'hard', 1],
		[7, 'hard', 2]
	] as const)(
		'makes a unique %i×%i… %s puzzle that fits its level (seed %i)',
		(size, difficulty, seed) => {
			const { puzzle, solution } = generateLoop(size, size, difficulty, seed);
			expect(isSolvedState(puzzle, solution)).toBe(true);
			expect(loopLogic.countSolutions(puzzle, 2)).toEqual({ count: 1, finished: true });
			expect(fitsLoopDifficulty(puzzle, difficulty)).toBe(true);
			expect(fitsLoopDifficulty(puzzle, difficulty === 'hard' ? 'normal' : 'hard')).toBe(false);
			expect(generateLoop(size, size, difficulty, seed).puzzle).toEqual(puzzle);
		}
	);

	it('keeps a puzzle with a clue to spare out of its level', () => {
		const { puzzle, solution } = generateLoop(5, 5, 'normal', 1);
		const full = puzzle.clues.indexOf('.');
		const r = Math.floor(full / 5);
		const c = full % 5;
		const count =
			[hIndex(puzzle, r, c), hIndex(puzzle, r + 1, c)].filter((e) => solution.h[e]).length +
			[vIndex(puzzle, r, c), vIndex(puzzle, r, c + 1)].filter((e) => solution.v[e]).length;
		const more = {
			...puzzle,
			clues: `${puzzle.clues.slice(0, full)}${count}${puzzle.clues.slice(full + 1)}`
		};
		expect(rateLoop(more, LoopLevel.Basic).solved).toBe(true);
		expect(fitsLoopDifficulty(more, 'normal')).toBe(false);
	});

	it('falls back to a puzzle the basic techniques solve where no hard one exists', () => {
		// The loop around the single cell of a 1×1 grid.
		const { puzzle } = generateLoop(1, 1, 'hard', 1);
		expect(rateLoop(puzzle, LoopLevel.Basic).solved).toBe(true);
	});
});

describe('loop logic', () => {
	const v = LOOP_VARIANTS[0];
	const { puzzle, solution } = generateLoop(5, 5, 'normal', 31);

	it('lists all fifteen types, of which 5×5 and 7×7 are playable yet', () => {
		expect(LOOP_VARIANTS).toHaveLength(15);
		expect(LOOP_VARIANTS.filter(isPlayable).map((x) => x.key)).toEqual(['5n', '5h', '7n', '7h']);
		expect(LOOP_VARIANTS.find((x) => x.key === '25x30h')).toMatchObject({ width: 25, height: 30 });
	});

	it('generates the same puzzle as the generator for a seed', () => {
		expect(loopLogic.generate(v, 31)).toEqual(puzzle);
	});

	it('rates puzzles by the techniques they need', () => {
		expect(loopLogic.fitsDifficulty(puzzle, v)).toBe(true);
		expect(loopLogic.fitsDifficulty(puzzle, LOOP_VARIANTS[1])).toBe(false);
	});

	it('accepts generated puzzles and rejects malformed ones', () => {
		expect(loopLogic.isValidPuzzle(puzzle, v)).toBe(true);
		const bad: unknown[] = [
			null,
			7,
			{ ...puzzle, width: 6 },
			{ ...puzzle, clues: puzzle.clues.slice(1) },
			{ ...puzzle, clues: [...puzzle.clues] },
			{ ...puzzle, clues: '4' + puzzle.clues.slice(1) },
			{ ...puzzle, clues: 'x' + puzzle.clues.slice(1) }
		];
		for (const p of bad) expect(loopLogic.isValidPuzzle(p, v)).toBe(false);
	});

	it('verifies the solution as an answer and rejects others', () => {
		const answer = loopLogic.answer(puzzle, solution);
		expect(loopLogic.isSolved(puzzle, solution)).toBe(true);
		expect(loopLogic.verifyAnswer(puzzle, answer)).toBe(true);
		expect(loopLogic.verifyAnswer(puzzle, '0'.repeat(answer.length))).toBe(false);
		expect(loopLogic.verifyAnswer(puzzle, answer + '0')).toBe(false);
		expect(loopLogic.verifyAnswer(puzzle, 'x'.repeat(answer.length))).toBe(false);
	});

	it('round-trips encoded states', () => {
		const s = structuredClone(solution);
		s.h[0] = CROSS;
		expect(loopLogic.decodeState(puzzle, loopLogic.encodeState(s))).toEqual(s);
	});

	it('rejects corrupt saved states', () => {
		expect(loopLogic.decodeState(puzzle, 'one.two.three')).toBeNull();
		expect(loopLogic.decodeState(puzzle, '!.!')).toBeNull();
		const s = emptyLoopState(puzzle);
		s.v[0] = 3;
		expect(loopLogic.decodeState(puzzle, loopLogic.encodeState(s))).toBeNull();
		expect(loopLogic.isValidState(puzzle, undefined)).toBe(false);
		expect(loopLogic.isValidState(puzzle, { ...emptyLoopState(puzzle), h: [] })).toBe(false);
	});
});
