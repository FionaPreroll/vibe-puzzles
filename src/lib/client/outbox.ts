import { load, remove, save } from './storage';
import { KEY } from './storageKeys';

/**
 * Uploads that wait for the server: the newest version of each synced value (saved games and
 * settings, by their storage key) and solves that could not be submitted. Kept in storage, so a
 * game played offline reaches the server after a reload too.
 */

export interface PendingSave {
	data: unknown;
	updatedAt: number;
}

/** A solve to submit later; only solves whose time the device measured (no ticket). */
export interface PendingScore {
	game: string;
	variant: string;
	puzzleId: number;
	[field: string]: unknown;
}

interface Stored {
	saves: Record<string, PendingSave>;
	scores: PendingScore[];
}

/** Waiting solves kept at most; the oldest go first. Each solve is also in the local stats. */
export const MAX_SCORES = 200;

function read(): Stored {
	const s = load<Partial<Stored> | null>(KEY.outbox, null);
	return {
		saves: s?.saves && typeof s.saves === 'object' ? s.saves : {},
		scores: Array.isArray(s?.scores) ? s.scores : []
	};
}

/** False when storage is full: making room would remove games (and may ask the player first). */
function write(s: Stored): boolean {
	if (Object.keys(s.saves).length || s.scores.length) return save(KEY.outbox, s, false);
	remove(KEY.outbox);
	return true;
}

/**
 * Wait to upload `data` under `key`; an older version of it is replaced, a newer one kept. False
 * when storage is full, so the caller can try the upload right away instead.
 */
export function queueSave(key: string, data: unknown, updatedAt: number): boolean {
	const s = read();
	const old = s.saves[key];
	if (old && old.updatedAt > updatedAt) return true;
	s.saves[key] = { data, updatedAt };
	return write(s);
}

/** The upload of `key` went through: remove it, unless a newer version came in meanwhile. */
export function saveSent(key: string, updatedAt: number) {
	const s = read();
	if (s.saves[key]?.updatedAt !== updatedAt) return;
	delete s.saves[key];
	write(s);
}

const sameSolve = (a: PendingScore, b: PendingScore) =>
	a.game === b.game && a.variant === b.variant && a.puzzleId === b.puzzleId;

/** Wait to submit a solve; one per puzzle, the first one counts. False when storage is full. */
export function queueScore(score: PendingScore): boolean {
	const s = read();
	if (s.scores.some((o) => sameSolve(o, score))) return true;
	s.scores = [...s.scores, score].slice(-MAX_SCORES);
	return write(s);
}

export function scoreSent(score: PendingScore) {
	const s = read();
	s.scores = s.scores.filter((o) => !sameSolve(o, score));
	write(s);
}

/** Everything waiting, oldest solves first. */
export function pending(): { saves: [string, PendingSave][]; scores: PendingScore[] } {
	const s = read();
	return { saves: Object.entries(s.saves), scores: s.scores };
}

/** How many uploads wait. */
export function pendingCount(): number {
	const s = read();
	return Object.keys(s.saves).length + s.scores.length;
}

/** Forget everything waiting (sign out, another player, or no server). */
export function clearOutbox() {
	remove(KEY.outbox);
}
