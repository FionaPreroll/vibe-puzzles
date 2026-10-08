import { periodKey } from '../core/variants';
import { GAME_LOGIC } from '../games/logic';
import type { SavedGame } from './session.svelte';
import { keys, load } from './storage';

/**
 * The most recently played game that the home page offers to continue: unsolved, with at least
 * one move or checkpoint, and reachable from its puzzle type. A daily, weekly or monthly special
 * counts only in its own period, since the link opens the current one; an older one stays saved
 * for the archive but is no longer "started".
 */
export function latestUnfinished(now = new Date()): { gameId: string; save: SavedGame } | null {
	let best: { gameId: string; save: SavedGame } | null = null;
	for (const key of keys('save:')) {
		const [, gameId, variantKey, period] = key.split(':');
		const logic = GAME_LOGIC[gameId];
		const variant = logic?.variants.find((v) => v.key === variantKey);
		const save = load<SavedGame | null>(key, null);
		if (!logic || !variant || !save || save.solved || save.variant !== variantKey) continue;
		if (variant.special && period !== periodKey(variant.special, now)) continue;
		try {
			const started =
				save.checkpoints?.length > 0 ||
				JSON.stringify(save.state) !== JSON.stringify(logic.emptyState(save.puzzle));
			if (!started) continue;
		} catch {
			continue;
		}
		if (!best || save.updatedAt > best.save.updatedAt) best = { gameId, save };
	}
	return best;
}
