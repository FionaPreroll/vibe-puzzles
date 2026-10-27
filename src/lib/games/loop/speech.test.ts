import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n/index.svelte';
import { analyze, CROSS, emptyLoopState, hIndex, LINE, vIndex, type LoopPuzzle } from './rules';
import { sayDot } from './speech';

afterEach(() => {
	i18n.locale = 'en';
});

describe('sayDot', () => {
	// 2×2 cells: a 3 at the top left, a 1 at the bottom left.
	const puzzle: LoopPuzzle = { width: 2, height: 2, clues: '3.1.' };

	/** A state with lines and crosses on edges given as `h:i:j` / `v:i:j` keys. */
	function state(lines: string[], crosses: string[] = []) {
		const s = emptyLoopState(puzzle);
		for (const [keys, mark] of [
			[lines, LINE],
			[crosses, CROSS]
		] as const) {
			for (const key of keys) {
				const [kind, i, j] = key.split(':');
				if (kind === 'h') s.h[hIndex(puzzle, Number(i), Number(j))] = mark;
				else s.v[vIndex(puzzle, Number(i), Number(j))] = mark;
			}
		}
		return s;
	}

	const say = (s: ReturnType<typeof state>, i: number, j: number, errors = true) =>
		sayDot(puzzle, s, analyze(puzzle, s), { i, j }, { errors, dimSatisfied: true });

	it('says the lines and crosses at the dot, and the numbers around it', () => {
		const s = state(['v:0:1', 'h:1:0'], ['h:1:1']);
		expect(say(s, 1, 1)).toBe(
			'Dot in row 2, column 2. Lines: up, left. Crosses: right. Numbers: 3 up left, 1 down left (complete)'
		);
		expect(say(s, 0, 0)).toBe('Dot in row 1, column 1. Numbers: 3 down right');
		expect(say(s, 2, 2)).toBe('Dot in row 3, column 3');
	});

	it('says what is red: a dot where the line branches, numbers with too many lines', () => {
		// A box around the 3, with a branch down from its bottom right corner.
		const s = state(['h:0:0', 'v:0:0', 'v:0:1', 'h:1:0', 'v:1:1']);
		expect(say(s, 1, 1)).toBe(
			'Dot in row 2, column 2 (error). Lines: up, down, left. Numbers: 3 up left (error), 1 down left (error)'
		);
		expect(say(s, 1, 1, false)).toBe(
			'Dot in row 2, column 2. Lines: up, down, left. Numbers: 3 up left, 1 down left'
		);
	});

	it('speaks German', () => {
		i18n.locale = 'de';
		expect(say(state(['v:0:1', 'h:1:0'], ['h:1:1']), 1, 1)).toBe(
			'Punkt in Zeile 2, Spalte 2. Linien: oben, links. Kreuze: rechts. Zahlen: 3 oben links, 1 unten links (fertig)'
		);
	});
});
