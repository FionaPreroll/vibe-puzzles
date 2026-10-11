import { periodKey, periodStart, type SpecialKind } from '../core/variants';
import { load, save } from './storage';
import { statsKey } from './storageKeys';

/** Per-device statistics for one game variant. */
export interface VariantStats {
	solved: number;
	/** Consecutive solves without abandoning a puzzle. */
	streak: number;
	bestStreak: number;
	bestMs: number | null;
	totalMs: number;
	/** Most recent solve times, newest first. */
	recent: { puzzleId: number; timeMs: number; at: number }[];
	/** Special types: the last period solved. */
	lastPeriod?: string;
	/**
	 * Special types, before `periods`: consecutive periods solved up to `lastPeriod`. Read into
	 * `periods` (see `solvedPeriods`), no longer written.
	 */
	periodStreak?: number;
	/**
	 * Special types: the periods (days, weeks, months) solved, oldest first, also on the player's
	 * other devices (see `syncPeriods`). The streak is counted from them.
	 */
	periods?: string[];
	/** IDs of the puzzles solved, so that solving one again does not count twice. */
	solvedIds?: number[];
}

/** How many solved puzzle IDs are remembered per type. */
const SOLVED_IDS = 2000;

/** How many solved periods are remembered per type: over a year of days. */
export const SOLVED_PERIODS = 400;

/** The period before the current one, e.g. yesterday for daily puzzles. */
export function previousPeriod(kind: SpecialKind, now = new Date()): string {
	const d = new Date(now);
	if (kind === 'daily') d.setUTCDate(d.getUTCDate() - 1);
	else if (kind === 'weekly') d.setUTCDate(d.getUTCDate() - 7);
	else d.setUTCDate(0);
	return periodKey(kind, d);
}

/** The period before the one with key `key`, or null for no such key. */
function periodBefore(kind: SpecialKind, key: string): string | null {
	const start = periodStart(kind, key);
	return start && previousPeriod(kind, start);
}

/**
 * The periods solved, oldest first. Statistics from before `periods` have only the last period
 * and the streak up to it: that streak's periods.
 */
export function solvedPeriods(s: VariantStats, kind: SpecialKind): string[] {
	if (s.periods) return s.periods;
	const periods: string[] = [];
	let key: string | null = s.lastPeriod ?? null;
	for (let n = s.periodStreak ?? 1; key && n > 0 && periods.length < SOLVED_PERIODS; n--) {
		periods.unshift(key);
		key = periodBefore(kind, key);
	}
	return periods;
}

/** Consecutive periods solved up to now (or up to the last one, if now's is still open). */
export function currentPeriodStreak(s: VariantStats, kind: SpecialKind, now = new Date()): number {
	const solved = new Set(solvedPeriods(s, kind));
	let key: string | null = periodKey(kind, now);
	if (!solved.has(key)) key = previousPeriod(kind, now);
	let count = 0;
	for (; key && solved.has(key); count++) key = periodBefore(kind, key);
	return count;
}

const empty = (): VariantStats => ({
	solved: 0,
	streak: 0,
	bestStreak: 0,
	bestMs: null,
	totalMs: 0,
	recent: []
});

export function getStats(game: string, variant: string): VariantStats {
	return { ...empty(), ...load<Partial<VariantStats>>(statsKey(game, variant), {}) };
}

export function recordSolve(
	game: string,
	variant: string,
	puzzleId: number,
	timeMs: number,
	period?: string,
	kind?: SpecialKind,
	/** Solved with a hint: counts as solved, but its time is no record. */
	hinted = false
): VariantStats {
	const s = getStats(game, variant);
	// Starting over after a solve, or opening the same puzzle again, is no new solve. A server
	// puzzle has no ID (0) until it is solved; the server never issues it twice.
	if (puzzleId && s.solvedIds?.includes(puzzleId)) return s;
	rememberId(s, puzzleId);
	s.solved++;
	s.streak++;
	s.bestStreak = Math.max(s.bestStreak, s.streak);
	if (!hinted) s.bestMs = s.bestMs == null ? timeMs : Math.min(s.bestMs, timeMs);
	s.totalMs += timeMs;
	s.recent = [{ puzzleId, timeMs, at: Date.now() }, ...s.recent].slice(0, 20);
	if (period && kind) countPeriod(s, period, kind);
	save(statsKey(game, variant), s);
	return s;
}

/**
 * A special puzzle solved on another device: its period counts for the streak here, but its
 * solve and time belong to that device's statistics.
 */
export function notePeriodSolved(
	game: string,
	variant: string,
	puzzleId: number,
	period: string,
	kind: SpecialKind
) {
	const s = getStats(game, variant);
	if (solvedPeriods(s, kind).includes(period)) return;
	rememberId(s, puzzleId);
	countPeriod(s, period, kind);
	save(statsKey(game, variant), s);
}

/**
 * Add the periods solved on the player's other devices (`remote`, e.g. from the server) to those
 * of this device. Returns all of them, oldest first.
 */
export function mergePeriods(
	game: string,
	variant: string,
	kind: SpecialKind,
	remote: readonly string[]
): string[] {
	const s = getStats(game, variant);
	const local = solvedPeriods(s, kind);
	const merged = periodList([...local, ...remote.filter((key) => periodStart(kind, key))]);
	if (merged.length !== local.length || s.periods === undefined) {
		setPeriods(s, merged);
		save(statsKey(game, variant), s);
	}
	return merged;
}

/** Distinct periods, oldest first, at most `SOLVED_PERIODS` (the latest). */
function periodList(keys: string[]): string[] {
	return [...new Set(keys)].sort().slice(-SOLVED_PERIODS);
}

function setPeriods(s: VariantStats, periods: string[]) {
	s.periods = periods;
	s.lastPeriod = periods.at(-1);
	delete s.periodStreak;
}

function rememberId(s: VariantStats, puzzleId: number) {
	if (puzzleId) s.solvedIds = [...(s.solvedIds ?? []), puzzleId].slice(-SOLVED_IDS);
}

/** A period solved: one more in `periods`. */
function countPeriod(s: VariantStats, period: string, kind: SpecialKind) {
	setPeriods(s, periodList([...solvedPeriods(s, kind), period]));
}

/** Abandoning an unsolved puzzle with progress breaks the streak. */
export function breakStreak(game: string, variant: string) {
	const s = getStats(game, variant);
	if (s.streak === 0) return;
	s.streak = 0;
	save(statsKey(game, variant), s);
}
