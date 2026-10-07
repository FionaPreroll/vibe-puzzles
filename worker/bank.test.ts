import { describe, expect, it, vi } from 'vitest';
import type { PuzzleBank } from '../src/lib/core/bank';
import { assetBank } from './bank';

const file: PuzzleBank = { version: 1, game: 'g', variant: 'v', puzzles: [{ id: 1, puzzle: {} }] };

describe('assetBank', () => {
	it('reads collection files from the static assets once', async () => {
		const fetch = vi.fn(async (req: Request) =>
			new URL(req.url).pathname === '/puzzles/g/v.json'
				? Response.json(file)
				: new Response('', { status: 404 })
		);
		const bank = assetBank({ fetch } as never);
		expect(await bank('g', 'v')).toEqual(file);
		expect(await bank('g', 'v')).toEqual(file);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(await bank('g', 'missing')).toBeNull();
	});

	it('tries again after a failure', async () => {
		const fetch = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(new Response('', { status: 500 }))
			.mockResolvedValue(Response.json(file));
		const bank = assetBank({ fetch } as never);
		await expect(bank('g', 'retry')).rejects.toThrow('offline');
		expect(await bank('g', 'retry')).toBeNull();
		expect(await bank('g', 'retry')).toEqual(file);
		expect(fetch).toHaveBeenCalledTimes(3);
	});
});
