import sizes from '../static/puzzles/sizes.json';
import { Collection } from '../src/lib/core/bank';

let shared: { assets: Pick<Fetcher, 'fetch'>; collection: Collection } | null = null;

/**
 * The collection as deployed with the static assets; the sizes of its types are bundled with the
 * Worker. The Worker instance keeps the most recently used files (an index or a chunk of 100
 * puzzles each), so memory stays bounded however large the collection grows.
 */
export function assetCollection(assets: Pick<Fetcher, 'fetch'>): Collection {
	if (shared?.assets !== assets) {
		const collection = new Collection(
			(path) =>
				assets
					.fetch(new Request(`https://assets.local/${path}`))
					.then((r) => (r.ok ? r.json() : null)),
			sizes,
			32
		);
		shared = { assets, collection };
	}
	return shared.collection;
}
