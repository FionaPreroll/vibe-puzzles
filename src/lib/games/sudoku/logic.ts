import { packDigits, unpackDigits } from '../../core/grid';
import type { GameLogic, Settings } from '../../core/types';
import type { Variant } from '../../core/variants';
import { generateCalc } from './calc/generator';
import { isSolvedCalc, isValidCalcPuzzle } from './calc/rules';
import { CalcLevel, rateCalc, solveCalc } from './calc/solver';
import { generateSudoku } from './generator';
import {
	allMask,
	conflicts,
	currentGrid,
	emptySudokuState,
	fillMissingNotes,
	isSolvedGrid,
	pruneNotes,
	SIZES,
	type SudokuPuzzle,
	type SudokuState
} from './rules';
import { Level, ratePuzzle, solveSudoku } from './solver';

export const SUDOKU_VARIANTS: Variant[] = [
	{ key: '9e', label: '9x9 Easy', width: 9, height: 9, difficulty: 'easy' },
	{ key: '9n', label: '9x9 Normal', width: 9, height: 9, difficulty: 'normal' },
	{ key: '9h', label: '9x9 Hard', width: 9, height: 9, difficulty: 'hard' },
	{
		key: 'daily',
		label: 'Special Daily',
		width: 9,
		height: 9,
		difficulty: 'normal',
		special: 'daily'
	},
	{
		key: 'weekly',
		label: 'Special Weekly',
		width: 9,
		height: 9,
		difficulty: 'hard',
		special: 'weekly'
	},
	{
		key: 'monthly',
		label: 'Special Monthly',
		width: 9,
		height: 9,
		difficulty: 'hard',
		special: 'monthly'
	},
	// Calcudoku ("Math Sudoku"): no boxes, cages with a target and an operation.
	...[5, 7, 9].flatMap((n) =>
		(['easy', 'normal', 'hard'] as const).map((difficulty): Variant => ({
			key: `c${n}${difficulty[0]}`,
			label: `Calcudoku ${n}x${n} ${difficulty[0].toUpperCase()}${difficulty.slice(1)}`,
			width: n,
			height: n,
			difficulty,
			mode: 'calc'
		}))
	)
];

/** A Calcudoku puzzle in the shape the Sudoku board plays: no givens, the cages. */
function generateCalcudoku(n: number, difficulty: Variant['difficulty'], seed: number) {
	const { puzzle } = generateCalc(n, difficulty, seed);
	return { width: n, height: n, givens: new Array(n * n).fill(0), cages: puzzle.cages };
}

/** Whether a full grid solves the puzzle: rows, columns and boxes or cages. */
function solves(p: SudokuPuzzle, grid: number[]): boolean {
	if (p.cages) return isSolvedCalc({ width: p.width, height: p.height, cages: p.cages }, grid);
	return isSolvedGrid(p.width, grid);
}

const isIntArray = (a: unknown, n: number, max: number): a is number[] =>
	Array.isArray(a) && a.length === n && a.every((x) => Number.isInteger(x) && x >= 0 && x <= max);

/** Notes are 9-bit masks: three 4-bit digits per cell. */
const NOTE_NIBBLES = 3;

function packNotes(notes: readonly number[]): string {
	return packDigits(notes.flatMap((m) => [m & 15, (m >> 4) & 15, m >> 8]));
}

function unpackNotes(text: string, n: number): number[] {
	const nibbles = unpackDigits(text, n * NOTE_NIBBLES);
	return Array.from({ length: n }, (_, i) => {
		const [a, b, c] = nibbles.slice(i * NOTE_NIBBLES, i * NOTE_NIBBLES + NOTE_NIBBLES);
		return a | (b << 4) | (c << 8);
	});
}

export const sudokuLogic: GameLogic<SudokuPuzzle, SudokuState> = {
	id: 'sudoku',
	variants: SUDOKU_VARIANTS,
	generate: (v, seed) =>
		v.mode === 'calc'
			? generateCalcudoku(v.width, v.difficulty, seed)
			: generateSudoku(v.width, v.difficulty, seed).puzzle,
	countSolutions(p, limit) {
		const res = p.cages
			? solveCalc(
					{ width: p.width, height: p.height, cages: p.cages },
					{ limit, maxNodes: 200_000 }
				)
			: solveSudoku(p.givens, p.width, { limit, maxNodes: 2_000_000 });
		return { count: res.solutions.length, finished: res.finished };
	},
	fitsDifficulty(p, v) {
		if (p.cages) {
			// Easy: cage arithmetic and line eliminations; hard needs hidden singles or pairs.
			const calc = { width: p.width, height: p.height, cages: p.cages };
			const basic = rateCalc(calc, CalcLevel.Basic).solved;
			if (v.difficulty === 'easy') return basic;
			return rateCalc(calc, CalcLevel.Advanced).solved && (v.difficulty === 'normal' || !basic);
		}
		// Easy and normal: singles only; hard: needs locked candidates or subsets, never guessing.
		const singles = ratePuzzle(p, Level.Singles).solved;
		return v.difficulty === 'hard' ? !singles && ratePuzzle(p, Level.Subsets).solved : singles;
	},
	isValidPuzzle(p: unknown, v): p is SudokuPuzzle {
		if (!p || typeof p !== 'object') return false;
		const q = p as SudokuPuzzle;
		const size = v.width;
		if (v.mode === 'calc') {
			return (
				v.height === size &&
				isIntArray(q.givens, size * size, 0) &&
				isValidCalcPuzzle({ width: q.width, height: q.height, cages: q.cages }, size)
			);
		}
		if (q.cages !== undefined) return false;
		if (!SIZES.includes(size) || q.width !== size || q.height !== size || v.height !== size) {
			return false;
		}
		if (!isIntArray(q.givens, size * size, size)) return false;
		return q.givens.some(Boolean) && !conflicts(size, q.givens).some(Boolean);
	},
	emptyState: emptySudokuState,
	afterMove(p, s, settings: Settings) {
		if (settings.autoNotes) s = fillMissingNotes(p, s);
		return settings.autoRemoveNotes ? pruneNotes(p, s) : s;
	},
	isSolved: (p, s) => solves(p, currentGrid(p, s)),
	/** One digit per cell, givens included. */
	answer: (p, s) => currentGrid(p, s).join(''),
	verifyAnswer(p, answer) {
		const n = p.givens.length;
		if (answer.length !== n || !/^[1-9]+$/.test(answer)) return false;
		const grid = [...answer].map(Number);
		return p.givens.every((g, i) => !g || g === grid[i]) && solves(p, grid);
	},
	encodeState: (s) => `${packDigits(s.values)}.${packNotes(s.notes)}`,
	decodeState(p, text) {
		try {
			const parts = text.split('.');
			if (parts.length !== 2) return null;
			const n = p.givens.length;
			const s = { values: unpackDigits(parts[0], n), notes: unpackNotes(parts[1], n) };
			return this.isValidState(p, s) ? s : null;
		} catch {
			return null;
		}
	},
	isValidState(p, s: unknown): s is SudokuState {
		if (!s || typeof s !== 'object') return false;
		const t = s as SudokuState;
		const n = p.givens.length;
		return (
			isIntArray(t.values, n, p.width) &&
			isIntArray(t.notes, n, allMask(p.width)) &&
			t.values.every((d, i) => !d || !p.givens[i])
		);
	}
};
