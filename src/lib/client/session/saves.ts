/**
 * Saved games: their format, how saves from older versions, other devices and backups are read,
 * which of two saves wins, and the housekeeping of all saves in storage.
 */
import { sameData } from '../../core/equal';
import type { BasePuzzle, GameLogic } from '../../core/types';
import {
	periodKey,
	SPECIAL_RETENTION_DAYS,
	type SpecialKind,
	type Variant
} from '../../core/variants';
import { keys, load, remove } from '../storage';
import { parseSaveKey, SAVE_PREFIX } from '../storageKeys';

/** The format version written now; `migrateSave` reads every earlier one. */
export const SAVE_VERSION = 1;

export interface SavedGame<S = unknown> {
	version: typeof SAVE_VERSION;
	puzzleId: number;
	variant: string;
	puzzle: unknown;
	state: S;
	checkpoints: S[];
	currentCheckpoint: number;
	solved: boolean;
	startedAt: number;
	playMs: number;
	updatedAt: number;
	/** Puzzle issued by the server (ranked); its ID is 0 until solved. */
	ticket?: string;
	/**
	 * A hint was shown: no best time, not ranked. Saves from before `hints` have only this, and
	 * `migrateSave` turns it into `hints`; still written for older versions in other tabs.
	 */
	hinted?: boolean;
	/** How many hints were shown. */
	hints?: number;
	/** A setting that counts as a hint was on during the game; it is one of `hints`. */
	assisted?: boolean;
	/** The position a running trial began from (see `GameSession.trial`). */
	trial?: S;
	/** When it was solved (epoch ms); a later save (a checkpoint, leaving the page) keeps it. */
	solvedAt?: number;
}

/** A save of a game this app can show: its puzzle and position are valid for the type. */
export type PlayableSave<P, S> = SavedGame<S> & { puzzle: P };

/**
 * A stored or received save in the current format, or null if it is none (not an object, from a
 * newer version, no time). Only the format: whether its puzzle and position are valid for a game
 * is `playableSave`'s question.
 */
export function migrateSave<S = unknown>(raw: unknown): SavedGame<S> | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const s = raw as Partial<SavedGame<S>> & { version?: unknown };
	// Every save so far is version 1; a newer one may mean anything.
	if (s.version !== undefined && s.version !== SAVE_VERSION) return null;
	if (!Number.isFinite(s.updatedAt)) return null;
	const hints = Number.isInteger(s.hints) && s.hints! >= 0 ? s.hints! : s.hinted ? 1 : 0;
	const current = Number.isInteger(s.currentCheckpoint) ? s.currentCheckpoint! : -1;
	return {
		...(s as SavedGame<S>),
		version: SAVE_VERSION,
		puzzleId: Number.isSafeInteger(s.puzzleId) ? s.puzzleId! : 0,
		checkpoints: Array.isArray(s.checkpoints) ? s.checkpoints : [],
		currentCheckpoint: current,
		solved: !!s.solved,
		startedAt: Number.isFinite(s.startedAt) ? s.startedAt! : Date.now(),
		playMs: Number.isFinite(s.playMs) ? Math.max(0, s.playMs!) : 0,
		...(typeof s.ticket === 'string' ? { ticket: s.ticket } : { ticket: undefined }),
		...(hints ? { hinted: true, hints } : { hinted: undefined, hints: undefined }),
		assisted: s.assisted ? true : undefined,
		solvedAt: s.solved && Number.isFinite(s.solvedAt) ? s.solvedAt : undefined
	};
}

/**
 * A save from storage, another device or a backup, as a game of `variant` can continue it:
 * migrated, its puzzle and position valid, broken checkpoints and trials left out.
 */
export function playableSave<P extends BasePuzzle, S>(
	game: Pick<GameLogic<P, S>, 'isValidPuzzle' | 'isValidState'>,
	variant: Variant,
	raw: unknown
): PlayableSave<P, S> | null {
	const s = migrateSave<S>(raw);
	if (!s || !game.isValidPuzzle(s.puzzle, variant)) return null;
	const puzzle = s.puzzle;
	if (!game.isValidState(puzzle, s.state)) return null;
	const checkpoints = s.checkpoints.filter((c) => game.isValidState(puzzle, c));
	return {
		...s,
		puzzle,
		checkpoints,
		currentCheckpoint: Math.max(-1, Math.min(s.currentCheckpoint, checkpoints.length - 1)),
		trial: game.isValidState(puzzle, s.trial) ? s.trial : undefined
	};
}

/** Whether a saved game is worth keeping over another one: any move, checkpoint or solve. */
export function hasProgress<P extends BasePuzzle, S>(
	game: Pick<GameLogic<P, S>, 'emptyState'>,
	save: Pick<SavedGame<S>, 'solved' | 'checkpoints' | 'state'> & { puzzle: unknown }
): boolean {
	if (save.solved || save.checkpoints?.length) return true;
	return !sameData(save.state, game.emptyState(save.puzzle as P));
}

/**
 * Whether a save from another device replaces the game in this slot (`local`, null if there is
 * none or it cannot be played), given which of the two have progress. A newer local game wins,
 * unless nobody has played it yet: then the other device's game continues here. A solved or
 * untouched remote game never replaces anything, nor does an older save of the same game.
 */
export function remoteWins<S>(
	local: SavedGame<S> | null,
	remote: SavedGame<S>,
	progress: (save: SavedGame<S>) => boolean
): boolean {
	if (local && remote.updatedAt <= local.updatedAt && progress(local)) return false;
	if (remote.solved || !progress(remote)) return false;
	// Server-issued puzzles keep their ID secret (0) until solved, so the ticket tells them apart.
	const same =
		!!local &&
		local.puzzleId === remote.puzzleId &&
		(local.ticket ?? null) === (remote.ticket ?? null);
	return !(same && remote.updatedAt <= local!.updatedAt);
}

// The housekeeping below reads saves as they are: it must not take a save from a newer version,
// which `migrateSave` cannot read, for a broken one.

/** Remove saves of special periods that are over. */
export function cleanupSpecialSaves(now = Date.now()) {
	for (const key of keys(SAVE_PREFIX)) {
		const slot = parseSaveKey(key);
		if (!slot?.period) continue;
		// Special types are keyed by their kind (`daily`, …).
		const days = SPECIAL_RETENTION_DAYS[slot.variant as SpecialKind];
		if (!days) continue;
		const saved = load<SavedGame | null>(key, null);
		if (!saved || now - saved.updatedAt > days * 86400000) remove(key);
	}
}

/** Whether a save key is the slot of a special type's current period (its puzzle of today, …). */
function currentPeriodSlot(key: string, now: Date): boolean {
	const slot = parseSaveKey(key);
	if (!slot?.period) return false;
	const kind = slot.variant as SpecialKind;
	return !!SPECIAL_RETENTION_DAYS[kind] && slot.period === periodKey(kind, now);
}

/**
 * Make room when storage is full, never touching `keep` (the game being played): first remove the
 * saves of solved games, which are never resumed, except the current special puzzles, which show
 * solved; then, once `agree` says so, the game that changed longest ago. Returns whether anything
 * was removed.
 */
export function freeSaveSpace(keep: string, agree: () => boolean, now = new Date()): boolean {
	const others = keys(SAVE_PREFIX)
		.filter((key) => key !== keep)
		.map((key) => ({ key, save: load<SavedGame | null>(key, null) }));
	const solved = others.filter(
		(o) => (!o.save || o.save.solved) && !(o.save && currentPeriodSlot(o.key, now))
	);
	if (solved.length) {
		for (const o of solved) remove(o.key);
		return true;
	}
	if (!others.length || !agree()) return false;
	const age = (o: (typeof others)[number]) => o.save?.updatedAt ?? 0;
	remove(others.reduce((oldest, o) => (age(o) < age(oldest) ? o : oldest)).key);
	return true;
}
