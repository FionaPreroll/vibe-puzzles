import { asset } from '$app/paths';
import type { AssetPath } from '$app/types';
import sizes from '../../../static/puzzles/sizes.json';
import { Collection, MAX_PER_TYPE, type BankEntry } from '../core/bank';
import type { Variant } from '../core/variants';
import { load, save } from './storage';
import { bankPlayedKey, KEY } from './storageKeys';

/** Where new puzzles come from: generated on this device, the collection, or either at random. */
export type PuzzleSource = 'local' | 'bank' | 'mixed';

export const PUZZLE_SOURCES: PuzzleSource[] = ['local', 'bank', 'mixed'];

export function loadPuzzleSource(): PuzzleSource {
	const value = load<string>(KEY.puzzleSource, 'mixed');
	return PUZZLE_SOURCES.includes(value as PuzzleSource) ? (value as PuzzleSource) : 'mixed';
}

export function savePuzzleSource(source: PuzzleSource) {
	save(KEY.puzzleSource, source);
}

/**
 * The collection as deployed with the app. A missing file, or no connection, counts as an empty
 * collection; the caller then generates the puzzle on the device.
 */
export const collection = new Collection(
	(path) =>
		fetch(asset(`/${path}` as AssetPath))
			.then((r) => (r.ok ? r.json() : null))
			.catch(() => null),
	sizes,
	8
);

/**
 * How many played collection puzzles are remembered per type: as many as a type can hold, so a
 * device sees no puzzle twice before it has played the whole type, and then generates new ones.
 * At the cap that is about 55 KB per type in localStorage, reached only after 5000 puzzles of it.
 */
const PLAYED = MAX_PER_TYPE;

/** A collection puzzle this device has not played yet, or null. */
export async function pickFromBank<P>(game: string, variant: string): Promise<BankEntry<P> | null> {
	const key = bankPlayedKey(game, variant);
	const played = new Set(load<number[]>(key, []));
	const pick = await collection.pick<P>(game, variant, (id) => played.has(id));
	if (pick) save(key, [...played, pick.id].slice(-PLAYED));
	return pick;
}

/** The stored definition of a collection puzzle, to skip generating it. */
export async function findInBank<P>(game: string, variant: Variant, id: number): Promise<P | null> {
	const entry = variant.special
		? await collection.special<P>(game, variant.key, variant.special)
		: await collection.find<P>(game, variant.key, id);
	return entry?.id === id ? entry.puzzle : null;
}
