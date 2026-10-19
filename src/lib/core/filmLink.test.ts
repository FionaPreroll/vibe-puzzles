import { describe, expect, it } from 'vitest';
import { FILM_GAMES, insideQuery, puzzleCheck } from './filmLink';
import type { Variant } from './variants';

const variant: Variant = {
	key: '7n',
	label: '7x7 Normal',
	width: 7,
	height: 7,
	difficulty: 'normal'
};

describe('the link to the Inside page', () => {
	it('checks a puzzle whatever the order of its keys', () => {
		const a = { width: 2, height: 1, clues: '3.', extra: undefined };
		expect(puzzleCheck(a)).toBe(puzzleCheck({ clues: '3.', height: 1, width: 2 }));
		expect(puzzleCheck(a)).not.toBe(puzzleCheck({ ...a, clues: '2.' }));
		expect(puzzleCheck({ regions: [[1, 2]] })).not.toBe(puzzleCheck({ regions: [[2, 1]] }));
	});

	it('names the game, the puzzle and its check, for games with a film', () => {
		const puzzle = { width: 7, height: 7, clues: '.'.repeat(49) };
		expect(insideQuery('loop', variant, 1234, puzzle)).toBe(
			`game=loop&id=1234&p=${puzzleCheck(puzzle)}`
		);
		// Calcudoku is a mode of Sudoku, without a film.
		expect(insideQuery('sudoku', { ...variant, mode: 'calc' }, 1234, puzzle)).toBeNull();
		expect(insideQuery('chess', variant, 1234, puzzle)).toBeNull();
		expect(FILM_GAMES).toEqual(['sudoku', 'pinwheel', 'tetroid', 'loop']);
	});
});
