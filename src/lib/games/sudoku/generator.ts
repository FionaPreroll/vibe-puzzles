import { Rng } from '../../core/rng';
import type { Difficulty } from '../../core/variants';
import type { SudokuPuzzle } from './rules';
import { Level, ratePuzzle, solveSudoku } from './solver';

export interface GeneratedSudoku {
	puzzle: SudokuPuzzle;
	/** The unique solution, row by row. */
	solution: number[];
}

/** Attempts at a hard puzzle before settling for the hardest one found. */
const HARD_ATTEMPTS = 30;
/** Easy puzzles keep this many givens, so there are always several obvious next steps. */
export const EASY_GIVENS = 36;

/**
 * Removes givens in point-symmetric pairs, in random order, as long as the puzzle stays solvable
 * by logic up to `maxLevel` (which also keeps the solution unique), down to `minGivens`.
 */
function dig(
	solution: number[],
	size: number,
	maxLevel: Level,
	rng: Rng,
	minGivens = 0
): SudokuPuzzle {
	const n = size * size;
	const puzzle: SudokuPuzzle = { width: size, height: size, givens: solution.slice() };
	const order = rng.shuffle([...Array(Math.ceil(n / 2)).keys()]);
	let left = n;
	for (const i of order) {
		const pair = [i, n - 1 - i];
		const removed = i === n - 1 - i ? 1 : 2;
		if (left - removed < minGivens) continue;
		const kept = pair.map((j) => puzzle.givens[j]);
		for (const j of pair) puzzle.givens[j] = 0;
		if (ratePuzzle(puzzle, maxLevel).solved) left -= removed;
		else pair.forEach((j, k) => (puzzle.givens[j] = kept[k]));
	}
	return puzzle;
}

const givenCount = (p: SudokuPuzzle) => p.givens.filter(Boolean).length;

/**
 * Easy puzzles need only singles and keep many givens; normal ones need only singles too but have
 * as few givens as that allows; hard ones also need locked candidates or subsets. None needs
 * guessing. Deterministic per seed. Easy sizes below 9 keep a proportional share of givens.
 */
export function generateSudoku(
	size: number,
	difficulty: Difficulty,
	seed: number
): GeneratedSudoku {
	const rng = new Rng(seed);
	const fill = () =>
		solveSudoku(new Array(size * size).fill(0), size, { limit: 1, rng }).solutions[0];
	if (difficulty !== 'hard') {
		const solution = fill();
		const min = difficulty === 'easy' ? Math.round((EASY_GIVENS * size * size) / 81) : 0;
		return { puzzle: dig(solution, size, Level.Singles, rng, min), solution };
	}
	let best: GeneratedSudoku | null = null;
	let bestScore = -Infinity;
	for (let attempt = 0; attempt < HARD_ATTEMPTS; attempt++) {
		const solution = fill();
		const puzzle = dig(solution, size, Level.Subsets, rng);
		const hard = ratePuzzle(puzzle, Level.Singles).solved ? 0 : 1;
		const score = hard * 1000 - givenCount(puzzle);
		if (score > bestScore) {
			best = { puzzle, solution };
			bestScore = score;
		}
		if (hard) break;
	}
	return best!;
}
