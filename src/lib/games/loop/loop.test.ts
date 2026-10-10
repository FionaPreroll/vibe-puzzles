import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { isPlayable } from '../../core/variants';
import { generateLoop, randomLoop, solvesWithoutGuessing } from './generator';
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
import { LoopSolver, solveLoop } from './solver';

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

describe('solver', () => {
	it('solves a generated normal puzzle by propagation alone', () => {
		const { puzzle } = generateLoop(5, 5, 'normal', 3);
		const res = solveLoop(puzzle, { branch: false });
		expect(res.solutions).toHaveLength(1);
		expect(res.branched).toBe(false);
		expect(isSolvedState(puzzle, stateFromEdges(puzzle, res.solutions[0]))).toBe(true);
	});

	it('needs case analysis where no rule decides an edge', () => {
		expect(solveLoop(square, { branch: false }).solutions).toHaveLength(0);
		const res = solveLoop(square);
		expect(res.solutions).toHaveLength(1);
		expect(res.branched).toBe(true);
		expect(isSolvedState(square, stateFromEdges(square, res.solutions[0]))).toBe(true);
	});

	it('finds several solutions of an ambiguous puzzle, and none of an impossible one', () => {
		const open: LoopPuzzle = { width: 3, height: 3, clues: '.........' };
		expect(solveLoop(open, { limit: 2 }).solutions).toHaveLength(2);
		// Four 3s around a 2×2 grid cannot all hold.
		expect(solveLoop({ width: 2, height: 2, clues: '3333' }).solutions).toHaveLength(0);
	});

	it('crosses an edge that would close a loop too early', () => {
		// Three sides of the left cell are drawn. Closing the fourth would leave the 1 on the
		// right without a line.
		const p: LoopPuzzle = { width: 3, height: 1, clues: '..1' };
		const v = Uint8Array.from(edgeValues(lines(p, 'h:0:0', 'v:0:0', 'h:1:0')));
		const closing = edgeValues(lines(p, 'v:0:1')).indexOf(LINE);
		expect(new LoopSolver(p).propagate(v)).toBe(true);
		expect(v[closing]).toBe(CROSS);
		// Without the 1, that loop is a solution, so the edge stays open.
		const free: LoopPuzzle = { ...p, clues: '...' };
		const w = Uint8Array.from(edgeValues(lines(free, 'h:0:0', 'v:0:0', 'h:1:0')));
		expect(new LoopSolver(free).propagate(w)).toBe(true);
		expect(w[closing]).toBe(0);
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

	it.each([1, 2, 3, 4, 5])(
		'makes a uniquely solvable 5×5 normal puzzle that propagation solves (seed %i)',
		(seed) => {
			const { puzzle, solution } = generateLoop(5, 5, 'normal', seed);
			expect(isSolvedState(puzzle, solution)).toBe(true);
			expect(loopLogic.countSolutions(puzzle, 2)).toEqual({ count: 1, finished: true });
			expect(solvesWithoutGuessing(puzzle)).toBe(true);
			// Some clues go, or it would be no puzzle.
			expect(puzzle.clues).toContain('.');
			expect(generateLoop(5, 5, 'normal', seed).puzzle).toEqual(puzzle);
		}
	);

	it('makes a hard puzzle that needs case analysis', () => {
		const { puzzle, solution } = generateLoop(5, 5, 'hard', 1);
		expect(isSolvedState(puzzle, solution)).toBe(true);
		expect(loopLogic.countSolutions(puzzle, 2)).toEqual({ count: 1, finished: true });
		expect(solvesWithoutGuessing(puzzle)).toBe(false);
	});
});

describe('loop logic', () => {
	const v = LOOP_VARIANTS[0];
	const { puzzle, solution } = generateLoop(5, 5, 'normal', 31);

	it('lists all fifteen types, of which only 5×5 Normal is playable yet', () => {
		expect(LOOP_VARIANTS).toHaveLength(15);
		expect(LOOP_VARIANTS.filter(isPlayable).map((x) => x.key)).toEqual(['5n']);
		expect(LOOP_VARIANTS.find((x) => x.key === '25x30h')).toMatchObject({ width: 25, height: 30 });
	});

	it('generates the same puzzle as the generator for a seed', () => {
		expect(loopLogic.generate(v, 31)).toEqual(puzzle);
	});

	it('rates puzzles by whether they need case analysis', () => {
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
