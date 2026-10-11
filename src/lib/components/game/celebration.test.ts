import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CELEBRATION_MS, CelebrationTimer } from './celebration.svelte';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the celebration', () => {
	it('runs for a while when the puzzle gets solved', () => {
		const c = new CelebrationTimer();
		expect(c.follow(false, false, true)).toBeUndefined();
		const stop = c.follow(true, false, true);
		expect(c.on).toBe(true);
		vi.advanceTimersByTime(CELEBRATION_MS);
		expect(c.on).toBe(false);
		stop!();
		// Still solved: no second celebration.
		expect(c.follow(true, false, true)).toBeUndefined();
		expect(c.on).toBe(false);
	});

	it('ends when the solved state ends', () => {
		const c = new CelebrationTimer();
		c.follow(false, false, true);
		const stop = c.follow(true, false, true)!;
		stop();
		expect(c.on).toBe(false);
		c.follow(false, false, true);
		vi.advanceTimersByTime(CELEBRATION_MS);
		expect(c.on).toBe(false);
	});

	it('skips a puzzle opened solved, and when turned off', () => {
		const opened = new CelebrationTimer();
		opened.follow(true, true, true);
		opened.follow(true, false, true);
		expect(opened.on).toBe(false);
		const off = new CelebrationTimer();
		off.follow(true, false, false);
		expect(off.on).toBe(false);
	});
});
