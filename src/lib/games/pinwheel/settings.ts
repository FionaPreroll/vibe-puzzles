import { withCommon } from '../../core/settings';

export const PINWHEEL_SETTINGS = withCommon([
	{ key: 'showGrid', label: 'Show grid', default: true },
	{ key: 'continuousLine', label: 'Draw continuous line', default: true },
	{ key: 'symmetryHelper', label: 'Enable symmetry helper', default: true },
	{ key: 'blackHoles', label: 'Black hole in completed regions', default: false },
	{ key: 'autoColor', label: 'Auto color completed regions', default: false }
]);

export type PinwheelSettingKey = (typeof PINWHEEL_SETTINGS)[number]['key'];
