import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '../src/lib/core/bank';
import type { GameLogic } from '../src/lib/core/types';
import {
	checkedPuzzle,
	checksDifficulty,
	DIFFICULTY_CHECKED_FROM,
	filesToCheck,
	readType,
	typeDir,
	writeType
} from './collection';

let root = '';

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = '';
});

const entries = (count: number) =>
	Array.from({ length: count }, (_, k) => ({ id: k + 1, puzzle: { n: k + 1 } }));

describe('collection files', () => {
	it('writes and reads back a regular type, in chunks with an index', () => {
		root = mkdtempSync(join(tmpdir(), 'collection-'));
		expect(readType(root, 'g', 'v')).toEqual([]);
		writeType(root, 'g', 'v', entries(CHUNK_SIZE + 1));
		expect(readdirSync(typeDir(root, 'g', 'v')).sort()).toEqual([
			'0000.json',
			'0001.json',
			'index.json'
		]);
		expect(readType(root, 'g', 'v')).toEqual(entries(CHUNK_SIZE + 1));
	});

	it('writes and reads back a special type, in period order', () => {
		root = mkdtempSync(join(tmpdir(), 'collection-'));
		const daily = [
			{ id: 2, period: '2026-11-01', puzzle: 'b' },
			{ id: 1, period: '2026-10-31', puzzle: 'a' }
		];
		writeType(root, 'g', 'daily', daily, 'daily');
		expect(readdirSync(typeDir(root, 'g', 'daily')).sort()).toEqual([
			'2026-10.json',
			'2026-11.json'
		]);
		expect(readType(root, 'g', 'daily', 'daily').map((p) => p.id)).toEqual([1, 2]);
	});

	it('removes files that are no longer part of the type', () => {
		root = mkdtempSync(join(tmpdir(), 'collection-'));
		writeType(root, 'g', 'v', entries(CHUNK_SIZE + 1));
		writeFileSync(join(typeDir(root, 'g', 'v'), 'stray.json'), '{}');
		writeType(root, 'g', 'v', entries(2));
		expect(readdirSync(typeDir(root, 'g', 'v')).sort()).toEqual(['0000.json', 'index.json']);
		expect(existsSync(join(typeDir(root, 'g', 'v'), '0001.json'))).toBe(false);
	});
});

describe('filesToCheck', () => {
	const chunk = 'static/puzzles/tetroid/6n/0011.json';
	const other = 'static/puzzles/tetroid/6n/0000.json';

	it('checks everything without a list of changes or when game logic changed', () => {
		expect(filesToCheck(null)(other)).toBe(true);
		expect(filesToCheck(['src/lib/games/tetroid/solver.ts', chunk])(other)).toBe(true);
		expect(filesToCheck(['src/lib/core/grid.ts'])(other)).toBe(true);
	});

	it('checks only the collection files a change touches otherwise', () => {
		const check = filesToCheck(['README.md', chunk, 'static/puzzles/tetroid/6n/index.json']);
		expect(check(chunk)).toBe(true);
		expect(check(other)).toBe(false);
		expect(filesToCheck(['src/lib/client/bank.ts'])(other)).toBe(false);
	});
});

describe('checked puzzles', () => {
	const variant = { key: 'v', label: 'V', width: 1, height: 1, difficulty: 'hard' } as const;
	const logic = (count: number, finished: boolean, fits: boolean) =>
		({
			generate: (_: unknown, seed: number) => ({ seed }),
			countSolutions: () => ({ count, finished }),
			fitsDifficulty: () => fits
		}) as unknown as GameLogic;

	it('takes a unique puzzle of the right difficulty, generated from the ID', () => {
		expect(checkedPuzzle(logic(1, true, true), variant, 5 * 16 + 2)).toEqual({
			puzzle: { seed: 5 }
		});
	});

	it('says why it refuses a puzzle', () => {
		expect(checkedPuzzle(logic(2, true, true), variant, 16)).toEqual({
			reason: 'not uniquely solvable'
		});
		expect(checkedPuzzle(logic(1, false, true), variant, 16)).toEqual({
			reason: 'not uniquely solvable'
		});
		expect(checkedPuzzle(logic(1, true, false), variant, 16)).toEqual({ reason: 'not hard' });
	});
});

describe('difficulty check', () => {
	it('applies to every regular puzzle and to specials from the first checked period on', () => {
		expect(checksDifficulty()).toBe(true);
		expect(checksDifficulty('daily', DIFFICULTY_CHECKED_FROM.daily)).toBe(true);
		expect(checksDifficulty('daily', '2026-10-09')).toBe(false);
		expect(checksDifficulty('daily', '2027-01-01')).toBe(true);
		expect(checksDifficulty('weekly', '2026-W41')).toBe(false);
		expect(checksDifficulty('weekly', '2026-W52')).toBe(true);
		expect(checksDifficulty('monthly', '2026-10')).toBe(false);
		expect(checksDifficulty('monthly', '2026-11')).toBe(true);
		// A special without a period cannot be placed after the cutoff.
		expect(checksDifficulty('daily')).toBe(false);
	});
});
