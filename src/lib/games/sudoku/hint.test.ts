import { describe, expect, it } from 'vitest';
import de from '../../i18n/de';
import en from '../../i18n/en';
import { generateSudoku } from './generator';
import { ELIMINATIONS, sudokuHint, type SudokuHint } from './hint';
import { sudoku } from './index';
import { bit, emptySudokuState, type SudokuPuzzle, type SudokuState } from './rules';
import { solveSudoku } from './solver';

function puzzleOf(difficulty: 'easy' | 'normal' | 'hard', seed: number) {
	const { puzzle } = generateSudoku(9, difficulty, seed);
	const solution = solveSudoku(puzzle.givens, 9, { limit: 1 }).solutions[0];
	return { puzzle, solution };
}

/** Follows hints from `state`, entering each digit, until there is none or one that is no step. */
function follow(p: SudokuPuzzle, state: SudokuState, check: (h: SudokuHint) => void) {
	for (;;) {
		const hint = sudokuHint(p, state);
		if (!hint || hint.kind !== 'step') return hint;
		check(hint);
		state.values[hint.cell] = hint.digit;
	}
}

describe('sudoku hints', () => {
	it('lead from the empty board to the solution, every digit right', () => {
		const eliminations = new Set<string>();
		for (const [difficulty, seed] of [
			['easy', 1],
			['normal', 1],
			['hard', 1],
			['hard', 3],
			['hard', 22]
		] as const) {
			const { puzzle, solution } = puzzleOf(difficulty, seed);
			const last = follow(puzzle, emptySudokuState(puzzle), (h) => {
				if (h.kind !== 'step') return;
				expect(h.digit).toBe(solution[h.cell]);
				if (h.elimination) eliminations.add(h.elimination);
			});
			expect(last, `${difficulty} ${seed}`).toBeNull();
		}
		expect([...eliminations].sort()).toEqual(['hiddenSubset', 'lockedCandidates', 'nakedSubset']);
	});

	it('start with a digit that has one place left in its box', () => {
		const { puzzle, solution } = puzzleOf('easy', 1);
		const hint = sudokuHint(puzzle, emptySudokuState(puzzle));
		expect(hint).toMatchObject({ kind: 'step', unit: 'box', elimination: null });
		if (hint?.kind === 'step') expect(hint.digit).toBe(solution[hint.cell]);
	});

	it('point at wrong digits and at notes that leave out the right digit', () => {
		const { puzzle, solution } = puzzleOf('easy', 1);
		const [a, b, c] = puzzle.givens.flatMap((g, i) => (g ? [] : [i]));
		const state = emptySudokuState(puzzle);
		state.values[a] = (solution[a] % 9) + 1;
		state.notes[b] = bit((solution[b] % 9) + 1);
		state.notes[c] = bit(solution[c]) | bit((solution[c] % 9) + 1); // right digit among them
		expect(sudokuHint(puzzle, state)).toEqual({ kind: 'mistake', cells: [a, b] });
	});

	it('take the notes into account', () => {
		const { puzzle, solution } = puzzleOf('hard', 1);
		const state = emptySudokuState(puzzle);
		state.notes = solution.map((d, i) => (puzzle.givens[i] ? 0 : bit(d)));
		const hint = sudokuHint(puzzle, state);
		expect(hint).toMatchObject({ kind: 'step', elimination: null });
		if (hint?.kind === 'step') expect(hint.digit).toBe(solution[hint.cell]);
	});

	it('name the cell with the fewest candidates when no technique finds a digit', () => {
		// A single given: lots of solutions, and no technique decides a cell.
		const givens = new Array(81).fill(0);
		givens[0] = 5;
		const sparse: SudokuPuzzle = { width: 9, height: 9, givens };
		const hint = sudokuHint(sparse, emptySudokuState(sparse));
		expect(hint).toEqual({ kind: 'stuck', cell: 1 });
	});

	it('still help on a puzzle without a solution, with no mistakes to point at', () => {
		// The top right cell sees every digit: 1 to 8 in its row, 9 in its column.
		const givens = new Array(81).fill(0);
		for (let c = 0; c < 8; c++) givens[c] = c + 1;
		givens[17] = 9;
		const broken: SudokuPuzzle = { width: 9, height: 9, givens };
		expect(sudokuHint(broken, emptySudokuState(broken))?.kind).toBe('step');
	});

	it('give nothing once the puzzle is solved', () => {
		const { puzzle, solution } = puzzleOf('easy', 1);
		const state = emptySudokuState(puzzle);
		state.values = solution.map((d, i) => (puzzle.givens[i] ? 0 : d));
		expect(sudokuHint(puzzle, state)).toBeNull();
	});

	it('come with texts in every language', () => {
		const lookup = (dict: unknown, key: string) =>
			key.split('.').reduce((node, part) => (node as Record<string, unknown>)?.[part], dict);
		const { puzzle } = puzzleOf('hard', 3);
		// Up to the first step that needs an elimination.
		const state = emptySudokuState(puzzle);
		let hint = sudokuHint(puzzle, state);
		while (hint?.kind === 'step' && !hint.elimination) {
			state.values[hint.cell] = hint.digit;
			hint = sudokuHint(puzzle, state);
		}
		const deduced = sudoku.hint!(puzzle, state)!;
		expect(deduced.text).toEqual([
			'games.sudoku.hints.nakedSubset',
			expect.stringMatching(/^games\.sudoku\.hints\.then/)
		]);
		expect(deduced.params?.digit).toBeGreaterThan(0);

		const first = sudoku.hint!(puzzle, emptySudokuState(puzzle))!;
		expect(first).toMatchObject({ kind: 'step', text: ['games.sudoku.hints.hidden.box'] });
		const wrong = emptySudokuState(puzzle);
		const cell = puzzle.givens.indexOf(0);
		wrong.notes[cell] = 0;
		wrong.values[cell] = (solveSudoku(puzzle.givens, 9, { limit: 1 }).solutions[0][cell] % 9) + 1;
		expect(sudoku.hint!(puzzle, wrong)).toEqual({
			kind: 'mistake',
			spotlight: [String(cell)],
			text: ['game.hintMistake']
		});
		const sparse: SudokuPuzzle = { width: 9, height: 9, givens: [5, ...new Array(80).fill(0)] };
		expect(sudoku.hint!(sparse, emptySudokuState(sparse))).toMatchObject({
			kind: 'stuck',
			spotlight: ['1']
		});

		const keys = [
			...['box', 'row', 'column'].flatMap((u) => [`hidden.${u}`, `then.${u}`]),
			'naked',
			'thenNaked',
			'stuck',
			...ELIMINATIONS
		].map((k) => `games.sudoku.hints.${k}`);
		for (const key of keys) {
			expect(typeof lookup(en, key), key).toBe('string');
			expect(typeof lookup(de, key), key).toBe('string');
		}
	});
});
