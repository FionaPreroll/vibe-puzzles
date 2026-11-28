import { formatDuration } from '../core/time';
import { isPlayable, type Difficulty, type Variant } from '../core/variants';
import { t, variantLabel } from '../i18n/index.svelte';
import { getStats, startOfDay, type RecentSolve } from './stats';

export { startOfDay };

/**
 * The player's day: every puzzle solved on this device since local midnight, in all games, and the
 * text that shares it, e.g. to a messenger.
 */

/** What the day needs of a game. */
export interface DayGame {
	id: string;
	name: string;
	icon: string;
	variants: readonly Variant[];
}

/** A puzzle solved today. */
export interface DaySolve extends RecentSolve {
	game: DayGame;
	variant: Variant;
}

/** At most this many puzzle types are named one by one in the shared text; the rest are counted. */
export const SHARED_LINES = 10;

/**
 * The puzzles solved today (since local midnight) in `games`, the first solved first. The
 * statistics keep every solve of today (`keepRecent`), however many.
 */
export function solvesToday(
	games: readonly DayGame[],
	now = new Date(),
	stats: (game: string, variant: string) => { recent: RecentSolve[] } = getStats
): DaySolve[] {
	const from = startOfDay(now);
	const solves: DaySolve[] = [];
	for (const game of games) {
		for (const variant of game.variants.filter(isPlayable)) {
			for (const r of stats(game.id, variant.key).recent) {
				if (r.at >= from && r.at <= now.getTime()) solves.push({ ...r, game, variant });
			}
		}
	}
	return solves.sort((a, b) => a.at - b.at);
}

/** A puzzle type played today: how often, and its best time of the day. */
export interface DayType {
	game: DayGame;
	variant: Variant;
	/** Puzzles of this type solved today. */
	count: number;
	/** The fastest solve without hints, or the fastest one if every solve took hints. */
	bestMs: number;
	/** Every solve of the type today took hints, so `bestMs` did too. */
	hinted: boolean;
}

/** The hardest puzzles first. */
const DIFFICULTY_ORDER: Record<Difficulty, number> = { hard: 0, normal: 1, easy: 2 };

/**
 * The puzzle types played today, each with how often and its best time: the hardest first, and
 * within a difficulty the fastest first. Types solved only with hints have no best time, so they
 * come after the others of their difficulty.
 */
export function dayTypes(solves: readonly DaySolve[]): DayType[] {
	const types = new Map<string, DayType>();
	for (const s of solves) {
		const key = `${s.game.id}:${s.variant.key}`;
		const type = types.get(key);
		const hinted = !!s.hinted;
		if (!type) {
			types.set(key, { game: s.game, variant: s.variant, count: 1, bestMs: s.timeMs, hinted });
			continue;
		}
		type.count++;
		// A solve without hints beats one with hints, whatever their times.
		if (type.hinted && !hinted) Object.assign(type, { bestMs: s.timeMs, hinted });
		else if (type.hinted === hinted) type.bestMs = Math.min(type.bestMs, s.timeMs);
	}
	return [...types.values()].sort(
		(a, b) =>
			DIFFICULTY_ORDER[a.variant.difficulty] - DIFFICULTY_ORDER[b.variant.difficulty] ||
			Number(a.hinted) - Number(b.hinted) ||
			a.bestMs - b.bestMs
	);
}

/**
 * A puzzle type as a line of the shared text, e.g. "🧩 Sudoku 9×9 Normal: 06:12", or with more than
 * one solve "🧩 Sudoku 9×9 Normal: 3×, best 06:12".
 */
export function typeLine(type: DayType): string {
	const key = type.count === 1 ? 'today.line' : 'today.lineBest';
	return t(type.hinted ? `${key}Hinted` : key, {
		icon: type.game.icon,
		game: type.game.name,
		variant: variantLabel(type.variant),
		count: type.count,
		time: formatDuration(type.bestMs, true)
	});
}

/** The title, text and link that share the day's solves; `url` invites to play. */
export function dayShare(
	solves: readonly DaySolve[],
	url: string
): { title: string; text: string; url: string } {
	const totalMs = solves.reduce((sum, s) => sum + s.timeMs, 0);
	const head = t(solves.length === 1 ? 'today.shareOne' : 'today.shareMany', {
		count: solves.length,
		time: formatDuration(totalMs)
	});
	const types = dayTypes(solves);
	const lines = types.slice(0, SHARED_LINES).map(typeLine);
	const more = types.slice(SHARED_LINES).reduce((sum, type) => sum + type.count, 0);
	if (more > 0) lines.push(t('today.more', { count: more }));
	const text = [head, ...lines, t('today.invite')].join('\n');
	return { title: `${t('today.title')} · ${t('app.name')}`, text, url };
}
