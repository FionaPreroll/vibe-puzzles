/** The site's looks: the everyday one and seasonal ones. Night mode applies to each of them. */
export const LOOKS = ['classic', 'halloween', 'winter', 'christmas'] as const;
export type Look = (typeof LOOKS)[number];

/** What the player picks: a look, or 'auto' for the one the calendar suggests. */
export type LookChoice = 'auto' | Look;
export const LOOK_CHOICES: readonly LookChoice[] = ['auto', ...LOOKS];

export const isLookChoice = (value: unknown): value is LookChoice =>
	LOOK_CHOICES.includes(value as LookChoice);

/**
 * The look the calendar suggests, in local time: Halloween from 1 October to 1 November, the
 * winter wonderland for the rest of November, the Christmas market from 1 to 27 December, and
 * the winter wonderland again from 28 December to the end of January. app.html applies the same
 * rule before the first paint.
 */
export function seasonalLook(now: Date): Look {
	const month = now.getMonth();
	const day = now.getDate();
	if (month === 9 || (month === 10 && day === 1)) return 'halloween';
	if (month === 11 && day <= 27) return 'christmas';
	if (month === 10 || month === 11 || month === 0) return 'winter';
	return 'classic';
}

export const resolveLook = (choice: LookChoice, now: Date): Look =>
	choice === 'auto' ? seasonalLook(now) : choice;
