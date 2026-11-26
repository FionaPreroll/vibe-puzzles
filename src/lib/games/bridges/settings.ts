import { withCommon } from '../../core/settings';

export const BRIDGES_SETTINGS = withCommon([
	{ key: 'dimSatisfied', label: 'Grey out islands that have all their bridges', default: true },
	{ key: 'showGroup', label: 'Tint the islands joined to your last bridge', default: true }
]);

export type BridgesSettingKey = (typeof BRIDGES_SETTINGS)[number]['key'];
