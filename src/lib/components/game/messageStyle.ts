import type { Message } from '../../client/session/messages';

/** The colours of a message by its kind, in the top bar and in the phones' toast. */
export function messageClass(kind: Message['kind']): string {
	if (kind === 'success')
		return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200';
	if (kind === 'error') return 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200';
	return 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200';
}
