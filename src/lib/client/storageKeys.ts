/**
 * Every key the app stores values under (`storage.ts` adds the `vp:` prefix), built and parsed
 * here only. Keys are `<kind>:<part>:…`; game IDs, puzzle type keys, periods and modes contain no
 * colon. Saved games and settings sync to the server under the same keys, and backups keep them,
 * so a changed format needs a migration.
 */

/** Keys of values that exist once. */
export const KEY = {
	player: 'player',
	night: 'night',
	look: 'look',
	touch: 'touch',
	puzzleSource: 'puzzleSource',
	rulesHidden: 'rulesHidden'
} as const;

/** The start of every `saveKey`, to list the saved games. */
export const SAVE_PREFIX = 'save:';

const ARCHIVE = 'archive';

/** Where a game is saved: each puzzle type keeps one game, a special type one per period. */
export interface SaveSlot {
	game: string;
	variant: string;
	/** The period of a special type's current puzzle, e.g. `2026-10-07` or `2026-W41`. */
	period?: string;
	/** An older puzzle of a special type, opened from the archive. */
	archive?: boolean;
}

/** `save:<game>:<variant>[:<period>|:archive]`. A period wins over `archive`. */
export function saveKey({ game, variant, period, archive }: SaveSlot): string {
	const slot = period ?? (archive ? ARCHIVE : undefined);
	return `${SAVE_PREFIX}${game}:${variant}${slot ? `:${slot}` : ''}`;
}

/** The slot of a `saveKey`, or null for any other key. */
export function parseSaveKey(key: string): SaveSlot | null {
	const [kind, game, variant, slot, ...rest] = key.split(':');
	if (`${kind}:` !== SAVE_PREFIX || !game || !variant || slot === '' || rest.length) return null;
	if (slot === undefined) return { game, variant };
	return slot === ARCHIVE ? { game, variant, archive: true } : { game, variant, period: slot };
}

/** `stats:<game>:<variant>`: solves, streaks and times of a puzzle type. */
export const statsKey = (game: string, variant: string) => `stats:${game}:${variant}`;

/** `bankPlayed:<game>:<variant>`: the collection puzzles of a type played on this device. */
export const bankPlayedKey = (game: string, variant: string) => `bankPlayed:${game}:${variant}`;

/**
 * `boardZoom:<game>:<variant>`: zoom relative to the fitted board. Not `zoom:`, under which older
 * versions stored an absolute zoom that would blow up the board now.
 */
export const boardZoomKey = (game: string, variant: string) => `boardZoom:${game}:${variant}`;

/** `settings:<game>`: the game's settings (`GameSettings`). */
export const settingsKey = (game: string) => `settings:${game}`;

/** `tool:<game>`: the tool picked last. */
export const toolKey = (game: string) => `tool:${game}`;

/** `tutorialSeen:<game>`: the first visit, which opens the tutorial, is over. */
export const tutorialSeenKey = (game: string) => `tutorialSeen:${game}`;

/** `tutorialDone:<game>[:<mode>]`: the game's tutorial, or a mode's, was solved. */
export const tutorialDoneKey = (game: string, mode?: string) =>
	`tutorialDone:${game}${mode ? `:${mode}` : ''}`;
