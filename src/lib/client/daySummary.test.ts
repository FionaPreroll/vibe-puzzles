import { afterEach, describe, expect, it } from 'vitest';
import type { Variant } from '../core/variants';
import { i18n } from '../i18n/index.svelte';
import { dayShare, SHARED_LINES, solvesToday, startOfDay, type DayGame } from './daySummary';
import type { RecentSolve } from './stats';

const normal: Variant = { key: '9n', label: '9×9', width: 9, height: 9, difficulty: 'normal' };
const hard: Variant = { key: '9h', label: '9×9', width: 9, height: 9, difficulty: 'hard' };
const soon: Variant = { ...hard, key: '12h', width: 12, height: 12, comingSoon: true };
const sudoku: DayGame = {
	id: 'sudoku',
	name: 'Sudoku',
	icon: '🔢',
	variants: [normal, hard, soon]
};
const loop: DayGame = { id: 'loop', name: 'Loop', icon: '➰', variants: [normal] };

const now = new Date(2026, 10, 22, 21, 30);
const at = (h: number, m = 0) => new Date(2026, 10, 22, h, m).getTime();
const yesterday = new Date(2026, 10, 21, 23, 59).getTime();

function statsOf(recent: Record<string, RecentSolve[]>) {
	return (game: string, variant: string) => ({ recent: recent[`${game}:${variant}`] ?? [] });
}

afterEach(() => {
	i18n.locale = 'en';
});

describe('solvesToday', () => {
	it('starts the day at local midnight', () => {
		expect(startOfDay(now)).toBe(new Date(2026, 10, 22).getTime());
	});

	it('collects the solves since midnight from every game and type, the first solved first', () => {
		const stats = statsOf({
			'sudoku:9n': [
				{ puzzleId: 3, timeMs: 1000, at: at(20) },
				{ puzzleId: 2, timeMs: 1000, at: yesterday }
			],
			'sudoku:9h': [{ puzzleId: 4, timeMs: 1000, at: at(9) }],
			'sudoku:12h': [{ puzzleId: 9, timeMs: 1000, at: at(10) }],
			'loop:9n': [{ puzzleId: 5, timeMs: 1000, at: at(12), hinted: true }]
		});
		const solves = solvesToday([sudoku, loop], now, stats);
		expect(solves.map((s) => [s.game.id, s.variant.key, s.puzzleId])).toEqual([
			['sudoku', '9h', 4],
			['loop', '9n', 5],
			['sudoku', '9n', 3]
		]);
		expect(solves[1].hinted).toBe(true);
	});

	it('is empty on a day without solves', () => {
		const stats = statsOf({ 'sudoku:9n': [{ puzzleId: 2, timeMs: 1000, at: yesterday }] });
		expect(solvesToday([sudoku], now, stats)).toEqual([]);
	});
});

describe('dayShare', () => {
	const stats = statsOf({
		'sudoku:9n': [{ puzzleId: 3, timeMs: 372_000, at: at(20) }],
		'loop:9n': [{ puzzleId: 5, timeMs: 520_000, at: at(12), hinted: true }]
	});

	it('names every solve with its time, the total and an invitation', () => {
		const share = dayShare(solvesToday([sudoku, loop], now, stats), 'https://x.test/');
		expect(share.url).toBe('https://x.test/');
		expect(share.title).toBe('Today · Vibe Puzzles');
		expect(share.text).toBe(
			[
				'My puzzle day: 2 puzzles solved in 14:52.',
				'➰ Loop 9×9 Normal: 08:40 (with hints)',
				'🔢 Sudoku 9×9 Normal: 06:12',
				'Want to play too?'
			].join('\n')
		);
	});

	it('speaks German, and counts one puzzle as one', () => {
		i18n.locale = 'de';
		const one = solvesToday([sudoku], now, stats);
		expect(dayShare(one, 'https://x.test/').text).toBe(
			[
				'Mein Rätseltag: 1 Rätsel in 06:12 gelöst.',
				'🔢 Sudoku 9×9 Normal: 06:12',
				'Spielst du mit?'
			].join('\n')
		);
	});

	it(`names at most ${SHARED_LINES} solves and counts the rest`, () => {
		const many = statsOf({
			'sudoku:9n': Array.from({ length: 13 }, (_, i) => ({
				puzzleId: i + 1,
				timeMs: 60_000,
				at: at(8, i)
			}))
		});
		const lines = dayShare(solvesToday([sudoku], now, many), 'https://x.test/').text.split('\n');
		expect(lines[0]).toBe('My puzzle day: 13 puzzles solved in 13:00.');
		expect(lines).toHaveLength(1 + SHARED_LINES + 2);
		expect(lines.at(-2)).toBe('… and 3 more');
	});

	it('shows quick times to the millisecond, like a shared solve', () => {
		const quick = statsOf({ 'sudoku:9n': [{ puzzleId: 1, timeMs: 12_345, at: at(8) }] });
		expect(dayShare(solvesToday([sudoku], now, quick), '').text).toContain(
			'Sudoku 9×9 Normal: 00:12.345'
		);
	});
});
