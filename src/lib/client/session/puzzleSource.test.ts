import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameModule } from '../../core/types';
import { decodePuzzleId, encodePuzzleId, periodKey, specialSeed } from '../../core/variants';
import { GAME_LOGIC } from '../../games/logic';
import { generateTetroid } from '../../games/tetroid/generator';
import type { TetroidPuzzle, TetroidState } from '../../games/tetroid/rules';
import * as api from '../api';
import * as bank from '../bank';
import { generate } from '../generate';
import { PuzzleSource } from './puzzleSource';

vi.mock('../api', () => ({
	serverPuzzles: vi.fn(async () => false),
	issuePuzzle: vi.fn()
}));
vi.mock('../bank', () => ({
	loadPuzzleSource: vi.fn(() => 'local'),
	pickFromBank: vi.fn(async () => null),
	findInBank: vi.fn(async () => null)
}));
vi.mock('../generate', () => ({ generate: vi.fn() }));

const game = GAME_LOGIC.tetroid as unknown as GameModule<TetroidPuzzle, TetroidState>;
const DAILY = game.variants.findIndex((v) => v.key === 'daily');
const ID = encodePuzzleId(0, 4242);
const { puzzle } = generateTetroid(6, 6, 'normal', 4242);

beforeEach(() => {
	vi.useFakeTimers({ now: Date.UTC(2026, 9, 11, 12), toFake: ['Date'] });
	vi.mocked(generate).mockImplementation(async () => puzzle);
});

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('puzzle source', () => {
	it('makes a requested puzzle on the device', async () => {
		const found = await new PuzzleSource(game).find(0, ID);
		expect(found).toEqual({
			puzzle,
			puzzleId: ID,
			ticket: null,
			startedAt: Date.now(),
			source: 'local'
		});
		expect(generate).toHaveBeenCalledWith('tetroid', 0, 4242);
		expect(api.serverPuzzles).not.toHaveBeenCalled();
	});

	it('takes a requested puzzle from the collection without generating it', async () => {
		vi.mocked(bank.findInBank).mockResolvedValueOnce(puzzle);
		expect(await new PuzzleSource(game).find(0, ID)).toMatchObject({ puzzle, source: 'local' });
		expect(generate).not.toHaveBeenCalled();
		// A broken one is generated after all.
		vi.mocked(bank.findInBank).mockResolvedValueOnce({ width: 1 });
		await new PuzzleSource(game).find(0, ID);
		expect(generate).toHaveBeenCalledTimes(1);
	});

	it('plays the prefetched puzzle next', async () => {
		const source = new PuzzleSource(game);
		source.prefetch(0);
		const [, , seed] = vi.mocked(generate).mock.calls[0];
		const found = await source.find(0, null);
		expect(found.puzzleId).toBe(encodePuzzleId(0, seed));
		// Only once: the one after is another.
		const next = await source.find(0, null);
		expect(next.puzzleId).not.toBe(found.puzzleId);
		expect(decodePuzzleId(next.puzzleId).variantIndex).toBe(0);
	});

	it("plays the current period's puzzle of a special type, and prefetches none", async () => {
		const source = new PuzzleSource(game);
		source.prefetch(DAILY);
		expect(generate).not.toHaveBeenCalled();
		const found = await source.find(DAILY, null);
		const seed = specialSeed('tetroid', 'daily', periodKey('daily'));
		expect(found.puzzleId).toBe(encodePuzzleId(DAILY, seed));
	});

	it('takes a new puzzle from the collection when the player chose it', async () => {
		vi.mocked(bank.loadPuzzleSource).mockReturnValue('bank');
		vi.mocked(bank.pickFromBank).mockResolvedValueOnce({ id: ID, puzzle });
		expect(await new PuzzleSource(game).find(0, null)).toMatchObject({
			puzzleId: ID,
			source: 'bank'
		});
		// Not for a special type, and not when the collection has none left.
		vi.mocked(bank.pickFromBank).mockResolvedValueOnce(null);
		expect(await new PuzzleSource(game).find(0, null)).toMatchObject({ source: 'local' });
		expect(await new PuzzleSource(game).find(DAILY, null)).toMatchObject({ source: 'local' });
		expect(bank.pickFromBank).toHaveBeenCalledTimes(2);
		vi.mocked(bank.loadPuzzleSource).mockReturnValue('local');
	});

	it('takes every other new puzzle from the collection on "mixed"', async () => {
		vi.mocked(bank.loadPuzzleSource).mockReturnValue('mixed');
		vi.mocked(bank.pickFromBank).mockResolvedValue({ id: ID, puzzle });
		const random = vi.spyOn(Math, 'random');
		random.mockReturnValueOnce(0.7);
		expect(await new PuzzleSource(game).find(0, null)).toMatchObject({ source: 'bank' });
		random.mockReturnValueOnce(0.2);
		expect(await new PuzzleSource(game).find(0, null)).toMatchObject({ source: 'local' });
		random.mockRestore();
		vi.mocked(bank.pickFromBank).mockResolvedValue(null);
		vi.mocked(bank.loadPuzzleSource).mockReturnValue('local');
	});

	it('generates a puzzle of a type the list does not have without asking the collection', async () => {
		const id = encodePuzzleId(15, 4242);
		expect(await new PuzzleSource(game).find(0, id)).toMatchObject({ puzzleId: id });
		expect(bank.findInBank).not.toHaveBeenCalled();
		expect(generate).toHaveBeenCalledWith('tetroid', 15, 4242);
	});

	it('plays a puzzle the server issues on its clock', async () => {
		vi.mocked(api.serverPuzzles).mockResolvedValueOnce(true);
		vi.mocked(api.issuePuzzle).mockResolvedValueOnce({
			ticket: 'tk',
			puzzle,
			issuedAt: 123,
			puzzleId: null
		});
		expect(await new PuzzleSource(game).find(0, null)).toEqual({
			puzzle,
			puzzleId: 0,
			ticket: 'tk',
			startedAt: 123,
			source: 'server'
		});
	});

	it('says when the server fails, and makes a puzzle on the device instead', async () => {
		const failed = vi.fn();
		for (const issue of [
			() => Promise.reject(new Error('down')),
			async () => ({ ticket: 'tk', puzzle: { width: 1 }, issuedAt: 1, puzzleId: null })
		]) {
			vi.mocked(api.serverPuzzles).mockResolvedValueOnce(true);
			vi.mocked(api.issuePuzzle).mockImplementationOnce(issue as never);
			expect(await new PuzzleSource(game).find(0, null, failed)).toMatchObject({
				source: 'local',
				ticket: null
			});
		}
		expect(failed).toHaveBeenCalledTimes(2);
		// Without a listener as well.
		vi.mocked(api.serverPuzzles).mockResolvedValueOnce(true);
		vi.mocked(api.issuePuzzle).mockRejectedValueOnce(new Error('down'));
		expect(await new PuzzleSource(game).find(0, null)).toMatchObject({ source: 'local' });
	});

	it('fails when the puzzle cannot be made', async () => {
		vi.mocked(generate).mockRejectedValueOnce(new Error('boom'));
		await expect(new PuzzleSource(game).find(0, ID)).rejects.toThrow('boom');
	});
});
