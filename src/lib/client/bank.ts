import { asset } from '$app/paths';
import type { AssetPath } from '$app/types';
import { bankPath, type PuzzleBank } from '../core/bank';
import { load, save } from './storage';

/** Where new puzzles come from: generated on this device, the collection, or either at random. */
export type PuzzleSource = 'local' | 'bank' | 'mixed';

export const PUZZLE_SOURCES: PuzzleSource[] = ['local', 'bank', 'mixed'];

export function loadPuzzleSource(): PuzzleSource {
	const value = load<string>('puzzleSource', 'mixed');
	return PUZZLE_SOURCES.includes(value as PuzzleSource) ? (value as PuzzleSource) : 'mixed';
}

export function savePuzzleSource(source: PuzzleSource) {
	save('puzzleSource', source);
}

const banks = new Map<string, Promise<PuzzleBank | null>>();

export function loadBank<P>(game: string, variant: string): Promise<PuzzleBank<P> | null> {
	const key = `${game}:${variant}`;
	let bank = banks.get(key);
	if (!bank) {
		bank = fetch(asset(`/${bankPath(game, variant)}` as AssetPath))
			.then((r) => (r.ok ? (r.json() as Promise<PuzzleBank>) : null))
			.catch(() => null);
		banks.set(key, bank);
	}
	return bank as Promise<PuzzleBank<P> | null>;
}

/** A collection puzzle this device has not played yet, or null. */
export async function pickFromBank<P>(
	game: string,
	variant: string
): Promise<{ id: number; puzzle: P } | null> {
	const bank = await loadBank<P>(game, variant);
	if (!bank?.puzzles.length) return null;
	const played = new Set(load<number[]>(`bankPlayed:${game}:${variant}`, []));
	const fresh = bank.puzzles.filter((p) => !played.has(p.id));
	if (!fresh.length) return null;
	const pick = fresh[Math.floor(Math.random() * fresh.length)];
	save(`bankPlayed:${game}:${variant}`, [...played, pick.id].slice(-2000));
	return pick;
}

/** The stored definition of a collection puzzle, to skip generating it. */
export async function findInBank<P>(game: string, variant: string, id: number): Promise<P | null> {
	const bank = await loadBank<P>(game, variant);
	return bank?.puzzles.find((p) => p.id === id)?.puzzle ?? null;
}
