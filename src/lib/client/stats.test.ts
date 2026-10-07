import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { breakStreak, currentPeriodStreak, getStats, previousPeriod, recordSolve } from './stats';
import { keys, load, remove, save, setQuotaHandler } from './storage';

/** In-memory Storage; `full` makes every write fail like a full quota. */
class MemoryStorage implements Storage {
	private map = new Map<string, string>();
	full = false;
	get length() {
		return this.map.size;
	}
	key(i: number) {
		return [...this.map.keys()][i] ?? null;
	}
	getItem(k: string) {
		return this.map.get(k) ?? null;
	}
	setItem(k: string, v: string) {
		if (this.full) throw new DOMException('Storage is full', 'QuotaExceededError');
		this.map.set(k, v);
	}
	removeItem(k: string) {
		this.map.delete(k);
	}
	clear() {
		this.map.clear();
	}
}

let storage: MemoryStorage;

beforeEach(() => {
	storage = new MemoryStorage();
	vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('storage', () => {
	it('saves, loads, lists and removes prefixed JSON values', () => {
		expect(save('a:1', { x: 1 })).toBe(true);
		save('a:2', [2]);
		save('b:1', 'b');
		expect(storage.getItem('vp:a:1')).toBe('{"x":1}');
		expect(load('a:1', null)).toEqual({ x: 1 });
		expect(keys('a:').sort()).toEqual(['a:1', 'a:2']);
		expect(keys()).toHaveLength(3);
		remove('a:1');
		expect(load('a:1', 'gone')).toBe('gone');
	});

	it('falls back on missing or corrupt values', () => {
		expect(load('missing', 5)).toBe(5);
		storage.setItem('vp:bad', '{not json');
		expect(load('bad', 'fallback')).toBe('fallback');
	});

	it('reports a full storage once per failed write', () => {
		const onQuota = vi.fn();
		setQuotaHandler(onQuota);
		storage.full = true;
		expect(save('x', 1)).toBe(false);
		expect(onQuota).toHaveBeenCalledTimes(1);
	});

	it('works without localStorage at all', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(save('x', 1)).toBe(false);
		expect(load('x', 'none')).toBe('none');
		expect(keys()).toEqual([]);
		expect(() => remove('x')).not.toThrow();
	});
});

describe('stats', () => {
	it('starts empty', () => {
		expect(getStats('tetroid', '6n')).toEqual({
			solved: 0,
			streak: 0,
			bestStreak: 0,
			bestMs: null,
			totalMs: 0,
			recent: []
		});
	});

	it('records solves, best time and streaks', () => {
		recordSolve('tetroid', '6n', 1, 5000);
		recordSolve('tetroid', '6n', 2, 3000);
		const s = recordSolve('tetroid', '6n', 3, 4000);
		expect(s).toMatchObject({ solved: 3, streak: 3, bestStreak: 3, bestMs: 3000, totalMs: 12000 });
		expect(s.recent.map((r) => r.puzzleId)).toEqual([3, 2, 1]);
		expect(getStats('tetroid', '6n')).toEqual(s);
		expect(getStats('tetroid', '8n').solved).toBe(0);
	});

	it('keeps the best streak after a break', () => {
		recordSolve('pinwheel', '5n', 1, 1000);
		recordSolve('pinwheel', '5n', 2, 1000);
		breakStreak('pinwheel', '5n');
		recordSolve('pinwheel', '5n', 3, 1000);
		expect(getStats('pinwheel', '5n')).toMatchObject({ streak: 1, bestStreak: 2, solved: 3 });
	});

	it('does not write when there is no streak to break', () => {
		breakStreak('pinwheel', '5n');
		expect(storage.length).toBe(0);
	});

	it('keeps only the 20 most recent solves', () => {
		for (let k = 1; k <= 25; k++) recordSolve('tetroid', '6n', k, k);
		const { recent } = getStats('tetroid', '6n');
		expect(recent).toHaveLength(20);
		expect(recent[0].puzzleId).toBe(25);
		expect(recent.at(-1)!.puzzleId).toBe(6);
	});

	it('finds the previous period', () => {
		const now = new Date(Date.UTC(2026, 2, 1, 12));
		expect(previousPeriod('daily', now)).toBe('2026-02-28');
		expect(previousPeriod('weekly', now)).toBe('2026-W08');
		expect(previousPeriod('monthly', now)).toBe('2026-02');
		expect(previousPeriod('monthly', new Date(Date.UTC(2026, 0, 31)))).toBe('2025-12');
	});

	it('counts consecutive special periods and resets after a gap', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const solveOn = (day: number) => {
			vi.setSystemTime(Date.UTC(2026, 9, day, 12));
			const period = `2026-10-${String(day).padStart(2, '0')}`;
			return recordSolve('tetroid', 'daily', day, 1000, period, 'daily');
		};
		solveOn(5);
		solveOn(6);
		expect(solveOn(7).periodStreak).toBe(3);
		// Solving the same period again does not count twice.
		expect(solveOn(7).periodStreak).toBe(3);
		expect(currentPeriodStreak(getStats('tetroid', 'daily'), 'daily')).toBe(3);

		// Still alive the next day, gone the day after.
		vi.setSystemTime(Date.UTC(2026, 9, 8, 12));
		expect(currentPeriodStreak(getStats('tetroid', 'daily'), 'daily')).toBe(3);
		vi.setSystemTime(Date.UTC(2026, 9, 9, 12));
		expect(currentPeriodStreak(getStats('tetroid', 'daily'), 'daily')).toBe(0);

		expect(solveOn(9).periodStreak).toBe(1);
	});

	it('has no period streak without a solved period', () => {
		expect(currentPeriodStreak(getStats('tetroid', 'weekly'), 'weekly')).toBe(0);
	});
});
