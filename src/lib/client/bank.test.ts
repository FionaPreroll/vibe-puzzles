import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_SIZE, layoutType, MAX_PER_TYPE } from '../core/bank';
import type { Variant } from '../core/variants';
import { MemoryStorage } from '../../test/memory-storage';
import { load, save } from './storage';

vi.mock('$app/paths', () => ({ asset: (path: string) => `/base${path}` }));
// The sizes of the types in `files` below, in place of the deployed collection's.
vi.mock('../../../static/puzzles/sizes.json', () => ({ default: { tetroid: { '6n': 102 } } }));

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
/** Answers collection requests from `files`, whatever revision they ask for; anything else is missing. */
const serve = (url: string) => {
	const file = files[url.replace(/^\/base\//, '').replace(/\?.*/, '')];
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

beforeEach(() => {
	vi.stubGlobal('localStorage', new MemoryStorage());
	// The revisions of the build, in place of the deployed collection's: none for daily.
	vi.stubGlobal('__COLLECTION_REVISIONS__', { tetroid: { '6n': 'rev6n' } });
});
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
			'/base/puzzles/tetroid/6n/index.json?r=rev6n',
			'/base/puzzles/tetroid/6n/0001.json?r=rev6n'
		]);
	});

	it('finds the special puzzle of the current period only', async () => {
		vi.useFakeTimers({ now: Date.UTC(2026, 9, 8, 12), toFake: ['Date'] });
		const bank = await setup(serve);
		expect(await bank.findInBank('tetroid', variant('daily', 'daily'), 7)).toBe('d');
		expect(await bank.findInBank('tetroid', variant('daily', 'daily'), 8)).toBeNull();
		// A type without a revision is asked for without one.
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'/base/puzzles/tetroid/daily/2026-10.json'
		]);
		vi.useRealTimers();
	});

	it('asks for each file with the revision of its type in this version', async () => {
		const bank = await setup(serve);
		const revisions = { tetroid: { '6n': 'abc', '8n': 'def' }, pixels: { '5n': 'ghi' } };
		expect(bank.collectionUrl('puzzles/tetroid/8n/0003.json', revisions)).toBe(
			'/base/puzzles/tetroid/8n/0003.json?r=def'
		);
		expect(bank.collectionUrl('puzzles/pixels/5n/index.json', revisions)).toBe(
			'/base/puzzles/pixels/5n/index.json?r=ghi'
		);
		// The build's revisions by default; a type or game they lack gets none.
		expect(bank.collectionUrl('puzzles/tetroid/6n/0000.json')).toBe(
			'/base/puzzles/tetroid/6n/0000.json?r=rev6n'
		);
		expect(bank.collectionUrl('puzzles/pixels/10n/0000.json', revisions)).toBe(
			'/base/puzzles/pixels/10n/0000.json'
		);
		expect(bank.collectionUrl('puzzles/loop/5n/0000.json', revisions)).toBe(
			'/base/puzzles/loop/5n/0000.json'
		);
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
		// Picking needs the chunks only, not the index.
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'/base/puzzles/tetroid/6n/0000.json?r=rev6n',
			'/base/puzzles/tetroid/6n/0001.json?r=rev6n'
		]);
	});

	it('remembers as many played puzzles per type as a type can hold', async () => {
		const bank = await setup(serve);
		save(
			'bankPlayed:tetroid:6n',
			Array.from({ length: MAX_PER_TYPE }, (_, k) => -k)
		);
		vi.spyOn(Math, 'random').mockReturnValue(0);
		expect((await bank.pickFromBank('tetroid', '6n'))?.id).toBe(1);
		const played = load<number[]>('bankPlayed:tetroid:6n', []);
		expect(played).toHaveLength(MAX_PER_TYPE);
		expect(played.slice(0, 1)).toEqual([-1]);
		expect(played.at(-1)).toBe(1);
	});
});
