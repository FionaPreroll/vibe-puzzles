import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { isLookChoice, resolveLook, seasonalLook } from './theme';

/** Local dates around the Halloween season. */
const SEASON: [string, Date, 'classic' | 'halloween'][] = [
	['30 September, late evening', new Date(2026, 8, 30, 23, 59), 'classic'],
	['1 October, just after midnight', new Date(2026, 9, 1, 0, 0), 'halloween'],
	['Halloween', new Date(2026, 9, 31, 20), 'halloween'],
	['1 November, late evening', new Date(2026, 10, 1, 23, 59), 'halloween'],
	['2 November', new Date(2026, 10, 2, 0, 0), 'classic'],
	['1 December', new Date(2026, 11, 1), 'classic'],
	['1 March', new Date(2027, 2, 1), 'classic']
];

describe('look', () => {
	for (const [when, date, look] of SEASON) {
		it(`is ${look} on ${when} unless the player picks one`, () => {
			expect(seasonalLook(date)).toBe(look);
			expect(resolveLook('auto', date)).toBe(look);
			expect(resolveLook('classic', date)).toBe('classic');
			expect(resolveLook('halloween', date)).toBe('halloween');
		});
	}

	it('knows the choices', () => {
		expect(['auto', 'classic', 'halloween'].every(isLookChoice)).toBe(true);
		expect([null, 'spooky', 1, undefined].some(isLookChoice)).toBe(false);
	});
});

describe('app.html', () => {
	/** The script that sets night mode and the look before the first paint. */
	const script = /<script>([\s\S]*?)<\/script>/.exec(readFileSync('src/app.html', 'utf8'))![1];

	/** Runs it on a page with the given stored values and date; returns the root's state. */
	function run(stored: Record<string, string>, now: Date, storage = true) {
		const classes = new Set<string>();
		const root = { classList: { add: (c: string) => classes.add(c) }, dataset: {} as DOMStringMap };
		const RealDate = Date;
		const FixedDate = function () {
			return new RealDate(now);
		};
		runInNewContext(script, {
			document: { documentElement: root },
			matchMedia: () => ({ matches: false }),
			Date: FixedDate,
			JSON,
			get localStorage() {
				if (!storage) throw new Error('blocked');
				return { getItem: (key: string) => stored[key] ?? null };
			}
		});
		return { dark: classes.has('dark'), theme: root.dataset.theme };
	}

	it('applies the seasonal look like the app does', () => {
		for (const [, date, look] of SEASON) {
			expect(run({}, date).theme).toBe(look === 'halloween' ? 'halloween' : undefined);
		}
	});

	it("applies the player's choice of look and night mode", () => {
		const october = new Date(2026, 9, 10);
		expect(run({ 'vp:look': '"classic"' }, october).theme).toBeUndefined();
		expect(run({ 'vp:look': '"halloween"' }, new Date(2026, 4, 1)).theme).toBe('halloween');
		expect(run({ 'vp:look': '"spooky"' }, october).theme).toBe('halloween');
		expect(run({ 'vp:night': 'true' }, october)).toEqual({ dark: true, theme: 'halloween' });
	});

	it('still follows the calendar without storage', () => {
		expect(run({}, new Date(2026, 9, 10), false)).toEqual({ dark: false, theme: 'halloween' });
	});
});
