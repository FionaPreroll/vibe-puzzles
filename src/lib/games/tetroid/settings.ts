import { withCommon } from '../../core/settings';

export const TETROID_SETTINGS = withCommon([
	{ key: 'highlightBlock', label: 'Highlight current block', default: false },
	{ key: 'highlightGroup', label: 'Highlight current group of cells [Shift]', default: false },
	{ key: 'thickBorders', label: 'Thicker block borders', default: false },
	{ key: 'colorTetrominoes', label: 'Color tetrominoes', default: false },
	{ key: 'autoCrossCorners', label: 'Auto place X on corners', default: false },
	{ key: 'autoCrossRegions', label: 'Auto place X in completed regions', default: false }
]);

export type TetroidSettingKey = (typeof TETROID_SETTINGS)[number]['key'];
