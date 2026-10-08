import { describe, expect, it, vi } from 'vitest';
import {
	CHUNK_SIZE,
	chunkPath,
	Collection,
	indexPath,
	layoutType,
	serialize,
	specialGroup,
	specialPath,
	type BankEntry,
	type BankFile,
	type BankIndex
} from './bank';

const entries = (count: number, from = 1): BankEntry<string>[] =>
	Array.from({ length: count }, (_, k) => ({ id: from + k, puzzle: `p${from + k}` }));

/** A collection over files kept in memory, counting reads. */
function inMemory(files: Record<string, unknown>, keep?: number) {
	const read = vi.fn(async (path: string) => structuredClone(files[path]) ?? null);
	return { collection: new Collection(read, keep), read };
}

describe('collection layout', () => {
	it('splits a regular type into full chunks and an index, in the order given', () => {
		const files = layoutType('tetroid', '6n', entries(CHUNK_SIZE * 2 + 5));
		expect(Object.keys(files)).toEqual([
			'puzzles/tetroid/6n/0000.json',
			'puzzles/tetroid/6n/0001.json',
			'puzzles/tetroid/6n/0002.json',
			'puzzles/tetroid/6n/index.json'
		]);
		const index = files[indexPath('tetroid', '6n')] as BankIndex;
		expect(index.chunks.map((ids) => ids.length)).toEqual([CHUNK_SIZE, CHUNK_SIZE, 5]);
		expect(index.chunks[2]).toEqual([201, 202, 203, 204, 205]);
		expect((files[chunkPath('tetroid', '6n', 2)] as BankFile).puzzles[0]).toEqual({
			id: 201,
			puzzle: 'p201'
		});
		// Adding puzzles leaves full chunks as they were.
		const grown = layoutType('tetroid', '6n', entries(CHUNK_SIZE * 2 + 7));
		expect(grown[chunkPath('tetroid', '6n', 1)]).toEqual(files[chunkPath('tetroid', '6n', 1)]);
	});

	it('writes an empty index for a type without puzzles', () => {
		expect(layoutType('g', 'v', [])).toEqual({
			[indexPath('g', 'v')]: { version: 2, game: 'g', variant: 'v', chunks: [] }
		});
	});

	it('groups special puzzles by month (daily) or year, in period order', () => {
		const daily = [
			{ id: 3, period: '2026-11-01', puzzle: 'c' },
			{ id: 1, period: '2026-10-30', puzzle: 'a' },
			{ id: 2, period: '2026-10-31', puzzle: 'b' }
		];
		const files = layoutType('g', 'daily', daily, 'daily');
		expect(Object.keys(files)).toEqual([
			'puzzles/g/daily/2026-10.json',
			'puzzles/g/daily/2026-11.json'
		]);
		expect((files['puzzles/g/daily/2026-10.json'] as BankFile).puzzles.map((p) => p.id)).toEqual([
			1, 2
		]);
		expect(specialGroup('weekly', '2027-W01')).toBe('2027');
		expect(specialPath('g', 'monthly', 'monthly', '2026-12')).toBe('puzzles/g/monthly/2026.json');
	});

	it('serializes one entry per line and reads back the same', () => {
		const files = layoutType('g', 'v', entries(3));
		const chunk = serialize(files[chunkPath('g', 'v', 0)]);
		expect(chunk.split('\n')).toEqual([
			'{',
			'\t"version": 2,',
			'\t"game": "g",',
			'\t"variant": "v",',
			'\t"puzzles": [',
			'\t\t{"id":1,"puzzle":"p1"},',
			'\t\t{"id":2,"puzzle":"p2"},',
			'\t\t{"id":3,"puzzle":"p3"}',
			'\t]',
			'}',
			''
		]);
		for (const file of Object.values(files)) expect(JSON.parse(serialize(file))).toEqual(file);
		const empty = layoutType('g', 'v', [])[indexPath('g', 'v')];
		expect(serialize(empty)).toContain('"chunks": []');
		expect(JSON.parse(serialize(empty))).toEqual(empty);
	});
});

describe('Collection', () => {
	const files = {
		...layoutType('g', 'v', entries(CHUNK_SIZE + 2)),
		...layoutType('g', 'daily', [{ id: 9, period: '2026-10-08', puzzle: 'd' }], 'daily')
	};

	it('finds a puzzle by ID, loading only the index and its chunk', async () => {
		const { collection, read } = inMemory(files);
		expect(await collection.find('g', 'v', 102)).toEqual({ id: 102, puzzle: 'p102' });
		expect(read.mock.calls.map(([p]) => p)).toEqual([indexPath('g', 'v'), chunkPath('g', 'v', 1)]);
		expect(await collection.find('g', 'v', 999)).toBeNull();
		expect(await collection.find('g', 'missing', 1)).toBeNull();
	});

	it('picks a random puzzle that is not ruled out', async () => {
		const { collection } = inMemory(files);
		// The last of the allowed IDs, with a random number just below 1.
		const pick = await collection.pick(
			'g',
			'v',
			(id) => id < 100,
			() => 0.999
		);
		expect(pick?.id).toBe(102);
		expect(await collection.pick('g', 'v', () => true)).toBeNull();
		expect(await collection.pick('g', 'missing')).toBeNull();
	});

	it('finds the puzzle of a special period', async () => {
		const { collection } = inMemory(files);
		expect(await collection.special('g', 'daily', 'daily', '2026-10-08')).toMatchObject({ id: 9 });
		expect(await collection.special('g', 'daily', 'daily', '2026-10-09')).toBeNull();
		expect(await collection.special('g', 'daily', 'daily', '2027-01-01')).toBeNull();
	});

	it('keeps the most recently used files and retries missing or failed ones', async () => {
		const { collection, read } = inMemory(files, 2);
		await collection.index('g', 'v');
		await collection.index('g', 'v');
		expect(read).toHaveBeenCalledTimes(1);
		await collection.chunk('g', 'v', 0);
		await collection.index('g', 'v');
		await collection.chunk('g', 'v', 1);
		// Index and chunk 1 are the two most recent; chunk 0 was dropped.
		await collection.index('g', 'v');
		expect(read).toHaveBeenCalledTimes(3);
		await collection.chunk('g', 'v', 0);
		expect(read).toHaveBeenCalledTimes(4);

		await collection.index('g', 'missing');
		await collection.index('g', 'missing');
		expect(read).toHaveBeenCalledTimes(6);
		const failing = new Collection(
			vi
				.fn()
				.mockRejectedValueOnce(new Error('offline'))
				.mockResolvedValue(files[indexPath('g', 'v')])
		);
		await expect(failing.index('g', 'v')).rejects.toThrow('offline');
		expect(await failing.index('g', 'v')).toMatchObject({ version: 2 });
	});
});
