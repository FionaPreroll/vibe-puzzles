import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../i18n/index.svelte';
import {
	cellPlace,
	cellsAt,
	direction,
	dotPlace,
	edgesAt,
	listOf,
	sentences,
	withStates
} from './speech';

afterEach(() => {
	i18n.locale = 'en';
});

describe('speech', () => {
	it('names cells and dots counted from 1, in the current language', () => {
		expect(cellPlace(2, 3)).toBe('Row 3, column 4');
		expect(dotPlace({ i: 0, j: 5 })).toBe('Dot in row 1, column 6');
		expect(direction('downLeft')).toBe('down left');
		i18n.locale = 'de';
		expect(cellPlace(2, 3)).toBe('Zeile 3, Spalte 4');
		expect(dotPlace({ i: 0, j: 5 })).toBe('Punkt in Zeile 1, Spalte 6');
		expect(direction('downLeft')).toBe('unten links');
	});

	it('puts states in brackets, lists after a label, and leaves out what is not there', () => {
		expect(withStates('5', ['given', false, 'error'])).toBe('5 (given, error)');
		expect(withStates('5', [false])).toBe('5');
		expect(listOf('speech.lines', ['up', 'left'])).toBe('Lines: up, left');
		expect(listOf('speech.lines', [])).toBeNull();
		expect(sentences(['Dot in row 1, column 1', null, 'Crosses: up'])).toBe(
			'Dot in row 1, column 1. Crosses: up'
		);
	});

	it('finds the edges at a dot clockwise from the top, and the cells around it', () => {
		// A board 3 cells wide and 2 high: dots 0–2 down, 0–3 across.
		expect(edgesAt({ i: 1, j: 1 }, 3, 2)).toEqual([
			{ dir: 'up', edge: { kind: 'v', i: 0, j: 1 } },
			{ dir: 'right', edge: { kind: 'h', i: 1, j: 1 } },
			{ dir: 'down', edge: { kind: 'v', i: 1, j: 1 } },
			{ dir: 'left', edge: { kind: 'h', i: 1, j: 0 } }
		]);
		expect(edgesAt({ i: 0, j: 0 }, 3, 2).map((e) => e.dir)).toEqual(['right', 'down']);
		expect(edgesAt({ i: 2, j: 3 }, 3, 2).map((e) => e.dir)).toEqual(['up', 'left']);

		expect(cellsAt({ i: 1, j: 1 }, 3, 2)).toEqual([
			{ dir: 'upLeft', cell: 0 },
			{ dir: 'upRight', cell: 1 },
			{ dir: 'downLeft', cell: 3 },
			{ dir: 'downRight', cell: 4 }
		]);
		expect(cellsAt({ i: 0, j: 0 }, 3, 2)).toEqual([{ dir: 'downRight', cell: 0 }]);
		expect(cellsAt({ i: 2, j: 3 }, 3, 2)).toEqual([{ dir: 'upLeft', cell: 5 }]);
	});
});
