import { withCommon } from '../../core/settings';

export const PIPES_SETTINGS = withCommon([
	{ key: 'showWater', label: 'Show the water', default: true },
	{ key: 'animateRotation', label: 'Animate turning tiles', default: true }
]);

export type PipesSettingKey = (typeof PIPES_SETTINGS)[number]['key'];
