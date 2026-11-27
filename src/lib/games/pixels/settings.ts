import { withCommon } from '../../core/settings';

export const PIXELS_SETTINGS = withCommon([
	{ key: 'dimDone', label: 'Grey out numbers whose blocks are in place', default: true },
	{ key: 'highlightLines', label: 'Highlight row and column', default: true }
]);

export type PixelsSettingKey = (typeof PIXELS_SETTINGS)[number]['key'];
