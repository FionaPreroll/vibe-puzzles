import { formatDuration } from '../../core/time';
import type { Variant } from '../../core/variants';
import { t, variantLabel } from '../../i18n/index.svelte';
import type { ScoreResult } from '../api';

export interface Message {
	kind: 'success' | 'error' | 'info';
	readonly text: string;
}

/**
 * A message whose text is made on each read, so a message already shown (such as "Solved in
 * 1:23!") follows a change of language.
 */
export function message(kind: Message['kind'], text: () => string): Message {
	return {
		kind,
		get text() {
			return text();
		}
	};
}

/** What the server's answer to a solve says, for a solve shown with time `shown`. */
export function scoreMessage(res: ScoreResult, shown: number, variant: Variant): Message {
	const kind = res.ok ? 'success' : res.code === 'expired' ? 'info' : 'error';
	return message(kind, () => scoreText(res, shown, variant));
}

function scoreText(res: ScoreResult, shown: number, variant: Variant): string {
	const time = formatDuration(res.timeMs ?? shown, true);
	switch (res.code) {
		case 'wrong':
			return t('session.wrong');
		case 'repeat':
			return t('session.repeat', { time });
		case 'personal':
			return t('session.unrankedPersonal', { time });
		case 'local':
			return t('session.unrankedLocal', { time });
		case 'hinted':
			return t('session.unrankedHinted', { time });
		case 'expired':
			return t('session.expired', { time });
		case 'ranked': {
			const text = t('session.ranked', {
				time,
				rank: res.rank ?? '–',
				total: res.total ?? '–',
				variant: variantLabel(variant)
			});
			const best = res.bestMs != null && res.bestMs < (res.timeMs ?? Infinity);
			return best
				? `${text} ${t('session.yourBest', { time: formatDuration(res.bestMs!, true) })}`
				: text;
		}
		default:
			return res.message;
	}
}
