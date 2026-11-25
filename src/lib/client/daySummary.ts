import { formatDuration } from '../core/time';
import { isPlayable, type Variant } from '../core/variants';
import { t, variantLabel } from '../i18n/index.svelte';
import { getStats, type RecentSolve } from './stats';

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

/** At most this many solves are named one by one in the shared text; the rest are counted. */
export const SHARED_LINES = 10;

/** Local midnight of `now`'s day, in epoch ms. */
export function startOfDay(now: Date): number {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** The puzzles solved today (since local midnight) in `games`, the first solved first. */
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

/** One solve as a line of the shared text, e.g. "🧩 Sudoku 9×9 Normal: 06:12". */
export function solveLine(s: DaySolve): string {
	return t(s.hinted ? 'today.lineHinted' : 'today.line', {
		icon: s.game.icon,
		game: s.game.name,
		variant: variantLabel(s.variant),
		time: formatDuration(s.timeMs, true)
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
	const lines = solves.slice(0, SHARED_LINES).map(solveLine);
	const more = solves.length - lines.length;
	if (more > 0) lines.push(t('today.more', { count: more }));
	const text = [head, ...lines, t('today.invite')].join('\n');
	return { title: `${t('today.title')} · ${t('app.name')}`, text, url };
}
