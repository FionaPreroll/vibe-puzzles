import { describe, expect, it } from 'vitest';
import { EASY_GIVENS, generateSudoku } from './generator';
import { SUDOKU_VARIANTS, sudokuLogic } from './logic';
import {
	bit,
	boxShape,
	candidates,
	conflicts,
	currentGrid,
	digitsOf,
	emptySudokuState,
	fillMissingNotes,
	fillNotes,
	geometry,
	hasBoxes,
	isSolvedGrid,
	mistakes,
	placeDigit,
	pruneNotes,
	remainingDigits,
	toggleNote,
	type SudokuPuzzle
} from './rules';
import { solveCalc } from './calc/solver';
import { Level, ratePuzzle, solveSudoku } from './solver';

const parse = (text: string) => [...text.replace(/\s/g, '')].map((ch) => (ch === '.' ? 0 : +ch));

// A classic puzzle (singles are enough) and its solution.
const EASY = parse(`
	53..7.... 6..195... .98....6.
	8...6...3 4..8.3..1 7...2...6
	.6....28. ...419..5 ....8..79`);
const EASY_SOLUTION = parse(`
	534678912 672195348 198342567
	859761423 426853791 713924856
	961537284 287419635 345286179`);
const easy: SudokuPuzzle = { width: 9, height: 9, givens: EASY };
const nine = SUDOKU_VARIANTS[0];

describe('geometry', () => {
	it('derives box shapes', () => {
		expect(boxShape(9)).toEqual({ w: 3, h: 3 });
		expect(boxShape(6)).toEqual({ w: 3, h: 2 });
		expect(boxShape(4)).toEqual({ w: 2, h: 2 });
	});

	it('lists rows, columns, boxes and 20 peers per cell', () => {
		const g = geometry(9);
		expect(g.units).toHaveLength(27);
		expect(g.units.every((u) => u.length === 9)).toBe(true);
		expect(g.units[18]).toEqual([0, 1, 2, 9, 10, 11, 18, 19, 20]);
		expect(g.peers.every((p) => p.length === 20)).toBe(true);
		expect(geometry(9)).toBe(g);
		// 6×6: boxes are three wide and two high.
		expect(geometry(6).units[12]).toEqual([0, 1, 2, 6, 7, 8]);
	});

	it('converts masks to digits', () => {
		expect(digitsOf(bit(1) | bit(5) | bit(9))).toEqual([1, 5, 9]);
		expect(digitsOf(0)).toEqual([]);
	});
});

describe('rules', () => {
	it('finds candidates, conflicts and mistakes', () => {
		// Cell (0,2): row has 5,3,7; column 8; box 6,9 → 1, 2, 4 remain.
		expect(digitsOf(candidates(9, EASY, 2))).toEqual([1, 2, 4]);
		expect(conflicts(9, EASY).some(Boolean)).toBe(false);
		const s = placeDigit(easy, emptySudokuState(easy), 2, 5);
		const c = conflicts(9, currentGrid(easy, s));
		expect([0, 2].every((i) => c[i])).toBe(true);
		expect(c.filter(Boolean)).toHaveLength(2);
		const m = mistakes(easy, placeDigit(easy, s, 3, 6), EASY_SOLUTION);
		expect(m[2]).toBe(true);
		expect(m[3]).toBe(false);
		expect(m[0]).toBe(false);
	});

	it('counts the remaining uses of every digit', () => {
		const s = emptySudokuState(easy);
		const counts = (grid: number[]) =>
			[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (d ? 9 - grid.filter((x) => x === d).length : 0));
		expect(remainingDigits(easy, s)).toEqual(counts(EASY));
		const more = placeDigit(easy, s, 2, 4);
		expect(remainingDigits(easy, more)[4]).toBe(remainingDigits(easy, s)[4] - 1);
		const full = { ...s, values: EASY_SOLUTION.map((d, i) => (EASY[i] ? 0 : d)) };
		expect(remainingDigits(easy, full)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
	});

	it('keeps givens fixed and toggles notes', () => {
		const s = emptySudokuState(easy);
		expect(placeDigit(easy, s, 0, 1)).toBe(s);
		expect(toggleNote(easy, s, 0, 1)).toBe(s);
		expect(placeDigit(easy, s, 2, 0)).toBe(s);
		const noted = toggleNote(easy, toggleNote(easy, s, 2, 4), 2, 1);
		expect(digitsOf(noted.notes[2])).toEqual([1, 4]);
		expect(toggleNote(easy, noted, 2, 4).notes[2]).toBe(bit(1));
		expect(s.notes[2]).toBe(0);
	});

	it('fills notes with the candidates of empty cells', () => {
		const s = placeDigit(easy, emptySudokuState(easy), 2, 4);
		const filled = fillNotes(easy, { ...s, notes: s.notes.map((_, i) => (i === 2 ? 7 : 0)) });
		expect(filled.notes[0]).toBe(0);
		// Cell 2 holds a digit: its notes stay as they were.
		expect(filled.notes[2]).toBe(7);
		expect(digitsOf(filled.notes[3])).toEqual([2, 6]);
	});

	it('fills notes only where a cell has none', () => {
		let s = toggleNote(easy, emptySudokuState(easy), 3, 6);
		s = fillMissingNotes(easy, s);
		expect(digitsOf(s.notes[3])).toEqual([6]);
		expect(digitsOf(s.notes[2])).toEqual([1, 2, 4]);
		expect(s.notes[0]).toBe(0);
		expect(fillMissingNotes(easy, s)).toBe(s);
		// A cell with no possible digit left stays without notes.
		let stuck = fillNotes(easy, emptySudokuState(easy));
		for (const [i, d] of [
			[3, 1],
			[5, 2],
			[6, 4]
		])
			stuck = placeDigit(easy, stuck, i, d);
		stuck = { ...stuck, notes: stuck.notes.map((m, i) => (i === 2 ? 0 : m)) };
		expect(fillMissingNotes(easy, stuck)).toBe(stuck);
	});

	it('removes notes that a placed digit rules out', () => {
		let s = toggleNote(easy, emptySudokuState(easy), 3, 2);
		s = toggleNote(easy, s, 3, 6);
		s = toggleNote(easy, s, 2, 2);
		expect(pruneNotes(easy, s)).toBe(s);
		s = placeDigit(easy, s, 2, 2);
		const pruned = pruneNotes(easy, s);
		expect(digitsOf(pruned.notes[3])).toEqual([6]);
		expect(digitsOf(pruned.notes[2])).toEqual([2]);
	});

	it('recognises a solved grid', () => {
		expect(isSolvedGrid(9, EASY_SOLUTION)).toBe(true);
		expect(isSolvedGrid(9, EASY)).toBe(false);
		const swapped = EASY_SOLUTION.slice();
		[swapped[0], swapped[1]] = [swapped[1], swapped[0]];
		expect(isSolvedGrid(9, swapped)).toBe(false);
	});
});

describe('solver', () => {
	it('solves a puzzle and proves the solution unique', () => {
		const res = solveSudoku(EASY, 9, { limit: 2 });
		expect(res).toEqual({ solutions: [EASY_SOLUTION], finished: true });
	});

	it('stops at the limit on an open grid and reports contradictory givens', () => {
		const empty = new Array(81).fill(0);
		expect(solveSudoku(empty, 9, { limit: 3 })).toMatchObject({ finished: true });
		expect(solveSudoku(empty, 9, { limit: 3 }).solutions).toHaveLength(3);
		const clash = EASY.slice();
		clash[2] = 5;
		expect(solveSudoku(clash, 9, { limit: 2 })).toEqual({ solutions: [], finished: true });
	});

	it('gives up after the node budget', () => {
		const sparse = new Array(81).fill(0);
		sparse[0] = 1;
		sparse[80] = 1;
		const res = solveSudoku(sparse, 9, { limit: 1000, maxNodes: 50 });
		expect(res.finished).toBe(false);
	});

	it('rates a puzzle by the techniques it needs', () => {
		expect(ratePuzzle(easy)).toMatchObject({ solved: true, level: Level.Singles });
		expect(ratePuzzle(easy).grid).toEqual(EASY_SOLUTION);
		const hard = generateSudoku(9, 'hard', 7).puzzle;
		expect(ratePuzzle(hard, Level.Singles).solved).toBe(false);
		expect(ratePuzzle(hard)).toMatchObject({ solved: true, level: Level.Subsets });
		// Too few givens: logic gets stuck.
		expect(ratePuzzle({ ...easy, givens: new Array(81).fill(0) }).solved).toBe(false);
		const clash = EASY.slice();
		clash[2] = 5;
		expect(ratePuzzle({ ...easy, givens: clash }).solved).toBe(false);
	});
});

describe('generator', () => {
	it.each([
		['easy', 9],
		['normal', 9],
		['hard', 9],
		['normal', 6],
		['hard', 4]
	] as const)('makes %s %i×%i puzzles with one solution', (difficulty, size) => {
		for (const seed of [1, 2, 3]) {
			const { puzzle, solution } = generateSudoku(size, difficulty, seed);
			const res = solveSudoku(puzzle.givens, size, { limit: 2 });
			expect(res.solutions).toEqual([solution]);
			expect(isSolvedGrid(size, solution)).toBe(true);
			const n = size * size;
			// Givens are point-symmetric.
			expect(puzzle.givens.every((g, i) => !g === !puzzle.givens[n - 1 - i])).toBe(true);
			if (size === 9) {
				expect(ratePuzzle(puzzle, Level.Singles).solved).toBe(difficulty !== 'hard');
				expect(ratePuzzle(puzzle).solved).toBe(true);
			}
		}
	});

	it('keeps more givens on easy than on normal', () => {
		for (const seed of [1, 2, 3]) {
			const easyCount = generateSudoku(9, 'easy', seed).puzzle.givens.filter(Boolean).length;
			const normalCount = generateSudoku(9, 'normal', seed).puzzle.givens.filter(Boolean).length;
			expect(easyCount).toBeGreaterThanOrEqual(EASY_GIVENS);
			expect(easyCount).toBeLessThanOrEqual(EASY_GIVENS + 1);
			expect(normalCount).toBeLessThan(EASY_GIVENS);
		}
		// Smaller grids keep a proportional share.
		expect(
			generateSudoku(6, 'easy', 1).puzzle.givens.filter(Boolean).length
		).toBeGreaterThanOrEqual(16);
	});

	it('is deterministic per seed', () => {
		expect(generateSudoku(9, 'hard', 42)).toEqual(generateSudoku(9, 'hard', 42));
		expect(generateSudoku(9, 'normal', 1).puzzle).not.toEqual(
			generateSudoku(9, 'normal', 2).puzzle
		);
	});
});

describe('logic', () => {
	it('generates valid puzzles for every variant', () => {
		SUDOKU_VARIANTS.forEach((v, k) => {
			const p = sudokuLogic.generate(v, 10 + k);
			expect(sudokuLogic.isValidPuzzle(p, v)).toBe(true);
			expect(sudokuLogic.countSolutions(p, 2)).toEqual({ count: 1, finished: true });
		});
	});

	it('rejects malformed puzzles', () => {
		const bad = (p: unknown) => sudokuLogic.isValidPuzzle(p, nine);
		expect(bad(easy)).toBe(true);
		expect(bad(null)).toBe(false);
		expect(bad({ ...easy, width: 8 })).toBe(false);
		expect(bad({ ...easy, givens: EASY.slice(1) })).toBe(false);
		expect(bad({ ...easy, givens: EASY.map((d) => (d ? 10 : 0)) })).toBe(false);
		expect(bad({ ...easy, givens: new Array(81).fill(0) })).toBe(false);
		const clash = EASY.slice();
		clash[2] = 5;
		expect(bad({ ...easy, givens: clash })).toBe(false);
		expect(sudokuLogic.isValidPuzzle(easy, { ...nine, width: 8, height: 8 })).toBe(false);
	});

	it('checks solutions and answers', () => {
		const s = emptySudokuState(easy);
		expect(sudokuLogic.isSolved(easy, s)).toBe(false);
		const solved = { ...s, values: EASY_SOLUTION.map((d, i) => (EASY[i] ? 0 : d)) };
		expect(sudokuLogic.isSolved(easy, solved)).toBe(true);
		const answer = sudokuLogic.answer(easy, solved);
		expect(answer).toBe(EASY_SOLUTION.join(''));
		expect(sudokuLogic.verifyAnswer(easy, answer)).toBe(true);
		expect(sudokuLogic.verifyAnswer(easy, answer.slice(1))).toBe(false);
		expect(sudokuLogic.verifyAnswer(easy, answer.replace(/^5/, '0'))).toBe(false);
		// A valid grid that ignores the givens.
		const relabelled = [...answer].map((d) => String((+d % 9) + 1)).join('');
		expect(sudokuLogic.verifyAnswer(easy, relabelled)).toBe(false);
	});

	it('removes ruled-out notes after a move only when asked to', () => {
		const s = placeDigit(easy, toggleNote(easy, emptySudokuState(easy), 3, 2), 2, 2);
		expect(sudokuLogic.afterMove!(easy, s, {})).toBe(s);
		expect(sudokuLogic.afterMove!(easy, s, { autoRemoveNotes: true }).notes[3]).toBe(0);
	});

	it('fills in notes after a move when asked to, also after erasing a digit', () => {
		const start = emptySudokuState(easy);
		const filled = sudokuLogic.afterMove!(easy, start, { autoNotes: true });
		expect(filled).toEqual(fillNotes(easy, start));
		// A digit in cell 2 rules out 4 elsewhere only with note removal on.
		const placed = placeDigit(easy, filled, 2, 4);
		expect(digitsOf(sudokuLogic.afterMove!(easy, placed, { autoNotes: true }).notes[11])).toContain(
			4
		);
		const both = { autoNotes: true, autoRemoveNotes: true };
		const pruned = sudokuLogic.afterMove!(easy, placed, both);
		expect(digitsOf(pruned.notes[11])).not.toContain(4);
		// Erasing the digit keeps the cell's old notes.
		expect(sudokuLogic.afterMove!(easy, placeDigit(easy, pruned, 2, 0), both).notes[2]).toBe(
			filled.notes[2]
		);
	});

	it('encodes and decodes states', () => {
		let s = fillNotes(easy, placeDigit(easy, emptySudokuState(easy), 2, 4));
		s = toggleNote(easy, s, 80, 9);
		const text = sudokuLogic.encodeState(s);
		expect(text).toMatch(/^[\w-]+\.[\w-]+$/);
		expect(sudokuLogic.decodeState(easy, text)).toEqual(s);
		expect(sudokuLogic.decodeState(easy, 'nope')).toBeNull();
		expect(sudokuLogic.decodeState(easy, '!!.!!')).toBeNull();
		// A digit on a given cell is not a valid state.
		const onGiven = { ...s, values: s.values.map((d, i) => (i === 0 ? 1 : d)) };
		expect(sudokuLogic.decodeState(easy, sudokuLogic.encodeState(onGiven))).toBeNull();
	});

	it('validates states', () => {
		const s = emptySudokuState(easy);
		expect(sudokuLogic.isValidState(easy, s)).toBe(true);
		expect(sudokuLogic.isValidState(easy, null)).toBe(false);
		expect(sudokuLogic.isValidState(easy, { ...s, notes: s.notes.map(() => 512) })).toBe(false);
		expect(sudokuLogic.isValidState(easy, { ...s, values: s.values.slice(1) })).toBe(false);
	});

	describe('Calcudoku mode', () => {
		const v = SUDOKU_VARIANTS.find((x) => x.key === 'c5n')!;
		const p = sudokuLogic.generate(v, 3);
		const solution = solveCalc({ width: 5, height: 5, cages: p.cages! }, { limit: 1 }).solutions[0];

		it('has cages and no givens', () => {
			expect(v).toMatchObject({ mode: 'calc', width: 5, difficulty: 'normal' });
			expect(p.givens.every((g) => g === 0)).toBe(true);
			expect(p.cages!.length).toBeGreaterThan(5);
			expect(hasBoxes(p)).toBe(false);
			expect(hasBoxes(easy)).toBe(true);
		});

		it('validates puzzles against the variant', () => {
			expect(sudokuLogic.isValidPuzzle(p, v)).toBe(true);
			expect(sudokuLogic.isValidPuzzle(p, nine)).toBe(false);
			expect(sudokuLogic.isValidPuzzle(easy, v)).toBe(false);
			expect(sudokuLogic.isValidPuzzle({ ...p, givens: p.givens.map((_, i) => +!i) }, v)).toBe(
				false
			);
			expect(sudokuLogic.isValidPuzzle({ ...p, cages: p.cages!.slice(1) }, v)).toBe(false);
			expect(sudokuLogic.isValidPuzzle(p, { ...v, height: 7 })).toBe(false);
		});

		it('checks rows, columns and cages, not boxes', () => {
			const s = emptySudokuState(p);
			expect(sudokuLogic.isSolved(p, { ...s, values: solution })).toBe(true);
			const answer = solution.join('');
			expect(sudokuLogic.verifyAnswer(p, answer)).toBe(true);
			// Another Latin square misses the cages.
			const shifted = solution.map((d) => (d % 5) + 1);
			expect(sudokuLogic.isSolved(p, { ...s, values: shifted })).toBe(false);
			expect(sudokuLogic.verifyAnswer(p, shifted.join(''))).toBe(false);
		});

		it('fills and prunes notes by rows and columns only', () => {
			const placed = placeDigit(p, emptySudokuState(p), 0, 3);
			const filled = fillNotes(p, placed);
			// Cell 6 shares neither row nor column with cell 0, so 3 stays possible (no boxes).
			expect(digitsOf(filled.notes[6])).toEqual([1, 2, 3, 4, 5]);
			expect(digitsOf(filled.notes[1])).toEqual([1, 2, 4, 5]);
			expect(digitsOf(filled.notes[5])).toEqual([1, 2, 4, 5]);
			expect(candidates(5, placed.values, 6, false)).toBe(31);
			expect(conflicts(5, [1, 0, 0, 0, 0, 0, 1, ...new Array(18).fill(0)], false)[0]).toBe(false);
			expect(conflicts(5, [1, 0, 0, 0, 0, 1, ...new Array(19).fill(0)], false)[0]).toBe(true);
			expect(isSolvedGrid(5, solution, false)).toBe(true);
		});

		it('keeps notes for all digits of a 9×9 grid', () => {
			const big = sudokuLogic.generate(
				SUDOKU_VARIANTS.find((x) => x.key === 'c9e')!,
				1
			);
			const s = fillNotes(big, emptySudokuState(big));
			expect(sudokuLogic.decodeState(big, sudokuLogic.encodeState(s))).toEqual(s);
		});
	});
});
