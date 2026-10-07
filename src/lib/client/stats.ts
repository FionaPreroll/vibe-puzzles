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
	period?: string
): VariantStats {
	const s = getStats(game, variant);
	s.solved++;
	s.streak++;
	s.bestStreak = Math.max(s.bestStreak, s.streak);
	s.bestMs = s.bestMs == null ? timeMs : Math.min(s.bestMs, timeMs);
	s.totalMs += timeMs;
	s.recent = [{ puzzleId, timeMs, at: Date.now() }, ...s.recent].slice(0, 20);
	if (period) s.lastPeriod = period;
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
