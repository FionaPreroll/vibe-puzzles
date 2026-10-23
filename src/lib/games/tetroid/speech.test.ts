import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n/index.svelte';
import { analyze, CROSS, EMPTY, SHADED, type TetroidPuzzle } from './rules';
import { sayCell } from './speech';

afterEach(() => {
	i18n.locale = 'en';
});

describe('sayCell', () => {
	// Two regions of a row each; the one numbered 1 comes first in reading order.
	const puzzle: TetroidPuzzle = { width: 4, height: 2, regions: [1, 1, 1, 1, 0, 0, 0, 0] };
	const say = (marks: number[], cell: number, errors = true, shapes = true) =>
		sayCell(puzzle, marks, analyze(puzzle, marks), cell, { errors, shapes });
	const S = SHADED;
	const top = [S, S, S, S, CROSS, EMPTY, EMPTY, EMPTY];

	it('says the region, counted in reading order, and the mark', () => {
		expect(say(top, 4)).toBe('Row 2, column 1, region 2: cross');
		expect(say(top, 5)).toBe('Row 2, column 2, region 2: empty');
	});

	it('names a finished tetromino where the board colours it', () => {
		expect(say(top, 2)).toBe('Row 1, column 3, region 1: shaded (I tetromino)');
		expect(say(top, 2, true, false)).toBe('Row 1, column 3, region 1: shaded');
	});

	it('says what is red, which then shows no tetromino colour', () => {
		// Two I tetrominoes side by side.
		const both = [S, S, S, S, S, S, S, S];
		expect(say(both, 0)).toBe('Row 1, column 1, region 1: shaded (error)');
		expect(say(both, 0, false)).toBe('Row 1, column 1, region 1: shaded (I tetromino)');
	});

	it('speaks German', () => {
		i18n.locale = 'de';
		expect(say(top, 0)).toBe('Zeile 1, Spalte 1, Bereich 1: schattiert (I-Tetromino)');
		expect(say(top, 4)).toBe('Zeile 2, Spalte 1, Bereich 2: Kreuz');
	});
});
