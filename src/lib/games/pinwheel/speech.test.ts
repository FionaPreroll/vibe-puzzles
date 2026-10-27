import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n/index.svelte';
import {
	analyze,
	CROSS,
	emptyPinwheelState,
	hIndex,
	LINE,
	vIndex,
	type PinwheelPuzzle,
	type PinwheelState
} from './rules';
import { sayDot } from './speech';

afterEach(() => {
	i18n.locale = 'en';
});

/** A state with marks on edges given as `h:i:j` / `v:i:j` keys. */
function marked(p: PinwheelPuzzle, marks: Record<string, number>): PinwheelState {
	const s = emptyPinwheelState(p);
	for (const [key, mark] of Object.entries(marks)) {
		const [kind, i, j] = key.split(':');
		if (kind === 'h') s.h[hIndex(p, Number(i), Number(j))] = mark;
		else s.v[vIndex(p, Number(i), Number(j))] = mark;
	}
	return s;
}

const say = (p: PinwheelPuzzle, s: PinwheelState, i: number, j: number, blackHoles = true) =>
	sayDot(p, s, analyze(p, s), { i, j }, { errors: true, blackHoles });

describe('sayDot', () => {
	// 2×2 cells: circles in the top left cell, on the edge right of the middle dot (between the
	// two right cells), and in the bottom left cell.
	const puzzle: PinwheelPuzzle = {
		width: 2,
		height: 2,
		centres: [
			[0, 0],
			[1, 2],
			[2, 0]
		]
	};
	// The top left cell closed off: its region is done.
	const closed = marked(puzzle, { 'v:0:1': LINE, 'h:1:0': LINE, 'v:1:1': CROSS });

	it('says the lines and crosses at the dot, and the circles on it and around it', () => {
		expect(say(puzzle, closed, 1, 1)).toBe(
			'Dot in row 2, column 2. Lines: up, left. Crosses: down. Circles: up left (complete), right, down left'
		);
		expect(say(puzzle, closed, 1, 1, false)).toBe(
			'Dot in row 2, column 2. Lines: up, left. Crosses: down. Circles: up left, right, down left'
		);
		const locked = { ...closed, locks: [1, 0, 0] };
		expect(say(puzzle, locked, 1, 1)).toContain('Circles: up left (locked), right');
		// In reading order, whatever order the puzzle lists them in.
		const two: PinwheelPuzzle = {
			width: 2,
			height: 2,
			centres: [
				[0, 2],
				[0, 0]
			]
		};
		expect(say(two, emptyPinwheelState(two), 1, 1)).toBe(
			'Dot in row 2, column 2. Circles: up left, up right'
		);
	});

	it('names the border of the board, which counts as a line', () => {
		expect(say(puzzle, closed, 0, 0)).toBe(
			'Dot in row 1, column 1. Border: right, down. Circles: down right (complete)'
		);
		expect(say(puzzle, closed, 0, 1)).toBe(
			'Dot in row 1, column 2. Lines: down. Border: right, left. Circles: down left (complete)'
		);
	});

	it('says which circle is red: its region is closed but not symmetric', () => {
		const one: PinwheelPuzzle = { width: 2, height: 2, centres: [[0, 0]] };
		const s = emptyPinwheelState(one);
		expect(say(one, s, 1, 1)).toBe('Dot in row 2, column 2. Circles: up left (error)');
		expect(say(one, s, 2, 2)).toBe('Dot in row 3, column 3. Border: up, left');
	});

	it('speaks German', () => {
		i18n.locale = 'de';
		expect(say(puzzle, { ...closed, locks: [1, 0, 0] }, 0, 1)).toBe(
			'Punkt in Zeile 1, Spalte 2. Linien: unten. Rand: rechts, links. Kreise: unten links (gesperrt)'
		);
	});
});
