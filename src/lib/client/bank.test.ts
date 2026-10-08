import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_SIZE, layoutType } from '../core/bank';
import type { Variant } from '../core/variants';
import { MemoryStorage } from '../../test/memory-storage';
import { load, save } from './storage';

vi.mock('$app/paths', () => ({ asset: (path: string) => `/base${path}` }));

type Bank = typeof import('./bank');

const regular = layoutType(
	'tetroid',
	'6n',
	Array.from({ length: CHUNK_SIZE + 2 }, (_, k) => ({ id: k + 1, puzzle: `p${k + 1}` }))
);
const daily = layoutType(
	'tetroid',
	'daily',
	[{ id: 7, period: '2026-10-08', puzzle: 'd' }],
	'daily'
);
const files: Record<string, unknown> = { ...regular, ...daily };
/** Answers collection requests from `files`; anything else is missing. */
const serve = (url: string) => {
	const file = files[url.replace(/^\/base\//, '')];
	return file ? Response.json(file) : new Response('', { status: 404 });
};
const variant = (key: string, special?: Variant['special']) =>
	({ key, label: key, width: 6, height: 6, difficulty: 'normal', special }) as Variant;

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
		const bank = await setup(serve);
		expect(bank.loadPuzzleSource()).toBe('mixed');
		bank.savePuzzleSource('bank');
		expect(bank.loadPuzzleSource()).toBe('bank');
		save('puzzleSource', 'cloud');
		expect(bank.loadPuzzleSource()).toBe('mixed');
	});
});

describe('collection', () => {
	it('finds a puzzle by ID, reading the index and its chunk once', async () => {
		const bank = await setup(serve);
		expect(await bank.findInBank('tetroid', variant('6n'), 102)).toBe('p102');
		expect(await bank.findInBank('tetroid', variant('6n'), 101)).toBe('p101');
		expect(await bank.findInBank('tetroid', variant('6n'), 999)).toBeNull();
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'/base/puzzles/tetroid/6n/index.json',
			'/base/puzzles/tetroid/6n/0001.json'
		]);
	});

	it('finds the special puzzle of the current period only', async () => {
		vi.useFakeTimers({ now: Date.UTC(2026, 9, 8, 12), toFake: ['Date'] });
		const bank = await setup(serve);
		expect(await bank.findInBank('tetroid', variant('daily', 'daily'), 7)).toBe('d');
		expect(await bank.findInBank('tetroid', variant('daily', 'daily'), 8)).toBeNull();
		vi.useRealTimers();
	});

	it('treats a missing file or no connection as an empty collection', async () => {
		let bank = await setup(() => new Response('', { status: 404 }));
		expect(await bank.pickFromBank('tetroid', '6n')).toBeNull();
		expect(await bank.findInBank('tetroid', variant('6n'), 1)).toBeNull();
		bank = await setup(() => Promise.reject(new TypeError('offline')));
		expect(await bank.pickFromBank('tetroid', '6n')).toBeNull();
	});

	it('picks puzzles this device has not played and remembers them', async () => {
		const bank = await setup(serve);
		save(
			'bankPlayed:tetroid:6n',
			Array.from({ length: CHUNK_SIZE - 1 }, (_, k) => k + 1)
		);
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const picks = [];
		for (let i = 0; i < 3; i++) picks.push((await bank.pickFromBank('tetroid', '6n'))?.id);
		expect(picks).toEqual([100, 101, 102]);
		expect(load<number[]>('bankPlayed:tetroid:6n', []).slice(-3)).toEqual([100, 101, 102]);
		expect(await bank.pickFromBank('tetroid', '6n')).toBeNull();
	});
});
