import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sameData } from './equal';

describe('sameData', () => {
	it('compares numbers, strings, booleans and null', () => {
		expect(sameData(1, 1)).toBe(true);
		expect(sameData(1, 2)).toBe(false);
		expect(sameData('a', 'a')).toBe(true);
		expect(sameData(true, false)).toBe(false);
		expect(sameData(null, null)).toBe(true);
		expect(sameData(null, 0)).toBe(false);
		expect(sameData(0, '0')).toBe(false);
	});

	it('compares arrays item by item', () => {
		expect(sameData([1, 2, 3], [1, 2, 3])).toBe(true);
		expect(sameData([1, 2, 3], [1, 2])).toBe(false);
		expect(sameData([1, 2], [2, 1])).toBe(false);
		expect(sameData([], {})).toBe(false);
		expect(sameData({}, [])).toBe(false);
	});

	it('compares objects by their keys, in any order, ignoring undefined values', () => {
		expect(sameData({ a: [1], b: 2 }, { b: 2, a: [1] })).toBe(true);
		expect(sameData({ a: 1 }, { a: 1, b: 2 })).toBe(false);
		expect(sameData({ a: 1, b: undefined }, { a: 1 })).toBe(true);
		expect(sameData({ a: 1 }, { b: 1 })).toBe(false);
		expect(sameData({ a: undefined }, { b: undefined })).toBe(true);
		expect(sameData({ a: 1, c: undefined }, { a: 1, b: 2 })).toBe(false);
	});

	it('tells apart the states of every game, including parts their encoding leaves out', () => {
		// Tetroid's `encodeState` keeps the marks only, not which crosses a helper placed.
		const manual = { marks: [2, 0], auto: [0, 0] };
		const auto = { marks: [2, 0], auto: [1, 0] };
		expect(sameData(manual, auto)).toBe(false);
		expect(sameData(manual, structuredClone(manual))).toBe(true);
	});

	it('agrees with comparing the JSON of plain data with sorted keys', () => {
		const json = fc.jsonValue().map((v) => JSON.parse(JSON.stringify(v)) as unknown);
		const sorted = (v: unknown): unknown =>
			Array.isArray(v)
				? v.map(sorted)
				: v && typeof v === 'object'
					? Object.fromEntries(
							Object.entries(v)
								.sort(([a], [b]) => (a < b ? -1 : 1))
								.map(([k, x]) => [k, sorted(x)])
						)
					: v;
		fc.assert(
			fc.property(json, json, (a, b) => {
				const same = JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
				expect(sameData(a, b)).toBe(same);
				expect(sameData(a, structuredClone(a))).toBe(true);
			}),
			{ numRuns: 500, seed: 46 }
		);
	});
});
