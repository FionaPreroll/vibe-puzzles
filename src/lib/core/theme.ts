/** The site's looks: the everyday one and seasonal ones. Night mode applies to each of them. */
export const LOOKS = ['classic', 'halloween', 'snow', 'market', 'nordic'] as const;
/** Drafts of a Christmas look (christmas.css), to choose one from. */
export const CHRISTMAS_DRAFTS = ['snow', 'market', 'nordic'] as const;
export type Look = (typeof LOOKS)[number];

/** What the player picks: a look, or 'auto' for the one the calendar suggests. */
export type LookChoice = 'auto' | Look;
export const LOOK_CHOICES: readonly LookChoice[] = ['auto', ...LOOKS];

export const isLookChoice = (value: unknown): value is LookChoice =>
	LOOK_CHOICES.includes(value as LookChoice);

/**
 * The look the calendar suggests: Halloween from 1 October to 1 November inclusive, in local
 * time; app.html applies the same rule before the first paint.
 */
export function seasonalLook(now: Date): Look {
	const month = now.getMonth();
	return month === 9 || (month === 10 && now.getDate() === 1) ? 'halloween' : 'classic';
}

export const resolveLook = (choice: LookChoice, now: Date): Look =>
	choice === 'auto' ? seasonalLook(now) : choice;

/**
 * The candles burning on the Advent wreath (draft C): one for each Sunday of Advent so far, all
 * four from the fourth Sunday until 6 January, none before Advent.
 */
export function adventCandles(now: Date): number {
	if (now.getMonth() === 0) return now.getDate() <= 6 ? 4 : 0;
	const year = now.getFullYear();
	const fourth = new Date(year, 11, 24 - new Date(year, 11, 24).getDay());
	const first = new Date(year, 11, fourth.getDate() - 21);
	if (now < first) return 0;
	return Math.min(4, 1 + Math.floor((now.getTime() - first.getTime()) / (7 * 86_400_000)));
}
