import { hashString } from './rng';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type SpecialKind = 'daily' | 'weekly' | 'monthly';

export interface Variant {
	/** Stable key, used in URLs, saves and leaderboards. */
	key: string;
	label: string;
	width: number;
	height: number;
	difficulty: Difficulty;
	special?: SpecialKind;
	/** A rule set other than the game's main one, e.g. 'calc' for Calcudoku in Sudoku. */
	mode?: string;
}

const SEED_SPACE = 1 << 26;
const VARIANT_SLOTS = 16;

/** Public puzzle ID: encodes the variant and the generator seed. */
export function encodePuzzleId(variantIndex: number, seed: number): number {
	return (seed % SEED_SPACE) * VARIANT_SLOTS + variantIndex;
}

export function decodePuzzleId(id: number): { variantIndex: number; seed: number } {
	return { variantIndex: id % VARIANT_SLOTS, seed: Math.floor(id / VARIANT_SLOTS) };
}

export function randomSeed(random: () => number = Math.random): number {
	return 1 + Math.floor(random() * (SEED_SPACE - 1));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO-8601 week key, e.g. 2026-W41 (UTC). */
function isoWeekKey(date: Date): string {
	const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const day = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - day);
	const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
	const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
	return `${d.getUTCFullYear()}-W${pad(week)}`;
}

/** Key of the current period of a special type, e.g. 2026-10-07, 2026-W41, 2026-10. */
export function periodKey(kind: SpecialKind, date = new Date()): string {
	const y = date.getUTCFullYear();
	const m = pad(date.getUTCMonth() + 1);
	if (kind === 'daily') return `${y}-${m}-${pad(date.getUTCDate())}`;
	if (kind === 'weekly') return isoWeekKey(date);
	return `${y}-${m}`;
}

/** When the next period of a special type starts (midnight UTC; weeks start on Monday). */
export function nextPeriodStart(kind: SpecialKind, date = new Date()): Date {
	const y = date.getUTCFullYear();
	const m = date.getUTCMonth();
	const d = date.getUTCDate();
	if (kind === 'daily') return new Date(Date.UTC(y, m, d + 1));
	if (kind === 'weekly') return new Date(Date.UTC(y, m, d + 8 - (date.getUTCDay() || 7)));
	return new Date(Date.UTC(y, m + 1, 1));
}

/** Approximate lifetime of a special period's save, in days. */
export const SPECIAL_RETENTION_DAYS: Record<SpecialKind, number> = {
	daily: 31,
	weekly: 77,
	monthly: 183
};

/** Seed of the puzzle that every player gets for a special period. */
export function specialSeed(gameId: string, kind: SpecialKind, period: string): number {
	return 1 + (hashString(`${gameId}:${kind}:${period}`) % (SEED_SPACE - 1));
}

/**
 * The regular type closest to a special one: same rules, then the same difficulty, then the
 * nearest size. "New puzzle" on a special type continues here.
 */
export function regularCounterpart(variants: Variant[], special: Variant): Variant | undefined {
	const regular = variants.filter((v) => !v.special && v.mode === special.mode);
	const area = (v: Variant) => v.width * v.height;
	const score = (v: Variant) => [
		v.difficulty === special.difficulty ? 0 : 1,
		Math.abs(area(v) - area(special))
	];
	return regular.sort((a, b) => {
		const [x, y] = [score(a), score(b)];
		return x[0] - y[0] || x[1] - y[1];
	})[0];
}
