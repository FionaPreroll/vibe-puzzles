import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '../src/lib/core/bank';
import { filesToCheck, readType, typeDir, writeType } from './collection';

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
