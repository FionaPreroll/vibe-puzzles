import { periodKey, type SpecialKind } from '../core/variants';
import { load, save } from './storage';

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
	/** Special types: consecutive periods (days, weeks, months) solved. */
	periodStreak?: number;
}

/** The period before the current one, e.g. yesterday for daily puzzles. */
export function previousPeriod(kind: SpecialKind, now = new Date()): string {
	const d = new Date(now);
	if (kind === 'daily') d.setUTCDate(d.getUTCDate() - 1);
	else if (kind === 'weekly') d.setUTCDate(d.getUTCDate() - 7);
	else d.setUTCDate(0);
	return periodKey(kind, d);
}

/** Consecutive periods solved up to now; 0 once a period was missed. */
export function currentPeriodStreak(s: VariantStats, kind: SpecialKind): number {
	if (!s.lastPeriod) return 0;
	const alive = s.lastPeriod === periodKey(kind) || s.lastPeriod === previousPeriod(kind);
	return alive ? (s.periodStreak ?? 1) : 0;
}

const empty = (): VariantStats => ({
	solved: 0,
	streak: 0,
	bestStreak: 0,
	bestMs: null,
	totalMs: 0,
	recent: []
});

const key = (game: string, variant: string) => `stats:${game}:${variant}`;

export function getStats(game: string, variant: string): VariantStats {
	return { ...empty(), ...load<Partial<VariantStats>>(key(game, variant), {}) };
}

export function recordSolve(
	game: string,
	variant: string,
	puzzleId: number,
	timeMs: number,
	period?: string,
	kind?: SpecialKind
): VariantStats {
	const s = getStats(game, variant);
	s.solved++;
	s.streak++;
	s.bestStreak = Math.max(s.bestStreak, s.streak);
	s.bestMs = s.bestMs == null ? timeMs : Math.min(s.bestMs, timeMs);
	s.totalMs += timeMs;
	s.recent = [{ puzzleId, timeMs, at: Date.now() }, ...s.recent].slice(0, 20);
	if (period && s.lastPeriod !== period) {
		const continues = kind && s.lastPeriod === previousPeriod(kind);
		s.periodStreak = continues ? (s.periodStreak ?? 1) + 1 : 1;
		s.lastPeriod = period;
	}
	save(key(game, variant), s);
	return s;
}

/** Abandoning an unsolved puzzle with progress breaks the streak. */
export function breakStreak(game: string, variant: string) {
	const s = getStats(game, variant);
	if (s.streak === 0) return;
	s.streak = 0;
	save(key(game, variant), s);
}
