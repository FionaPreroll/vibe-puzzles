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

/**
 * Removes givens in point-symmetric pairs, in random order, as long as the puzzle stays solvable
 * by logic up to `maxLevel` (which also keeps the solution unique).
 */
function dig(solution: number[], size: number, maxLevel: Level, rng: Rng): SudokuPuzzle {
	const n = size * size;
	const puzzle: SudokuPuzzle = { width: size, height: size, givens: solution.slice() };
	const order = rng.shuffle([...Array(Math.ceil(n / 2)).keys()]);
	for (const i of order) {
		const pair = [i, n - 1 - i];
		const kept = pair.map((j) => puzzle.givens[j]);
		for (const j of pair) puzzle.givens[j] = 0;
		if (!ratePuzzle(puzzle, maxLevel).solved) pair.forEach((j, k) => (puzzle.givens[j] = kept[k]));
	}
	return puzzle;
}

const givenCount = (p: SudokuPuzzle) => p.givens.filter(Boolean).length;

/**
 * Normal puzzles need only singles; hard ones also need locked candidates or subsets. Both can be
 * solved without guessing. Deterministic per seed.
 */
export function generateSudoku(
	size: number,
	difficulty: Difficulty,
	seed: number
): GeneratedSudoku {
	const rng = new Rng(seed);
	const fill = () =>
		solveSudoku(new Array(size * size).fill(0), size, { limit: 1, rng }).solutions[0];
	if (difficulty === 'normal') {
		const solution = fill();
		return { puzzle: dig(solution, size, Level.Singles, rng), solution };
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
