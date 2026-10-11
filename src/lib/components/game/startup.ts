import type { GameSession, OpenOptions } from '../../client/session.svelte';
import { message } from '../../client/session/messages';
import { freeSaveSpace } from '../../client/session/saves';
import { load, save, setQuotaHandler } from '../../client/storage';
import { tutorialDoneKey, tutorialSeenKey } from '../../client/storageKeys';
import { decodePuzzleId, parsePlayableId, type Variant } from '../../core/variants';
import { t } from '../../i18n/index.svelte';

/**
 * Whether the game page opens the game's tutorial instead: on the very first visit of a game that
 * has one, without a link to a puzzle, unless the tutorial was solved already. Counts the visit.
 */
export function firstVisitTutorial(
	gameId: string,
	hasTutorial: boolean,
	params: URLSearchParams
): boolean {
	if (!hasTutorial || params.size !== 0 || load<boolean>(tutorialSeenKey(gameId), false)) {
		return false;
	}
	save(tutorialSeenKey(gameId), true);
	return !load<boolean>(tutorialDoneKey(gameId), false);
}

type LinkSession = Pick<GameSession, 'replacesGame' | 'open' | 'message' | 'variant'>;

/**
 * Open what the page's address asks for: `v` a puzzle type, `id` a puzzle, `s` a shared position.
 * A link that would replace an unfinished game of its type asks first (`askReplace`), and opens
 * that game if the player says no. Returns whether the address should become the plain type's
 * (it held a puzzle, a position, or a type that cannot be played).
 */
export async function openFromAddress(
	session: LinkSession,
	variants: Variant[],
	params: URLSearchParams,
	askReplace: () => Promise<boolean>
): Promise<boolean> {
	const id = parsePlayableId(params.get('id'), variants);
	let variantKey = params.get('v') ?? variants[0].key;
	let opts: OpenOptions = { puzzleId: id, shared: params.get('s') ?? undefined };
	// A link must not silently take the place of an unfinished game of its type.
	if (id && session.replacesGame(variantKey, opts) && !(await askReplace())) {
		variantKey = variants[decodePuzzleId(id).variantIndex]?.key ?? variantKey;
		opts = {};
	}
	await session.open(variantKey, opts);
	if (params.has('id') && !id && !session.message) {
		session.message = message('error', () => t('game.unknownId'));
	}
	return params.has('s') || params.has('id') || session.variant.key !== variantKey;
}

/**
 * When storage is full, make room: solved games go first; unfinished ones only if the player
 * agrees (`ask`, asked once per page). The write that ran out of room fails while the question is
 * open; once the player agrees, the game is saved again (`flush`), which makes the room.
 */
export function freeSpaceWhenFull(
	session: Pick<GameSession, 'slot' | 'flush'>,
	ask: () => Promise<boolean>
) {
	let agreed: boolean | null = null;
	let asked = false;
	setQuotaHandler(() =>
		freeSaveSpace(session.slot, () => {
			if (!asked) {
				asked = true;
				ask().then((ok) => {
					agreed = ok;
					if (ok) session.flush();
				});
			}
			return agreed === true;
		})
	);
}
