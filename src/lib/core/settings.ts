import type { SettingInfo } from './types';

/**
 * A list of settings whose keys become a type (`K`), so that reading a setting that is not in
 * the list does not compile. `requires` may name a key of the list.
 */
export function defineSettings<K extends string>(list: SettingInfo<K>[]): SettingInfo<K>[] {
	return list;
}

/** Settings shared by every game, in dialog order. Games add their own after `highlightErrors`. */
export const COMMON_SETTINGS = defineSettings([
	{ key: 'hideControls', label: 'Hide game controls', default: false, deviceOnly: true },
	{
		key: 'stickyToolbar',
		label: 'Keep toolbar and tools at the top while scrolling',
		default: false
	},
	{ key: 'autoSubmit', label: 'Auto submit', default: true },
	{ key: 'showCheckpoints', label: 'Show checkpoints', default: false },
	{ key: 'showCoordinates', label: 'Show board coordinates', default: false },
	{ key: 'hideTimer', label: 'Hide the timer', default: false },
	{ key: 'hideHint', label: 'Hide the hint button', default: false },
	{
		key: 'personalTimer',
		label: 'Non-competitive (personal) timer',
		default: false,
		requires: { key: 'hideTimer', value: false }
	},
	{ key: 'highlightErrors', label: 'Highlight errors', default: true },
	{
		key: 'blueErrors',
		label: 'Use blue for errors',
		default: false,
		requires: { key: 'highlightErrors', value: true }
	},
	{ key: 'highlightLastChange', label: 'Highlight last change', default: false },
	{ key: 'solvedAnimation', label: 'Animate a solved puzzle', default: true }
]);

export type CommonKey = (typeof COMMON_SETTINGS)[number]['key'];

/** A game's settings: the common ones, then its own (`K`), which may depend on common ones. */
export function withCommon<K extends string = never>(
	extra: SettingInfo<CommonKey | K>[]
): SettingInfo<CommonKey | K>[] {
	return [...COMMON_SETTINGS, ...extra];
}

/** A value for every setting of `list`: the one in `values`, else the default. */
export function settingValues<K extends string>(
	list: SettingInfo<K>[],
	values?: Partial<Record<string, boolean>> | null
): Record<K, boolean> {
	const out = {} as Record<K, boolean>;
	for (const s of list) {
		// Stored values may come from anywhere (another version, another device).
		const value = values && typeof values === 'object' ? values[s.key] : undefined;
		out[s.key] = typeof value === 'boolean' ? value : s.default;
	}
	return out;
}
