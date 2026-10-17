import { translator } from '../../i18n/index.svelte';
import de from './de';
import en from './en';

/** Text of the Inside page for a dotted key, in the app's language (see `t`). */
export const ti = translator({ en, de });
