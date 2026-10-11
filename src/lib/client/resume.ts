import { isPlayable, periodKey } from '../core/variants';
import { gameLogic } from '../games/logic';
import { hasProgress, type SavedGame } from './session/saves';
import { keys, load } from './storage';
import { parseSaveKey, SAVE_PREFIX } from './storageKeys';

/**
 * The most recently played game that the home page offers to continue: unsolved, with at least
 * one move or checkpoint, and reachable from its puzzle type. A daily, weekly or monthly special
 * counts only in its own period, since the link opens the current one; an older one stays saved
 * for the archive but is no longer "started".
 */
export function latestUnfinished(now = new Date()): { gameId: string; save: SavedGame } | null {
	let best: { gameId: string; save: SavedGame } | null = null;
	for (const key of keys(SAVE_PREFIX)) {
		const slot = parseSaveKey(key);
		if (!slot) continue;
		const { game: gameId, variant: variantKey, period } = slot;
		const logic = gameLogic(gameId);
		const variant = logic?.variants.find((v) => v.key === variantKey);
		const save = load<SavedGame | null>(key, null);
		if (!logic || !isPlayable(variant) || !save || save.solved || save.variant !== variantKey)
			continue;
		if (variant.special && period !== periodKey(variant.special, now)) continue;
		if (!logic.isValidPuzzle(save.puzzle, variant)) continue;
		try {
			if (!hasProgress(logic, { ...save, solved: false })) continue;
		} catch {
			continue;
		}
		if (!best || save.updatedAt > best.save.updatedAt) best = { gameId, save };
	}
	return best;
}
