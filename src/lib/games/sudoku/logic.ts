import { packDigits, unpackDigits } from '../../core/grid';
import type { GameLogic, Settings } from '../../core/types';
import type { Variant } from '../../core/variants';
import { generateSudoku } from './generator';
import {
	allMask,
	conflicts,
	currentGrid,
	emptySudokuState,
	isSolvedGrid,
	pruneNotes,
	SIZES,
	type SudokuPuzzle,
	type SudokuState
} from './rules';
import { solveSudoku } from './solver';

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
	}
];

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
	generate: (v, seed) => generateSudoku(v.width, v.difficulty, seed).puzzle,
	countSolutions(p, limit) {
		const res = solveSudoku(p.givens, p.width, { limit, maxNodes: 2_000_000 });
		return { count: res.solutions.length, finished: res.finished };
	},
	isValidPuzzle(p: unknown, v): p is SudokuPuzzle {
		if (!p || typeof p !== 'object') return false;
		const q = p as SudokuPuzzle;
		const size = v.width;
		if (!SIZES.includes(size) || q.width !== size || q.height !== size || v.height !== size) {
			return false;
		}
		if (!isIntArray(q.givens, size * size, size)) return false;
		return q.givens.some(Boolean) && !conflicts(size, q.givens).some(Boolean);
	},
	emptyState: emptySudokuState,
	afterMove: (p, s, settings: Settings) => (settings.autoRemoveNotes ? pruneNotes(p, s) : s),
	isSolved: (p, s) => isSolvedGrid(p.width, currentGrid(p, s)),
	/** One digit per cell, givens included. */
	answer: (p, s) => currentGrid(p, s).join(''),
	verifyAnswer(p, answer) {
		const n = p.givens.length;
		if (answer.length !== n || !/^[1-9]+$/.test(answer)) return false;
		const grid = [...answer].map(Number);
		return p.givens.every((g, i) => !g || g === grid[i]) && isSolvedGrid(p.width, grid);
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
