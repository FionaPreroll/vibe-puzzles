import { describe, expect, it, vi } from 'vitest';
import { indexPath, layoutType } from '../src/lib/core/bank';
import { assetCollection } from './bank';

const files: Record<string, unknown> = layoutType('g', 'v', [{ id: 1, puzzle: { a: 1 } }]);

/** Static assets that serve `files`. */
const assets = () => ({
	fetch: vi.fn(async (req: Request) => {
		const file = files[new URL(req.url).pathname.slice(1)];
		return file ? Response.json(file) : new Response('', { status: 404 });
	})
});

describe('assetCollection', () => {
	it('reads collection files from the static assets, keeping them per instance', async () => {
		const a = assets();
		const collection = assetCollection(a as never);
		expect(await collection.find('g', 'v', 1)).toEqual({ id: 1, puzzle: { a: 1 } });
		expect(await collection.find('g', 'v', 1)).toEqual({ id: 1, puzzle: { a: 1 } });
		expect(a.fetch).toHaveBeenCalledTimes(2); // the index and one chunk
		expect(assetCollection(a as never)).toBe(collection);
		expect(await collection.index('g', 'missing')).toBeNull();
	});

	it('knows the size of every deployed type without loading an index', () => {
		const collection = assetCollection(assets() as never);
		expect(collection.size('tetroid', '6n')).toBeGreaterThan(0);
		expect(collection.size('tetroid', 'daily')).toBe(0);
	});

	it('starts over for other assets and tries a failed file again', async () => {
		const fetch = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue(Response.json(files[indexPath('g', 'v')]));
		const collection = assetCollection({ fetch } as never);
		await expect(collection.index('g', 'v')).rejects.toThrow('offline');
		expect(await collection.index('g', 'v')).toMatchObject({ chunks: [[1]] });
	});
});
