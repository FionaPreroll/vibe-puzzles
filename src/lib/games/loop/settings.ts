import { withCommon } from '../../core/settings';

export const LOOP_SETTINGS = withCommon([
	{ key: 'continuousLine', label: 'Draw continuous line', default: true },
	{ key: 'dimSatisfiedClues', label: 'Grey out clues that have all their lines', default: false }
]);

export type LoopSettingKey = (typeof LOOP_SETTINGS)[number]['key'];
