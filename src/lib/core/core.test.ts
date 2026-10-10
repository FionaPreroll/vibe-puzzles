import { describe, expect, it } from 'vitest';
import { specialPuzzleId, upcomingPeriods } from './bank';
import {
	boardPad,
	CELEBRATION_COLOURS,
	celebrationFills,
	colourRegions,
	columnLabel,
	coordinateLabels,
	labelFontSize,
	neighbours,
	packDigits,
	unpackDigits
} from './grid';
import { hashString, Rng } from './rng';
import { COMMON_SETTINGS, settingValues, withCommon } from './settings';
import { formatCountdown, formatDuration } from './time';
import {
	decodePuzzleId,
	encodePuzzleId,
	nextPeriodStart,
	periodKey,
	randomSeed,
	specialSeed,
	SPECIAL_RETENTION_DAYS
} from './variants';

describe('grid', () => {
	it('lets a look bring its own win colours, with the classic ones as fallback', () => {
		expect(CELEBRATION_COLOURS).toHaveLength(8);
		expect(CELEBRATION_COLOURS[0]).toBe('var(--celebrate-1, #f87171)');
		expect(CELEBRATION_COLOURS[7]).toBe('var(--celebrate-8, #fb923c)');
	});

	it('colours neighbouring regions differently', () => {
		// 3×3: a ring of regions 0–3 around region 4.
		const region = [0, 0, 1, 3, 4, 1, 3, 2, 2];
		const colours = colourRegions(region, 3, 3, 8);
		expect(colours).toHaveLength(5);
		for (let i = 0; i < 9; i++) {
			for (const j of neighbours(i, 3, 3)) {
				if (region[i] !== region[j]) expect(colours[region[i]]).not.toBe(colours[region[j]]);
			}
		}
		expect(new Set(colours).size).toBeGreaterThan(2);
		expect(colourRegions([], 0, 0, 8)).toEqual([]);
	});

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

	it('fills each cell with the win colour of its region', () => {
		const region = [0, 0, 1, 3, 4, 1, 3, 2, 2];
		const fills = celebrationFills(region, 3, 3);
		const slot = colourRegions(region, 3, 3, CELEBRATION_COLOURS.length);
		expect(fills).toEqual(region.map((r) => CELEBRATION_COLOURS[slot[r]]));
		expect(fills[0]).toBe(fills[1]);
		expect(fills[0]).not.toBe(fills[3]);
	});

	it('leaves room for the coordinates only when they are shown', () => {
		expect(boardPad(40, true, 3)).toBe(24);
		expect(boardPad(10, true, 3)).toBe(14);
		expect(boardPad(40, false, 3)).toBe(3);
		expect(labelFontSize(24)).toBe(12);
		expect(labelFontSize(14)).toBe(10.5);
	});

	it('puts column letters above and below, row numbers left and right', () => {
		// 2×3 cells of 10 px in a margin of 4: the board is 28 px wide and 38 px high.
		const labels = coordinateLabels(2, 3, 10, 4);
		expect(labels).toHaveLength(2 * 2 + 3 * 2);
		expect(labels.filter((l) => l.text === 'b')).toEqual([
			{ x: 19, y: 2, text: 'b' },
			{ x: 19, y: 36, text: 'b' }
		]);
		expect(labels.filter((l) => l.text === '3')).toEqual([
			{ x: 2, y: 29, text: '3' },
			{ x: 26, y: 29, text: '3' }
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

	it('gives every setting a value, the default unless one is given', () => {
		const list = withCommon([{ key: 'x', label: 'X', default: true }]);
		const values = settingValues(list, { autoSubmit: false, removed: true });
		expect(Object.keys(values)).toEqual(list.map((s) => s.key));
		expect(values).toMatchObject({ autoSubmit: false, highlightErrors: true, x: true });
		expect(settingValues(list).autoSubmit).toBe(true);
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

	it.each([
		[0, '00:00.000'],
		[7_042.6, '00:07.042'],
		[29_999, '00:29.999'],
		[30_000, '00:30'],
		[61_000, '01:01'],
		[-5000, '00:00']
	])('formats %i ms precisely as %s', (ms, text) => {
		expect(formatDuration(ms, true)).toBe(text);
	});
});

describe('formatCountdown', () => {
	it.each([
		[-1, '1 min'],
		[1, '1 min'],
		[60_000, '1 min'],
		[60_001, '2 min'],
		[59 * 60_000, '59 min'],
		[3_600_000, '1 h 00 min'],
		[5 * 3_600_000 + 7 * 60_000 - 500, '5 h 07 min'],
		[24 * 3_600_000, '24 h 00 min']
	])('formats %i ms as %s', (ms, text) => {
		expect(formatCountdown(ms)).toBe(text);
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

	it('finds when the next period starts', () => {
		const utc = (...a: [number, number, number, number?]) => new Date(Date.UTC(...a));
		// Wednesday 2026-10-07, one minute before midnight UTC.
		const d = new Date(Date.UTC(2026, 9, 7, 23, 59));
		expect(nextPeriodStart('daily', d)).toEqual(utc(2026, 9, 8));
		expect(nextPeriodStart('weekly', d)).toEqual(utc(2026, 9, 12));
		expect(nextPeriodStart('monthly', d)).toEqual(utc(2026, 10, 1));
		// At midnight a new period has just started.
		expect(nextPeriodStart('daily', utc(2026, 9, 8))).toEqual(utc(2026, 9, 9));
		// Sunday ends the week, Monday starts the next one.
		expect(nextPeriodStart('weekly', utc(2026, 9, 11, 12))).toEqual(utc(2026, 9, 12));
		expect(nextPeriodStart('weekly', utc(2026, 9, 12))).toEqual(utc(2026, 9, 19));
		// Across the end of the year.
		expect(nextPeriodStart('daily', utc(2026, 11, 31, 5))).toEqual(utc(2027, 0, 1));
		expect(nextPeriodStart('monthly', utc(2026, 11, 15))).toEqual(utc(2027, 0, 1));
		// Each next start belongs to a new period.
		for (const kind of ['daily', 'weekly', 'monthly'] as const) {
			const next = nextPeriodStart(kind, d);
			expect(periodKey(kind, next)).not.toBe(periodKey(kind, d));
			expect(periodKey(kind, new Date(next.getTime() - 1))).toBe(periodKey(kind, d));
		}
	});

	it('lists the coming periods of a special type', () => {
		const from = new Date(Date.UTC(2026, 11, 30, 12));
		expect(upcomingPeriods('daily', 3, from)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
		expect(upcomingPeriods('weekly', 3, from)).toEqual(['2026-W53', '2027-W01', '2027-W02']);
		expect(upcomingPeriods('monthly', 3, from)).toEqual(['2026-12', '2027-01', '2027-02']);
		// The 31st does not skip a short month.
		expect(upcomingPeriods('monthly', 2, new Date(Date.UTC(2027, 0, 31)))).toEqual([
			'2027-01',
			'2027-02'
		]);
		expect(upcomingPeriods('daily', 0)).toEqual([]);
	});

	it('derives special puzzle IDs from the period', () => {
		const id = specialPuzzleId('tetroid', 10, 'daily', '2026-10-07');
		expect(decodePuzzleId(id)).toEqual({
			variantIndex: 10,
			seed: specialSeed('tetroid', 'daily', '2026-10-07')
		});
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
