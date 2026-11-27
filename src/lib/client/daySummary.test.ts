import { afterEach, describe, expect, it } from 'vitest';
import type { Variant } from '../core/variants';
import { i18n } from '../i18n/index.svelte';
import {
	dayShare,
	dayTypes,
	SHARED_LINES,
	solvesToday,
	startOfDay,
	type DayGame
} from './daySummary';
import type { RecentSolve } from './stats';

const easy: Variant = { key: '9e', label: '9×9', width: 9, height: 9, difficulty: 'easy' };
const normal: Variant = { key: '9n', label: '9×9', width: 9, height: 9, difficulty: 'normal' };
const hard: Variant = { key: '9h', label: '9×9', width: 9, height: 9, difficulty: 'hard' };
const soon: Variant = { ...hard, key: '12h', width: 12, height: 12, comingSoon: true };
const sudoku: DayGame = {
	id: 'sudoku',
	name: 'Sudoku',
	icon: '🔢',
	variants: [easy, normal, hard, soon]
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

describe('dayTypes', () => {
	const types = (recent: Record<string, RecentSolve[]>) =>
		dayTypes(solvesToday([sudoku, loop], now, statsOf(recent))).map((d) => [
			d.game.id,
			d.variant.key,
			d.count,
			d.bestMs,
			d.hinted
		]);

	it('counts the solves of each type and keeps the best time of the day', () => {
		expect(
			types({
				'sudoku:9n': [
					{ puzzleId: 1, timeMs: 400_000, at: at(8) },
					{ puzzleId: 2, timeMs: 300_000, at: at(9) },
					{ puzzleId: 3, timeMs: 350_000, at: at(10) }
				]
			})
		).toEqual([['sudoku', '9n', 3, 300_000, false]]);
	});

	it('takes the best time from solves without hints, and from hinted ones only if all took hints', () => {
		expect(
			types({
				'sudoku:9n': [
					{ puzzleId: 1, timeMs: 100_000, at: at(8), hinted: true },
					{ puzzleId: 2, timeMs: 300_000, at: at(9) },
					{ puzzleId: 3, timeMs: 90_000, at: at(10), hinted: true },
					{ puzzleId: 4, timeMs: 250_000, at: at(11) }
				],
				'loop:9n': [
					{ puzzleId: 5, timeMs: 500_000, at: at(12), hinted: true },
					{ puzzleId: 6, timeMs: 450_000, at: at(13), hinted: true }
				]
			})
		).toEqual([
			['sudoku', '9n', 4, 250_000, false],
			['loop', '9n', 2, 450_000, true]
		]);
	});

	it('puts the hardest types first, then the fastest, then those solved only with hints', () => {
		expect(
			types({
				'sudoku:9e': [{ puzzleId: 1, timeMs: 60_000, at: at(8) }],
				'sudoku:9n': [{ puzzleId: 2, timeMs: 300_000, at: at(9) }],
				'loop:9n': [
					{ puzzleId: 3, timeMs: 200_000, at: at(10) },
					{ puzzleId: 4, timeMs: 100_000, at: at(11), hinted: true }
				],
				'sudoku:9h': [
					{ puzzleId: 5, timeMs: 400_000, at: at(12), hinted: true },
					{ puzzleId: 6, timeMs: 700_000, at: at(13) }
				]
			})
		).toEqual([
			['sudoku', '9h', 2, 700_000, false],
			['loop', '9n', 2, 200_000, false],
			['sudoku', '9n', 1, 300_000, false],
			['sudoku', '9e', 1, 60_000, false]
		]);
		expect(
			types({
				'sudoku:9n': [{ puzzleId: 1, timeMs: 60_000, at: at(8), hinted: true }],
				'loop:9n': [{ puzzleId: 2, timeMs: 500_000, at: at(9) }]
			})
		).toEqual([
			['loop', '9n', 1, 500_000, false],
			['sudoku', '9n', 1, 60_000, true]
		]);
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
				'🔢 Sudoku 9×9 Normal: 06:12',
				'➰ Loop 9×9 Normal: 08:40 (with hints)',
				'Want to play too?'
			].join('\n')
		);
	});

	it('names each type once, the hardest first, with how often and its best time', () => {
		const day = statsOf({
			'sudoku:9n': [
				{ puzzleId: 1, timeMs: 400_000, at: at(8) },
				{ puzzleId: 2, timeMs: 372_000, at: at(9) }
			],
			'sudoku:9h': [{ puzzleId: 3, timeMs: 900_000, at: at(10) }],
			'loop:9n': [
				{ puzzleId: 4, timeMs: 520_000, at: at(11), hinted: true },
				{ puzzleId: 5, timeMs: 610_000, at: at(12), hinted: true }
			]
		});
		const solves = solvesToday([sudoku, loop], now, day);
		expect(dayShare(solves, '').text.split('\n')).toEqual([
			'My puzzle day: 5 puzzles solved in 46:42.',
			'🔢 Sudoku 9×9 Hard: 15:00',
			'🔢 Sudoku 9×9 Normal: 2×, best 06:12',
			'➰ Loop 9×9 Normal: 2×, best 08:40 (with hints)',
			'Want to play too?'
		]);
		i18n.locale = 'de';
		expect(dayShare(solves, '').text.split('\n').slice(1, 4)).toEqual([
			'🔢 Sudoku 9×9 Schwer: 15:00',
			'🔢 Sudoku 9×9 Normal: 2×, Bestzeit 06:12',
			'➰ Loop 9×9 Normal: 2×, Bestzeit 08:40 (mit Hinweisen)'
		]);
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

	it(`names at most ${SHARED_LINES} types and counts the puzzles of the rest`, () => {
		const sizes = Array.from({ length: 13 }, (_, i): Variant => ({
			...normal,
			key: `s${i}`,
			width: i + 4,
			height: i + 4
		}));
		const many: DayGame = { ...sudoku, variants: sizes };
		const day = statsOf(
			Object.fromEntries(
				sizes.map((v, i) => [
					`sudoku:${v.key}`,
					// The slowest types are the ones left out, two puzzles each.
					Array.from({ length: i < SHARED_LINES ? 1 : 2 }, (_, j) => ({
						puzzleId: i * 2 + j + 1,
						timeMs: 60_000 + i * 1000,
						at: at(8, i * 2 + j)
					}))
				])
			)
		);
		const lines = dayShare(solvesToday([many], now, day), 'https://x.test/').text.split('\n');
		expect(lines[0]).toBe('My puzzle day: 16 puzzles solved in 17:51.');
		expect(lines).toHaveLength(1 + SHARED_LINES + 2);
		expect(lines[1]).toBe('🔢 Sudoku 4×4 Normal: 01:00');
		expect(lines[SHARED_LINES]).toBe('🔢 Sudoku 13×13 Normal: 01:09');
		expect(lines.at(-2)).toBe('… and 6 more');
	});

	it('shows quick times to the millisecond, like a shared solve', () => {
		const quick = statsOf({ 'sudoku:9n': [{ puzzleId: 1, timeMs: 12_345, at: at(8) }] });
		expect(dayShare(solvesToday([sudoku], now, quick), '').text).toContain(
			'Sudoku 9×9 Normal: 00:12.345'
		);
	});
});
