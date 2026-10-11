import type { Question } from '../../client/confirm.svelte';
import { t } from '../../i18n/index.svelte';

/** A question of the game page, from the `confirm.<key>` texts. */
export function question(
	key: string,
	danger = false,
	values: Record<string, number> = {}
): Question {
	return {
		title: t(`confirm.${key}.title`, values),
		text: t(`confirm.${key}.text`, values),
		confirm: t(`confirm.${key}.ok`, values),
		danger
	};
}
