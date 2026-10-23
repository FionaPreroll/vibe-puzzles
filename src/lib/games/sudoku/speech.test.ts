import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n/index.svelte';
import { bit, emptySudokuState, type SudokuPuzzle } from './rules';
import { sayCell } from './speech';

afterEach(() => {
	i18n.locale = 'en';
});

const none = { digit: false, cage: false };

describe('sayCell', () => {
	const puzzle: SudokuPuzzle = {
		width: 4,
		height: 4,
		givens: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
	};
	const state = emptySudokuState(puzzle);
	state.values[5] = 2;
	state.notes[6] = bit(1) | bit(4);

	it('says the digit, given or entered, the notes or that the cell is empty', () => {
		expect(sayCell(puzzle, state, 0, none)).toBe('Row 1, column 1: 3 (given)');
		expect(sayCell(puzzle, state, 5, none)).toBe('Row 2, column 2: 2');
		expect(sayCell(puzzle, state, 5, { digit: true, cage: false })).toBe(
			'Row 2, column 2: 2 (error)'
		);
		expect(sayCell(puzzle, state, 6, none)).toBe('Row 2, column 3: notes 1, 4');
		expect(sayCell(puzzle, state, 15, none)).toBe('Row 4, column 4: empty');
	});

	it('names the cage in Calcudoku', () => {
		const calc: SudokuPuzzle = {
			...puzzle,
			givens: new Array(16).fill(0),
			cages: [
				{ cells: [0, 1, 4], op: '+', target: 7 },
				{ cells: [2], op: '=', target: 3 }
			]
		};
		expect(sayCell(calc, state, 1, none)).toBe('Row 1, column 2: empty. Cage 7+, 3 cells');
		expect(sayCell(calc, state, 2, { digit: false, cage: true })).toBe(
			'Row 1, column 3: empty. Cage 3, one cell (error)'
		);
	});

	it('speaks German', () => {
		i18n.locale = 'de';
		expect(sayCell(puzzle, state, 0, none)).toBe('Zeile 1, Spalte 1: 3 (vorgegeben)');
		expect(sayCell(puzzle, state, 6, none)).toBe('Zeile 2, Spalte 3: Notizen 1, 4');
		expect(sayCell(puzzle, state, 15, none)).toBe('Zeile 4, Spalte 4: leer');
	});
});
