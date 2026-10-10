import { describe, expect, it } from 'vitest';
import de from '../../../i18n/de';
import en from '../../../i18n/en';
import { sudoku } from '../index';
import { bit, type SudokuPuzzle, type SudokuState } from '../rules';
import { generateCalc } from './generator';
import { calcHint, ELIMINATIONS, type CalcHint } from './hint';
import type { CalcPuzzle } from './rules';
import { solveCalc } from './solver';

const empty = (p: CalcPuzzle): SudokuState => ({
	values: new Array(p.width * p.width).fill(0),
	notes: new Array(p.width * p.width).fill(0)
});

function puzzleOf(n: number, difficulty: 'easy' | 'normal' | 'hard', seed: number) {
	const { puzzle } = generateCalc(n, difficulty, seed);
	return { puzzle, solution: solveCalc(puzzle, { limit: 1 }).solutions[0] };
}

/** Follows hints from `state`, entering each digit, until there is none or one that is no step. */
function follow(p: CalcPuzzle, state: SudokuState, check: (h: CalcHint) => void) {
	for (;;) {
		const hint = calcHint(p, state);
		if (!hint || hint.kind !== 'step') return hint;
		check(hint);
		state.values[hint.cell] = hint.digit;
	}
}

/** One cage over the whole 4×4 grid: many solutions, and nothing to deduce. */
const open4: CalcPuzzle = {
	width: 4,
	height: 4,
	cages: [{ cells: [...Array(16).keys()], op: '+', target: 40 }]
};

describe('calcudoku hints', () => {
	it('lead from the empty board to the solution, every digit right', () => {
		const eliminations = new Set<string>();
		let named = 0;
		for (const [n, difficulty, seed] of [
			[5, 'easy', 1],
			[5, 'hard', 1],
			[7, 'normal', 2],
			[9, 'normal', 1]
		] as const) {
			const { puzzle, solution } = puzzleOf(n, difficulty, seed);
			const last = follow(puzzle, empty(puzzle), (h) => {
				if (h.kind !== 'step') return;
				expect(h.digit).toBe(solution[h.cell]);
				if (h.elimination) eliminations.add(h.elimination);
				expect(h.pattern.length > 0).toBe(!!h.elimination);
				if (h.cage === null) return;
				// One cage decides the digit by itself: its cells are the pattern.
				expect(h.pattern).toEqual(puzzle.cages[h.cage].cells);
				named++;
			});
			expect(last, `${n} ${difficulty} ${seed}`).toBeNull();
		}
		expect([...eliminations].sort()).toEqual([...ELIMINATIONS].sort());
		expect(named).toBeGreaterThan(0);
	});

	it('point at wrong digits and at notes that leave out the right digit', () => {
		const { puzzle, solution } = puzzleOf(5, 'easy', 1);
		const state = empty(puzzle);
		state.values[0] = (solution[0] % 5) + 1;
		state.notes[1] = bit((solution[1] % 5) + 1);
		state.notes[2] = bit(solution[2]) | bit((solution[2] % 5) + 1);
		expect(calcHint(puzzle, state)).toEqual({ kind: 'mistake', cells: [0, 1] });
	});

	it('take the notes into account', () => {
		const { puzzle, solution } = puzzleOf(5, 'hard', 1);
		const state = empty(puzzle);
		state.notes = solution.map((d) => bit(d));
		const hint = calcHint(puzzle, state);
		expect(hint).toMatchObject({ kind: 'step', elimination: null });
		if (hint?.kind === 'step') expect(hint.digit).toBe(solution[hint.cell]);
	});

	it('name the cell with the fewest candidates when no technique finds a digit', () => {
		expect(calcHint(open4, empty(open4))).toEqual({ kind: 'stuck', cell: 0 });
	});

	it('still help on a puzzle without a solution', () => {
		// Two cells of the top row would both hold a 1.
		const broken: CalcPuzzle = {
			width: 4,
			height: 4,
			cages: [
				{ cells: [0], op: '=', target: 1 },
				{ cells: [1], op: '=', target: 1 },
				{ cells: [2, 3, ...Array.from({ length: 12 }, (_, k) => k + 4)], op: '+', target: 38 }
			]
		};
		expect(calcHint(broken, empty(broken))?.kind).toBe('step');
	});

	it('give nothing once the puzzle is solved', () => {
		const { puzzle, solution } = puzzleOf(5, 'easy', 1);
		expect(calcHint(puzzle, { ...empty(puzzle), values: solution.slice() })).toBeNull();
	});

	it('come with texts in every language', () => {
		const lookup = (dict: unknown, key: string) =>
			key.split('.').reduce((node, part) => (node as Record<string, unknown>)?.[part], dict);
		const asSudoku = (p: CalcPuzzle): SudokuPuzzle => ({
			...p,
			givens: new Array(p.width * p.width).fill(0)
		});
		const { puzzle, solution } = puzzleOf(9, 'normal', 1);
		// Up to the first step that needs a naked pair.
		const state = empty(puzzle);
		let hint = calcHint(puzzle, state);
		while (hint?.kind === 'step' && hint.elimination !== 'nakedPair') {
			state.values[hint.cell] = hint.digit;
			hint = calcHint(puzzle, state);
		}
		const paired = sudoku.hint!(asSudoku(puzzle), state)!;
		expect(paired.text).toEqual([
			'games.sudoku.modes.calc.hints.nakedPair',
			expect.stringMatching(/^games\.sudoku\.hints\.then/)
		]);
		// A cage that decides a digit by itself: tinted, and named by its label. A cage of one cell
		// just holds its number.
		const start = empty(puzzle);
		const seen = new Set<string>();
		for (let caged = calcHint(puzzle, start); caged?.kind === 'step';) {
			if (caged.cage !== null) {
				const named = sudoku.hint!(asSudoku(puzzle), start)!;
				const { op, cells } = puzzle.cages[caged.cage];
				const key = `games.sudoku.modes.calc.hints.${op === '=' ? 'cageGiven' : 'cageOne'}`;
				expect(named.teaser?.at(-1)).toBe(key);
				expect(named.text).toContain(key);
				expect(named.params?.cage).toMatch(op === '=' ? /^\d+$/ : /^\d+[+−×÷]$/);
				expect(named.area).toEqual(cells.map(String));
				seen.add(key);
			}
			start.values[caged.cell] = caged.digit;
			caged = calcHint(puzzle, start);
		}
		expect(seen.size).toBe(2);
		const wrong = empty(puzzle);
		wrong.values[0] = (solution[0] % 9) + 1;
		expect(sudoku.hint!(asSudoku(puzzle), wrong)).toMatchObject({
			kind: 'mistake',
			spotlight: ['0']
		});
		expect(sudoku.hint!(asSudoku(open4), empty(open4))).toMatchObject({
			kind: 'stuck',
			text: ['games.sudoku.hints.stuck']
		});
		const keys = [
			'hidden.row',
			'hidden.column',
			'naked',
			'whereNaked',
			'cageOne',
			'cageGiven',
			...ELIMINATIONS
		].map((k) => `games.sudoku.modes.calc.hints.${k}`);
		for (const key of keys) {
			expect(typeof lookup(en, key), key).toBe('string');
			expect(typeof lookup(de, key), key).toBe('string');
		}
	});
});
