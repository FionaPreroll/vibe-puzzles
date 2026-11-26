import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n/index.svelte';
import { analyze, CROSS, type BridgesPuzzle, type BridgesState } from './rules';
import { sayCell } from './speech';

afterEach(() => {
	i18n.locale = 'en';
});

describe('sayCell', () => {
	/** Four 2s in the corners: links 0 top, 1 left, 2 right, 3 bottom (see bridges.test.ts). */
	const ring: BridgesPuzzle = { width: 3, height: 3, islands: '2.2...2.2' };
	/** Two links that cross in the middle: 0 down, 1 across. */
	const plus: BridgesPuzzle = { width: 3, height: 3, islands: '.1.1.1.1.' };

	const say = (p: BridgesPuzzle, s: BridgesState, cell: number, errors = true, dim = true) =>
		sayCell(p, s, analyze(p, s), cell, { errors, dimSatisfied: dim });

	it('says an island’s number, its bridges and crosses by side', () => {
		const s = { links: [1, CROSS, 0, 0] };
		expect(say(ring, s, 0, false)).toBe(
			'Row 1, column 1: island 2. Bridges: 1 right. Crossed out: down'
		);
		expect(say(ring, s, 8)).toBe('Row 3, column 3: island 2');
	});

	it('says what is red or grey, as the board shows it', () => {
		// Two double bridges close off two pairs.
		const s = { links: [2, 0, 0, 2] };
		expect(say(ring, s, 0)).toBe('Row 1, column 1: island 2 (error). Bridges: 2 right');
		expect(say(ring, s, 0, false)).toBe('Row 1, column 1: island 2 (complete). Bridges: 2 right');
		expect(say(ring, s, 0, false, false)).toBe('Row 1, column 1: island 2. Bridges: 2 right');
	});

	it('says the bridges over the water', () => {
		const s = { links: [2, CROSS, 1, 0] };
		expect(say(ring, s, 1)).toBe('Row 1, column 2: a double bridge across');
		expect(say(ring, s, 3)).toBe('Row 2, column 1: crossed out up and down');
		expect(say(ring, s, 5)).toBe('Row 2, column 3: a bridge up and down');
		expect(say(ring, s, 7)).toBe('Row 3, column 2: water');
		expect(say(ring, s, 4)).toBe('Row 2, column 2: water');
		expect(say(plus, { links: [1, CROSS] }, 4)).toBe(
			'Row 2, column 2: crossed out across, a bridge up and down'
		);
	});

	it('speaks the language of the page', () => {
		i18n.locale = 'de';
		expect(say(ring, { links: [2, 0, 0, 0] }, 1)).toBe(
			'Zeile 1, Spalte 2: eine Doppelbrücke waagerecht'
		);
	});
});
