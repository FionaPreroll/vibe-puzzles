import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n/index.svelte';
import {
	analyze,
	CROSS,
	EMPTY,
	FILLED,
	puzzleOf,
	type PixelsPuzzle,
	type PixelsState
} from './rules';
import { sayCell } from './speech';

afterEach(() => {
	i18n.locale = 'en';
});

describe('sayCell', () => {
	/** Rows 3 1 and 0; columns 1, 1, 1, 0 and 1. */
	const p: PixelsPuzzle = puzzleOf(5, 2, [1, 1, 1, 0, 1, 0, 0, 0, 0, 0]);
	const say = (s: PixelsState, cell: number, errors = true, dimDone = true) =>
		sayCell(p, s, analyze(p, s), cell, { errors, dimDone });
	const blank = { cells: new Array(10).fill(EMPTY) };

	it('says where a cell is, its mark and the numbers of its row and column', () => {
		expect(say(blank, 0)).toBe('Row 1, column 1: empty. Row: 3 1. Column: 1');
		expect(say(blank, 8)).toBe('Row 2, column 4: empty. Row: 0. Column: 0');
		const s = { cells: [FILLED, CROSS, ...new Array(8).fill(EMPTY)] };
		// The row has no room left for its 3; the column's 1 is in place.
		expect(say(s, 0)).toBe('Row 1, column 1: filled. Row: 3 1 (error). Column: 1 (complete)');
		expect(say(s, 1)).toBe('Row 1, column 2: crossed out. Row: 3 1 (error). Column: 1');
	});

	it('says what is red or grey, as the board shows it', () => {
		const s = { cells: [FILLED, FILLED, FILLED, CROSS, FILLED, ...new Array(5).fill(EMPTY)] };
		expect(say(s, 0)).toBe('Row 1, column 1: filled. Row: 3 1 (complete). Column: 1 (complete)');
		expect(say(s, 0, true, false)).toBe('Row 1, column 1: filled. Row: 3 1. Column: 1');
		// A line without blocks is never greyed out; one that breaks is red only where errors show.
		expect(say(s, 5)).toBe('Row 2, column 1: empty. Row: 0. Column: 1 (complete)');
		const wrong = { cells: [...s.cells.slice(0, 5), FILLED, ...new Array(4).fill(EMPTY)] };
		expect(say(wrong, 5)).toBe('Row 2, column 1: filled. Row: 0 (error). Column: 1 (error)');
		expect(say(wrong, 5, false)).toBe('Row 2, column 1: filled. Row: 0. Column: 1');
	});

	it('speaks the language of the page', () => {
		i18n.locale = 'de';
		const s = { cells: [EMPTY, EMPTY, EMPTY, CROSS, ...new Array(6).fill(EMPTY)] };
		expect(say(s, 3)).toBe('Zeile 1, Spalte 4: durchgestrichen. Zeile: 3 1. Spalte: 0');
	});
});
