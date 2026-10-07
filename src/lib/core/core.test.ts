import { describe, expect, it } from 'vitest';
import { columnLabel, neighbours, packDigits, unpackDigits } from './grid';
import { hashString, Rng } from './rng';
import { COMMON_SETTINGS, withCommon } from './settings';
import { formatDuration } from './time';
import {
	decodePuzzleId,
	encodePuzzleId,
	periodKey,
	randomSeed,
	specialSeed,
	SPECIAL_RETENTION_DAYS
} from './variants';

describe('grid', () => {
	it('lists orthogonal neighbours inside the grid only', () => {
		// 3x2 grid: 0 1 2 / 3 4 5
		expect(neighbours(0, 3, 2).sort()).toEqual([1, 3]);
		expect(neighbours(4, 3, 2).sort()).toEqual([1, 3, 5]);
		expect(neighbours(5, 3, 2).sort()).toEqual([2, 4]);
		expect(neighbours(0, 1, 1)).toEqual([]);
	});

	it('labels columns like a spreadsheet', () => {
		expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLabel)).toEqual([
			'a',
			'b',
			'z',
			'aa',
			'ab',
			'az',
			'ba',
			'zz',
			'aaa'
		]);
	});

	it('round-trips packed digits, odd and even lengths', () => {
		for (const values of [[], [7], [0, 15, 3], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]]) {
			const text = packDigits(values);
			expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
			expect(unpackDigits(text, values.length)).toEqual(values);
		}
	});

	it('keeps only the low four bits when packing', () => {
		expect(unpackDigits(packDigits([16, 17, 31]), 3)).toEqual([0, 1, 15]);
	});

	it('pads missing digits with zeros when unpacking', () => {
		expect(unpackDigits(packDigits([5]), 4)).toEqual([5, 0, 0, 0]);
	});
});

describe('rng', () => {
	it('is deterministic per seed', () => {
		const a = new Rng(123);
		const b = new Rng(123);
		const seqA = Array.from({ length: 5 }, () => a.next());
		expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
		expect(new Rng(124).next()).not.toBe(seqA[0]);
	});

	it('treats seed 0 like a fixed non-zero seed', () => {
		expect(new Rng(0).next()).toBe(new Rng(0x9e3779b9).next());
	});

	it('keeps numbers in range', () => {
		const rng = new Rng(7);
		for (let k = 0; k < 1000; k++) {
			const x = rng.next();
			expect(x >= 0 && x < 1).toBe(true);
			const n = rng.int(6);
			expect(Number.isInteger(n) && n >= 0 && n < 6).toBe(true);
		}
	});

	it('picks existing items and shuffles into a permutation', () => {
		const rng = new Rng(99);
		const items = ['a', 'b', 'c', 'd', 'e'];
		expect(items).toContain(rng.pick(items));
		const shuffled = rng.shuffle([...items]);
		expect([...shuffled].sort()).toEqual(items);
	});

	it('hashes strings with FNV-1a', () => {
		expect(hashString('')).toBe(0x811c9dc5);
		expect(hashString('a')).toBe(0xe40c292c);
		expect(hashString('foobar')).toBe(0xbf9cf968);
	});
});

describe('settings', () => {
	it('appends game settings after the common ones', () => {
		const extra = [{ key: 'x', label: 'X', default: true }];
		const all = withCommon(extra);
		expect(all.slice(0, COMMON_SETTINGS.length)).toEqual(COMMON_SETTINGS);
		expect(all.at(-1)).toBe(extra[0]);
	});

	it('only depends on settings that exist', () => {
		const keys = new Set(COMMON_SETTINGS.map((s) => s.key));
		expect(keys.size).toBe(COMMON_SETTINGS.length);
		for (const s of COMMON_SETTINGS) if (s.requires) expect(keys).toContain(s.requires.key);
	});
});

describe('formatDuration', () => {
	it.each([
		[-5000, '00:00'],
		[999, '00:00'],
		[61_000, '01:01'],
		[3_600_000, '1:00:00'],
		[3_723_000, '1:02:03'],
		[86_400_000 + 5_000, '1d 00:00:05'],
		[2 * 86_400_000 + 23 * 3_600_000, '2d 23:00:00']
	])('formats %i ms as %s', (ms, text) => {
		expect(formatDuration(ms)).toBe(text);
	});
});

describe('variants', () => {
	it('round-trips puzzle IDs', () => {
		for (const [variantIndex, seed] of [
			[0, 1],
			[15, 4242],
			[7, (1 << 26) - 1]
		]) {
			expect(decodePuzzleId(encodePuzzleId(variantIndex, seed))).toEqual({ variantIndex, seed });
		}
	});

	it('wraps seeds outside the seed space', () => {
		expect(decodePuzzleId(encodePuzzleId(3, (1 << 26) + 5))).toEqual({ variantIndex: 3, seed: 5 });
	});

	it('draws seeds from 1 to the top of the seed space', () => {
		expect(randomSeed(() => 0)).toBe(1);
		expect(randomSeed(() => 0.999999999)).toBe((1 << 26) - 1);
		const seed = randomSeed();
		expect(seed >= 1 && seed < 1 << 26).toBe(true);
	});

	it('keys daily, weekly and monthly periods in UTC', () => {
		const d = new Date(Date.UTC(2026, 9, 7, 23, 59));
		expect(periodKey('daily', d)).toBe('2026-10-07');
		expect(periodKey('weekly', d)).toBe('2026-W41');
		expect(periodKey('monthly', d)).toBe('2026-10');
	});

	it('uses ISO weeks across year boundaries', () => {
		// 2026-01-01 is a Thursday (week 1); 2027-01-01 is a Friday (still week 53 of 2026).
		expect(periodKey('weekly', new Date(Date.UTC(2026, 0, 1)))).toBe('2026-W01');
		expect(periodKey('weekly', new Date(Date.UTC(2027, 0, 1)))).toBe('2026-W53');
		expect(periodKey('weekly', new Date(Date.UTC(2027, 0, 4)))).toBe('2027-W01');
		// 2024-12-30 is a Monday that belongs to week 1 of 2025.
		expect(periodKey('weekly', new Date(Date.UTC(2024, 11, 30)))).toBe('2025-W01');
		// Sunday ends the ISO week.
		expect(periodKey('weekly', new Date(Date.UTC(2026, 9, 11)))).toBe('2026-W41');
		expect(periodKey('weekly', new Date(Date.UTC(2026, 9, 12)))).toBe('2026-W42');
	});

	it('gives every player the same special seed for a period', () => {
		const seed = specialSeed('tetroid', 'daily', '2026-10-07');
		expect(seed).toBe(specialSeed('tetroid', 'daily', '2026-10-07'));
		expect(seed).not.toBe(specialSeed('tetroid', 'daily', '2026-10-08'));
		expect(seed).not.toBe(specialSeed('pinwheel', 'daily', '2026-10-07'));
		expect(seed >= 1 && seed < 1 << 26).toBe(true);
	});

	it('keeps longer periods longer', () => {
		const { daily, weekly, monthly } = SPECIAL_RETENTION_DAYS;
		expect(daily < weekly && weekly < monthly).toBe(true);
	});
});
