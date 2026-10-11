import type { Variant } from '../core/variants';
import { currentPlayer, pullSave, pushSave } from './api';
import { mergePeriods } from './stats';
import { periodsKey } from './storageKeys';

/** What the server keeps under `periodsKey`. */
interface StoredPeriods {
	periods: string[];
}

/**
 * Bring the periods a signed-in player solved of a special type in step with the server: the
 * server's are added to this device's, and the server gets what only this device had. Each
 * device keeps its own statistics; only the periods are shared, so that a streak goes on from
 * whichever device the player solves on.
 */
export async function syncPeriods(game: string, variant: Variant): Promise<void> {
	const kind = variant.special;
	if (!kind || !currentPlayer()) return;
	const key = periodsKey(game, variant.key);
	const remote = await pullSave<Partial<StoredPeriods>>(key);
	const theirs = Array.isArray(remote?.data.periods)
		? remote.data.periods.filter((p): p is string => typeof p === 'string')
		: [];
	const all = mergePeriods(game, variant.key, kind, theirs);
	// Their list may hold periods this device does not count (malformed, beyond the limit).
	if (all.some((p) => !theirs.includes(p))) {
		await pushSave(key, { periods: all } satisfies StoredPeriods, Date.now());
	}
}

/** `syncPeriods` for every special type of a game. */
export function syncGamePeriods(game: string, variants: readonly Variant[]): Promise<unknown> {
	return Promise.all(variants.filter((v) => v.special).map((v) => syncPeriods(game, v)));
}
