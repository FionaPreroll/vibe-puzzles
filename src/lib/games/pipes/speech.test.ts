import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n/index.svelte';
import { analyze, DOWN, LEFT, RIGHT, UP, type PipesPuzzle, type PipesState } from './rules';
import { sayTile } from './speech';

afterEach(() => {
	i18n.locale = 'en';
});

describe('sayTile', () => {
	// 3×3: a corner at the top left, a straight down through the source, and so on.
	// prettier-ignore
	const tiles = [
		RIGHT | DOWN, RIGHT | DOWN | LEFT, DOWN | LEFT,
		UP, UP | DOWN, UP,
		RIGHT, UP | RIGHT | LEFT, LEFT
	];
	const puzzle: PipesPuzzle = {
		width: 3,
		height: 3,
		wrap: false,
		tiles: tiles.map((t) => t.toString(16)).join('')
	};

	const say = (s: PipesState, cell: number, errors = true, water = true) =>
		sayTile(puzzle, s, analyze(puzzle, s.tiles, s.locks), cell, { errors, water });

	it('says the kind of the tile, where it opens, and what holds there', () => {
		const s: PipesState = { tiles, locks: [1, 0, 0, 0, 0, 0, 0, 0, 0] };
		expect(say(s, 0)).toBe('Row 1, column 1: corner, open right, down (water, locked)');
		expect(say(s, 4)).toBe('Row 2, column 2: straight, open up, down (source, water)');
		expect(say(s, 7)).toBe('Row 3, column 2: T piece, open up, right, left (water)');
		expect(say(s, 8, true, false)).toBe('Row 3, column 3: end, open left');
	});

	it('says what is red', () => {
		const s: PipesState = {
			tiles: tiles.map((t, c) => (c === 6 ? DOWN : t)),
			locks: tiles.map(() => 0)
		};
		expect(say(s, 6)).toBe('Row 3, column 1: end, open down (error)');
		expect(say(s, 6, false)).toBe('Row 3, column 1: end, open down');
	});

	it('speaks German', () => {
		i18n.locale = 'de';
		const s: PipesState = { tiles, locks: [1, 0, 0, 0, 0, 0, 0, 0, 0] };
		expect(say(s, 0)).toBe('Zeile 1, Spalte 1: Ecke, offen nach rechts, unten (Wasser, gesperrt)');
		expect(say(s, 4)).toBe('Zeile 2, Spalte 2: Gerade, offen nach oben, unten (Quelle, Wasser)');
	});
});
