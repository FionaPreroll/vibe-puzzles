import { encodePuzzleId, periodKey, specialSeed, type SpecialKind } from './variants';

/**
 * The puzzle collection: pre-generated puzzles in `static/puzzles/<game>/<variant>.json`, grown
 * by a scheduled GitHub workflow (scripts/grow-puzzle-bank.ts). Each entry is checked for a
 * unique solution before it is added, and again by the tests. Special types (daily, weekly,
 * monthly) hold the puzzle of each period ahead of time, tagged with the period key.
 */
export interface PuzzleBank<P = unknown> {
	version: 1;
	game: string;
	variant: string;
	puzzles: BankEntry<P>[];
}

export interface BankEntry<P = unknown> {
	id: number;
	puzzle: P;
	/** Special types only: the period this puzzle belongs to, e.g. 2026-10-07. */
	period?: string;
}

export const bankPath = (game: string, variant: string) => `puzzles/${game}/${variant}.json`;

/** How far ahead the collection holds special puzzles, in periods. */
export const SPECIAL_PERIODS_AHEAD: Record<SpecialKind, number> = {
	daily: 400,
	weekly: 60,
	monthly: 14
};

/** Keys of `count` consecutive periods of a special type, starting with the one of `from`. */
export function upcomingPeriods(kind: SpecialKind, count: number, from = new Date()): string[] {
	const keys: string[] = [];
	const day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
	while (keys.length < count) {
		const key = periodKey(kind, day);
		if (keys[keys.length - 1] !== key) keys.push(key);
		if (kind === 'monthly') day.setUTCMonth(day.getUTCMonth() + 1, 1);
		else day.setUTCDate(day.getUTCDate() + (kind === 'weekly' ? 7 : 1));
	}
	return keys;
}

/** ID of the puzzle every player gets for a special period. */
export const specialPuzzleId = (
	game: string,
	variantIndex: number,
	kind: SpecialKind,
	period: string
) => encodePuzzleId(variantIndex, specialSeed(game, kind, period));
