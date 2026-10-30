import { withCommon } from '../../core/settings';

export const PIPES_SETTINGS = withCommon([
	{ key: 'showWater', label: 'Show the water', default: true },
	{ key: 'animateRotation', label: 'Animate turning tiles', default: true },
	{ key: 'markErrors', label: 'Show tiles that cannot keep to their notes', default: true },
	{ key: 'turnToMarks', label: 'Turn tiles only into ways that fit their notes', default: true }
]);

export type PipesSettingKey = (typeof PIPES_SETTINGS)[number]['key'];
