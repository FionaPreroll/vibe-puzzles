import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/rng';
import { generateCalc } from './generator';
import {
	brokenCages,
	cageHolds,
	cageIndex,
	cageLabel,
	evaluate,
	isSolvedCalc,
	isValidCalcPuzzle,
	labelCell,
	latinConflicts,
	type CalcPuzzle
} from './rules';
import { CalcLevel, randomLatinSquare, rateCalc, solveCalc } from './solver';

// A 4×4 puzzle with one solution, which needs more than the basic technique:
//   4 1 2 3
//   1 2 3 4
//   2 3 4 1
//   3 4 1 2
const SOLUTION = [4, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2];
const PUZZLE: CalcPuzzle = {
	width: 4,
	height: 4,
	cages: [
		{ cells: [11, 15], op: '+', target: 3 },
		{ cells: [12, 13], op: '+', target: 7 },
		{ cells: [8, 9], op: '-', target: 1 },
		{ cells: [2, 6, 7], op: '+', target: 9 },
		{ cells: [10, 14], op: '+', target: 5 },
		{ cells: [0, 4], op: '/', target: 4 },
		{ cells: [1, 5], op: '*', target: 2 },
		{ cells: [3], op: '=', target: 3 }
	]
};

describe('Calcudoku rules', () => {
	it('evaluates operations, with − and ÷ on two cells, larger first', () => {
		expect(evaluate('+', [3, 4, 5])).toBe(12);
		expect(evaluate('*', [2, 3, 4])).toBe(24);
		expect(evaluate('-', [6, 7])).toBe(1);
		expect(evaluate('-', [7, 6])).toBe(1);
		expect(evaluate('/', [1, 5])).toBe(5);
		expect(evaluate('/', [6, 3])).toBe(2);
		expect(evaluate('/', [3, 2])).toBeNaN();
		expect(evaluate('-', [1, 2, 3])).toBeNaN();
		expect(evaluate('/', [4])).toBeNaN();
		expect(evaluate('=', [4])).toBe(4);
		expect(evaluate('=', [4, 1])).toBeNaN();
	});

	it('labels cages with the target first, then the operation', () => {
		expect(PUZZLE.cages.map(cageLabel)).toEqual(['3+', '7+', '1−', '9+', '5+', '4÷', '2×', '3']);
		expect(labelCell({ cells: [9, 5, 6], op: '+', target: 9 })).toBe(5);
	});

	it('maps cells to cages and checks cage targets', () => {
		const index = cageIndex(PUZZLE);
		expect(index[0]).toBe(5);
		expect(index[7]).toBe(3);
		expect(index[3]).toBe(7);
		expect(PUZZLE.cages.every((c) => cageHolds(c, SOLUTION))).toBe(true);
		expect(isSolvedCalc(PUZZLE, SOLUTION)).toBe(true);
	});

	it('finds repeats in rows and columns and broken cages', () => {
		const grid = [...SOLUTION];
		grid[0] = 2;
		const conflicts = latinConflicts(4, grid);
		// Row 0 and column 0 both have two 2s now.
		expect(conflicts[0]).toBe(true);
		expect(conflicts[2]).toBe(true);
		expect(conflicts[8]).toBe(true);
		expect(conflicts[5]).toBe(false);
		expect(latinConflicts(4, [1, 0, 0, 1, ...new Array(12).fill(0)])[0]).toBe(true);
		expect(isSolvedCalc(PUZZLE, grid)).toBe(false);

		const broken = brokenCages(PUZZLE, grid);
		expect(broken[5]).toBe(true);
		expect(broken[0]).toBe(false);
		// An unfinished cage is not broken.
		grid[4] = 0;
		expect(brokenCages(PUZZLE, grid)[5]).toBe(false);
	});

	it('only counts full grids of digits 1..n as solved', () => {
		expect(isSolvedCalc(PUZZLE, SOLUTION.slice(1))).toBe(false);
		expect(
			isSolvedCalc(
				PUZZLE,
				SOLUTION.map((d, i) => (i === 3 ? 0 : d))
			)
		).toBe(false);
		// A Latin square (1 and 2 swapped) that misses a cage target.
		const other = SOLUTION.map((d) => (d === 1 ? 2 : d === 2 ? 1 : d));
		expect(latinConflicts(4, other).some(Boolean)).toBe(false);
		expect(isSolvedCalc(PUZZLE, other)).toBe(false);
	});

	it('validates the shape of puzzles from elsewhere', () => {
		expect(isValidCalcPuzzle(PUZZLE, 4)).toBe(true);
		expect(isValidCalcPuzzle(PUZZLE, 5)).toBe(false);
		expect(isValidCalcPuzzle(null, 4)).toBe(false);
		expect(isValidCalcPuzzle('x', 4)).toBe(false);
		expect(isValidCalcPuzzle({ ...PUZZLE, width: 3, height: 3 }, 3)).toBe(false);
		expect(isValidCalcPuzzle({ ...PUZZLE, cages: [] }, 4)).toBe(false);
		const withCage = (k: number, cage: unknown) => ({
			...PUZZLE,
			cages: PUZZLE.cages.map((c, l) => (l === k ? cage : c))
		});
		expect(isValidCalcPuzzle(withCage(7, null), 4)).toBe(false);
		expect(isValidCalcPuzzle(withCage(7, { cells: [], op: '=', target: 3 }), 4)).toBe(false);
		expect(isValidCalcPuzzle(withCage(7, { cells: [3], op: '^', target: 3 }), 4)).toBe(false);
		expect(isValidCalcPuzzle(withCage(7, { cells: [3], op: '=', target: 0 }), 4)).toBe(false);
		expect(isValidCalcPuzzle(withCage(7, { cells: [3], op: '=', target: 1.5 }), 4)).toBe(false);
		expect(isValidCalcPuzzle(withCage(7, { cells: [3], op: '-', target: 3 }), 4)).toBe(false);
		expect(isValidCalcPuzzle(withCage(7, { cells: [3], op: '+', target: 3 }), 4)).toBe(true);
		expect(isValidCalcPuzzle(withCage(5, { cells: [0, 4], op: '=', target: 4 }), 4)).toBe(false);
		// Cells out of range, used twice, missing, or not connected.
		expect(isValidCalcPuzzle(withCage(7, { cells: [16], op: '=', target: 3 }), 4)).toBe(false);
		expect(isValidCalcPuzzle(withCage(7, { cells: [2], op: '=', target: 3 }), 4)).toBe(false);
		expect(isValidCalcPuzzle({ ...PUZZLE, cages: PUZZLE.cages.slice(0, 7) }, 4)).toBe(false);
		const split = {
			...PUZZLE,
			cages: [
				...PUZZLE.cages.filter((_, k) => k !== 5 && k !== 7),
				{ cells: [0, 3], op: '+', target: 7 },
				{ cells: [4], op: '=', target: 1 }
			]
		};
		expect(isValidCalcPuzzle(split, 4)).toBe(false);
	});
});

describe('Calcudoku solver', () => {
	it('solves the sample puzzle and finds it unique', () => {
		const res = solveCalc(PUZZLE, { limit: 2 });
		expect(res.finished).toBe(true);
		expect(res.solutions).toEqual([SOLUTION]);
	});

	it('finds several solutions when cages say little', () => {
		const loose: CalcPuzzle = {
			width: 4,
			height: 4,
			cages: [0, 1, 2, 3].map((r) => ({
				cells: [0, 1, 2, 3].map((c) => r * 4 + c),
				op: '+' as const,
				target: 10
			}))
		};
		const res = solveCalc(loose, { limit: 3 });
		expect(res.solutions).toHaveLength(3);
		expect(res.finished).toBe(true);
		for (const s of res.solutions) expect(isSolvedCalc(loose, s)).toBe(true);
	});

	it('gives up after maxNodes', () => {
		const empty: CalcPuzzle = { width: 6, height: 6, cages: [] };
		const res = solveCalc(empty, { limit: 1000, maxNodes: 5 });
		expect(res.finished).toBe(false);
	});

	it('reports no solution for contradicting cages', () => {
		const bad: CalcPuzzle = {
			...PUZZLE,
			cages: PUZZLE.cages.map((c, k) => (k === 7 ? { ...c, target: 4 } : c))
		};
		expect(solveCalc(bad, { limit: 2 }).solutions).toEqual([]);
		expect(rateCalc(bad, CalcLevel.Advanced).solved).toBe(false);
	});

	it('solves by logic alone and rates by technique', () => {
		const rated = rateCalc(PUZZLE, CalcLevel.Advanced);
		expect(rated.solved).toBe(true);
		expect(rated.grid).toEqual(SOLUTION);
		expect(rateCalc(PUZZLE, CalcLevel.Basic).solved).toBe(false);
		const partial = rateCalc({ width: 4, height: 4, cages: [] }, CalcLevel.Basic);
		expect(partial.solved).toBe(false);
		expect(partial.grid.every((d) => d === 0)).toBe(true);
	});

	it('builds random Latin squares', () => {
		const rng = new Rng(7);
		const a = randomLatinSquare(6, rng);
		const b = randomLatinSquare(6, rng);
		expect(a).toHaveLength(36);
		expect(latinConflicts(6, a).some(Boolean)).toBe(false);
		expect(a.every((d) => d >= 1 && d <= 6)).toBe(true);
		expect(a).not.toEqual(b);
	});
});

describe('Calcudoku generator', () => {
	for (const n of [4, 5, 6, 7]) {
		for (const difficulty of ['easy', 'normal', 'hard'] as const) {
			it(`makes unique ${n}×${n} ${difficulty} puzzles`, () => {
				for (const seed of [1, 2, 3]) {
					const { puzzle, solution } = generateCalc(n, difficulty, seed);
					expect(isValidCalcPuzzle(puzzle, n)).toBe(true);
					expect(isSolvedCalc(puzzle, solution)).toBe(true);
					expect(solveCalc(puzzle, { limit: 2 }).solutions).toHaveLength(1);
					// Never needs guessing; easy needs only the basic technique, hard more.
					expect(rateCalc(puzzle, CalcLevel.Advanced).solved).toBe(true);
					const basic = rateCalc(puzzle, CalcLevel.Basic).solved;
					if (difficulty === 'easy') expect(basic).toBe(true);
					if (difficulty === 'hard') expect(basic).toBe(false);
				}
			});
		}
	}

	it('makes a 9×9 puzzle', () => {
		const { puzzle, solution } = generateCalc(9, 'normal', 1);
		expect(isValidCalcPuzzle(puzzle, 9)).toBe(true);
		expect(isSolvedCalc(puzzle, solution)).toBe(true);
		expect(rateCalc(puzzle, CalcLevel.Advanced).grid).toEqual(solution);
	});

	it('is deterministic per seed', () => {
		expect(generateCalc(5, 'normal', 42)).toEqual(generateCalc(5, 'normal', 42));
		expect(generateCalc(5, 'normal', 42)).not.toEqual(generateCalc(5, 'normal', 43));
	});

	it('uses − and ÷ only on two cells, and easy has fewer big cages than hard', () => {
		const sizes = (d: 'easy' | 'hard') =>
			[1, 2, 3, 4].flatMap((seed) =>
				generateCalc(6, d, seed).puzzle.cages.map((c) => c.cells.length)
			);
		const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
		expect(avg(sizes('easy'))).toBeLessThan(avg(sizes('hard')));
		for (const seed of [1, 2, 3]) {
			for (const c of generateCalc(6, 'hard', seed).puzzle.cages) {
				if (c.op === '-' || c.op === '/') expect(c.cells).toHaveLength(2);
			}
		}
	});
});
