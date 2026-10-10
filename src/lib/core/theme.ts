/** The site's looks: the everyday one and seasonal ones. Night mode applies to each of them. */
export const LOOKS = ['classic', 'halloween'] as const;
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
