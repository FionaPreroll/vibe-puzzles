import { describe, expect, it } from 'vitest';
import { Clock } from './clock.svelte';

describe('clock', () => {
	it('counts personal time only while it may run', () => {
		let may = false;
		const c = new Clock(() => may);
		c.reset(1000);
		c.resume(1000);
		expect(c.runningSince).toBeNull();
		may = true;
		c.resume(2000);
		c.resume(2500); // already running: no restart
		expect(c.played(3000)).toBe(1000);
		c.pause(3000);
		c.pause(9000);
		expect(c.played(9000)).toBe(1000);
		expect(c.playMs).toBe(1000);
	});

	it('keeps the final times when finished', () => {
		const c = new Clock(() => true);
		c.reset(1000, 400);
		c.resume(2000);
		c.finish(5000);
		expect(c).toMatchObject({ finalMs: 4000, finalPlayMs: 3400, runningSince: null });
		// Solved elsewhere: the time of that save, and the play time it holds.
		c.reset(1000, 700);
		c.finished(500);
		expect(c).toMatchObject({ finalMs: 0, finalPlayMs: 700 });
	});

	it('starts each game standing, without a pause from the last one', () => {
		const c = new Clock(() => true);
		c.resume(0);
		c.manualPause = true;
		c.reset(50, 10);
		expect(c).toMatchObject({ startedAt: 50, playMs: 10, runningSince: null, manualPause: false });
	});
});
