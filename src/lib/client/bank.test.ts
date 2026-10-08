import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PuzzleBank } from '../core/bank';
import { MemoryStorage } from '../../test/memory-storage';
import { load, save } from './storage';

vi.mock('$app/paths', () => ({ asset: (path: string) => `/base${path}` }));

type Bank = typeof import('./bank');

const file: PuzzleBank = {
	version: 1,
	game: 'tetroid',
	variant: '6n',
	puzzles: [
		{ id: 1, puzzle: 'a' },
		{ id: 2, puzzle: 'b' },
		{ id: 3, puzzle: 'c' }
	]
};

let fetchMock: ReturnType<typeof vi.fn>;

/** Fresh module (collection files are cached per page load) with the given responses. */
async function setup(respond: (url: string) => Response | Promise<Response>): Promise<Bank> {
	vi.resetModules();
	fetchMock = vi.fn(async (url: string) => respond(url));
	vi.stubGlobal('fetch', fetchMock);
	return import('./bank');
}

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('puzzle source', () => {
	it('defaults to both and ignores unknown values', async () => {
		const bank = await setup(() => Response.json(file));
		expect(bank.loadPuzzleSource()).toBe('mixed');
		bank.savePuzzleSource('bank');
		expect(bank.loadPuzzleSource()).toBe('bank');
		save('puzzleSource', 'cloud');
		expect(bank.loadPuzzleSource()).toBe('mixed');
	});
});

describe('collection', () => {
	it('reads each file once from the assets', async () => {
		const bank = await setup(() => Response.json(file));
		expect(await bank.loadBank('tetroid', '6n')).toEqual(file);
		expect(await bank.findInBank('tetroid', '6n', 2)).toBe('b');
		expect(await bank.findInBank('tetroid', '6n', 9)).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith('/base/puzzles/tetroid/6n.json');
	});

	it('keeps only the most recently used files in memory', async () => {
		const bank = await setup(() => Response.json(file));
		for (const v of ['6n', '6h', '8n', '8h']) await bank.loadBank('tetroid', v);
		await bank.loadBank('tetroid', '6n');
		await bank.loadBank('tetroid', '10n');
		expect(fetchMock).toHaveBeenCalledTimes(5);
		// 6n was used again, so 6h was dropped and is read once more.
		await bank.loadBank('tetroid', '6n');
		expect(fetchMock).toHaveBeenCalledTimes(5);
		await bank.loadBank('tetroid', '6h');
		expect(fetchMock).toHaveBeenCalledTimes(6);
	});

	it('treats a missing file or no connection as an empty collection', async () => {
		let bank = await setup(() => new Response('', { status: 404 }));
		expect(await bank.pickFromBank('tetroid', '6n')).toBeNull();
		expect(await bank.findInBank('tetroid', '6n', 1)).toBeNull();
		bank = await setup(() => Promise.reject(new TypeError('offline')));
		expect(await bank.loadBank('tetroid', '6n')).toBeNull();
	});

	it('picks puzzles this device has not played and remembers them', async () => {
		const bank = await setup(() => Response.json(file));
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const picks = [];
		for (let i = 0; i < 3; i++) picks.push((await bank.pickFromBank('tetroid', '6n'))?.id);
		expect(picks).toEqual([1, 2, 3]);
		expect(load('bankPlayed:tetroid:6n', [])).toEqual([1, 2, 3]);
		expect(await bank.pickFromBank('tetroid', '6n')).toBeNull();
	});

	it('returns nothing for an empty file', async () => {
		const bank = await setup(() => Response.json({ ...file, puzzles: [] }));
		expect(await bank.pickFromBank('tetroid', '6n')).toBeNull();
	});
});
