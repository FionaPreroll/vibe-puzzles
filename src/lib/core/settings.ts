import type { SettingInfo } from './types';

/** Settings shared by every game, in dialog order. Games add their own after `highlightErrors`. */
export const COMMON_SETTINGS: SettingInfo[] = [
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
	{
		key: 'personalTimer',
		label: 'Non-competitive (personal) timer',
		default: false,
		requires: { key: 'hideTimer', value: false }
	},
	{ key: 'nightMode', label: 'Night mode', default: false },
	{ key: 'highlightErrors', label: 'Highlight errors', default: true },
	{
		key: 'blueErrors',
		label: 'Use blue for errors',
		default: false,
		requires: { key: 'highlightErrors', value: true }
	},
	{ key: 'highlightLastChange', label: 'Highlight last change', default: false },
	{ key: 'solvedAnimation', label: 'Animate a solved puzzle', default: true }
];

export function withCommon(extra: SettingInfo[]): SettingInfo[] {
	return [...COMMON_SETTINGS, ...extra];
}
