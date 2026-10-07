import { bankPath, type PuzzleBank } from '../src/lib/core/bank';

/** Reads a file of the puzzle collection; null if there is none. */
export type BankLoader = (game: string, variant: string) => Promise<PuzzleBank | null>;

const cache = new Map<string, Promise<PuzzleBank | null>>();

/**
 * The collection as deployed with the static assets. Parsed files stay cached for the life of
 * the Worker instance, so only the first request per type pays for reading them.
 */
export function assetBank(assets: Pick<Fetcher, 'fetch'>): BankLoader {
	return (game, variant) => {
		const key = `${game}:${variant}`;
		let bank = cache.get(key);
		if (!bank) {
			bank = assets
				.fetch(new Request(`https://assets.local/${bankPath(game, variant)}`))
				.then((r) => (r.ok ? (r.json() as Promise<PuzzleBank>) : null));
			// Failures are not cached, so the next request tries again.
			bank.then((b) => b ?? cache.delete(key)).catch(() => cache.delete(key));
			cache.set(key, bank);
		}
		return bank;
	};
}
