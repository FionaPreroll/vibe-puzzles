import { describe, expect, it } from 'vitest';
import { CROSS, EMPTY, MARK, nextMark } from './marks';

describe('nextMark', () => {
	it.each([
		// Tool, mark now, after a click, after a right click.
		['black', EMPTY, MARK, CROSS],
		['black', MARK, EMPTY, CROSS],
		['black', CROSS, MARK, EMPTY],
		['cross', EMPTY, CROSS, MARK],
		['cross', MARK, CROSS, EMPTY],
		['cross', CROSS, EMPTY, MARK],
		['rotate', EMPTY, MARK, CROSS],
		['rotate', MARK, CROSS, EMPTY],
		['rotate', CROSS, EMPTY, MARK],
		['blank', MARK, EMPTY, EMPTY],
		['blank', CROSS, EMPTY, EMPTY]
	])('%s on %i leaves %i, with the right button %i', (tool, current, click, right) => {
		expect(nextMark(tool, current, false)).toBe(click);
		expect(nextMark(tool, current, true)).toBe(right);
	});
});
