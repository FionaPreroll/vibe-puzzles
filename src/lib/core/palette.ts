/**
 * Board colours for the light and the dark theme, in the classic and the Halloween look. Boards
 * never use colour literals: they take `colours.<name>`, a CSS variable that follows night mode
 * and the look. Screenshots and prints use the classic light theme (see `lightColours` and the
 * `board-light` class).
 */

const LIGHT = {
	/** Background of an empty cell. */
	surface: '#ffffff',
	/** Pinwheel's paper behind the grid. */
	paper: '#fffdf4',
	/** Given digits, cage labels and Pinwheel's black holes. */
	ink: '#111827',
	/** Region and box borders, the frame, Pinwheel's lines and centres. */
	line: '#111827',
	/** Thin lines between cells. */
	gridLine: '#4b5563',
	/** Pinwheel's dotted grid, frozen lines and locked centres. */
	faint: '#9ca3af',
	/** Pinwheel's dots. */
	dot: '#374151',
	/** Notes and coordinates. */
	label: '#4b5563',
	/** Digits the player entered, and notes of the selected digit. */
	entered: '#1d4ed8',
	/** The selected cell, and the symmetry helper in Pinwheel. */
	selection: '#fde68a',
	/** Cells holding the selected digit. */
	sameDigit: '#bfdbfe',
	/** Row, column and box of the selected cell. */
	unit: '#e5edf8',
	/** Tetroid: the region of the cell last touched. */
	block: '#dff3d6',
	/** Keyboard cursor. */
	cursor: '#b45309',
	/** Outline of the last change. */
	recent: '#2563eb',
	/** Marks set during a trial (lines, crosses, digits), until it is kept or discarded. */
	trial: '#115e59',
	/** Tetroid: a cell shaded during a trial. */
	trialShade: '#4f988f',
	/** Crosses, marking a cell or edge as empty. */
	cross: '#b91c1c',
	/** Wrong digits and cage labels. */
	error: '#b91c1c',
	/** Background of a cell with a wrong digit. */
	errorFill: '#fee2e2',
	/** `error` and `errorFill` with the setting "blue errors". */
	blueError: '#1e3a8a',
	blueErrorFill: '#dbeafe',
	/** Pinwheel: a cell in a broken galaxy, in red or blue. */
	errorCell: '#ef4444',
	blueErrorCell: '#60a5fa',
	/** Tetroid: a wrongly shaded cell, in red or blue. */
	errorShade: '#dc2626',
	blueErrorShade: '#3b82f6',
	/** Tetroid: shaded cells, plain, in the highlighted group, and by tetromino. */
	shaded: '#8c8c8c',
	group: '#8fa98a',
	tetrominoL: '#f3a5a5',
	tetrominoI: '#9dd2f3',
	tetrominoT: '#c7a6ec',
	tetrominoS: '#a9e3a0',
	/** Pinwheel: the colours a player paints galaxies with. */
	note1: '#cdbaf2',
	note2: '#f6b4b4',
	note3: '#f7e48d',
	note4: '#bce6ad',
	note5: '#acd6f6',
	note6: '#f5b9da',
	note7: '#d4d4d4',
	note8: '#b4ebda',
	note9: '#f9d1a8',
	/** Pipes: the water in pipes joined to the source, a locked tile, and the source. */
	water: '#4f8fe8',
	locked: '#e4e2df',
	source: '#c62828',
	/** Pipes: the "=" a player marks on a side where a pipe joins two tiles ("x" is a `cross`). */
	joinMark: '#1d4ed8',
	/** Pinwheel's centres in the Halloween look: pumpkins, lit by a candle once complete. */
	pumpkin: '#f97316',
	pumpkinShade: '#ea580c',
	stem: '#4d7c0f',
	pumpkinFace: '#7c2d12',
	candle: '#facc15'
};

export type ColourName = keyof typeof LIGHT;
export type Palette = Record<ColourName, string>;

/** Dark board, a little lighter than the page, with light ink and deeper, muted fills. */
const DARK: Palette = {
	surface: '#1c1917',
	paper: '#1c1917',
	ink: '#e7e5e4',
	// Lines dimmer than the digits: bright lines glare on a dark board at night.
	line: '#b5afa9',
	gridLine: '#8a847e',
	faint: '#57534e',
	dot: '#b5afa9',
	label: '#c4beb9',
	entered: '#93c5fd',
	selection: '#713f12',
	sameDigit: '#1e3a8a',
	unit: '#292f3a',
	block: '#1f3a28',
	cursor: '#fbbf24',
	recent: '#60a5fa',
	trial: '#5eead4',
	trialShade: '#2b716a',
	cross: '#fca5a5',
	error: '#fca5a5',
	errorFill: '#4c0519',
	blueError: '#dbeafe',
	blueErrorFill: '#1e40af',
	errorCell: '#a81b1b',
	blueErrorCell: '#1d4ed8',
	errorShade: '#cb2222',
	blueErrorShade: '#235fe2',
	shaded: '#6e6763',
	group: '#53704e',
	tetrominoL: '#985656',
	tetrominoI: '#436d8a',
	tetrominoT: '#765c9d',
	tetrominoS: '#4b7245',
	note1: '#4c3a75',
	note2: '#7a3535',
	note3: '#6b5a14',
	note4: '#365e2d',
	note5: '#2c5277',
	note6: '#76345a',
	note7: '#4a4a4a',
	note8: '#22614f',
	note9: '#7a4a1f',
	water: '#2563eb',
	locked: '#3a3532',
	source: '#ef4444',
	joinMark: '#93c5fd',
	pumpkin: '#ea580c',
	pumpkinShade: '#c2410c',
	stem: '#65a30d',
	pumpkinFace: '#431407',
	candle: '#fde047'
};

/** Halloween by day: aubergine ink on white, purple for the player's digits, orange highlights. */
const HALLOWEEN_LIGHT: Palette = {
	...LIGHT,
	paper: '#fff9f0',
	ink: '#2a1b3d',
	line: '#2a1b3d',
	gridLine: '#6b5876',
	faint: '#b9a6c9',
	dot: '#4e3d5e',
	label: '#6b5876',
	entered: '#6d28d9',
	selection: '#fed7aa',
	sameDigit: '#e9d5ff',
	unit: '#fff1e3',
	cursor: '#c2410c',
	recent: '#7c3aed'
};

/** Halloween by night: a violet night board, ember digits and highlights. */
const HALLOWEEN_DARK: Palette = {
	...DARK,
	surface: '#1b1528',
	paper: '#1b1528',
	ink: '#f4effb',
	line: '#b8aecb',
	gridLine: '#6e6482',
	faint: '#4e4366',
	dot: '#b8aecb',
	label: '#c4b9d6',
	entered: '#fdba74',
	selection: '#5a3512',
	sameDigit: '#3a2b66',
	unit: '#241c36',
	recent: '#b79cff'
};

/** Christmas draft A, "Winter wonderland": navy ink on snow, ice blue highlights. */
const SNOW_LIGHT: Palette = {
	...LIGHT,
	paper: '#f6fafe',
	ink: '#12263d',
	line: '#12263d',
	gridLine: '#5b7088',
	faint: '#a9bccf',
	dot: '#34495f',
	label: '#455d77',
	entered: '#1660a8',
	selection: '#bfe1f8',
	sameDigit: '#d7e6fb',
	unit: '#edf4fb',
	cursor: '#0b6e99',
	recent: '#2a7bd3'
};

/** Christmas draft A by night: a polar night board, ice cyan digits. */
const SNOW_DARK: Palette = {
	...DARK,
	surface: '#0f1d30',
	paper: '#0f1d30',
	ink: '#eef5fc',
	line: '#a8bdd3',
	gridLine: '#5f7591',
	faint: '#34485f',
	dot: '#a8bdd3',
	label: '#bccde0',
	entered: '#8fe3f5',
	selection: '#1d4a63',
	sameDigit: '#263f6b',
	unit: '#16273d',
	cursor: '#a7f3d0',
	recent: '#7dd3fc',
	trialShade: '#2e786f'
};

/** Christmas draft B, "Christmas market": fir green digits on cream, gold highlights. */
const MARKET_LIGHT: Palette = {
	...LIGHT,
	surface: '#fffdf8',
	paper: '#fdf6ea',
	ink: '#1d2b22',
	line: '#1d2b22',
	gridLine: '#5f6b5f',
	faint: '#b8b09c',
	dot: '#3a4a3e',
	label: '#5a6656',
	entered: '#17663a',
	selection: '#f9dc8c',
	sameDigit: '#d9eedb',
	unit: '#fbf1e1',
	cursor: '#9a3412',
	recent: '#a16207'
};

/** Christmas draft B by night: a fir green board, gold digits. */
const MARKET_DARK: Palette = {
	...DARK,
	surface: '#11231a',
	paper: '#11231a',
	ink: '#fbf4e4',
	line: '#d6cdb4',
	gridLine: '#6f7d6c',
	faint: '#3c4d40',
	dot: '#d6cdb4',
	label: '#d3cab4',
	entered: '#f5c451',
	selection: '#5c2121',
	sameDigit: '#24452f',
	unit: '#182d21',
	cursor: '#fbbf24',
	recent: '#e9b949',
	shaded: '#7d766f',
	errorShade: '#d42a2a',
	blueErrorShade: '#2f6ae6',
	trialShade: '#2e786f'
};

/** Christmas draft C, "Nordic Christmas": charcoal on white, pine green digits. */
const NORDIC_LIGHT: Palette = {
	...LIGHT,
	paper: '#faf7f2',
	ink: '#262626',
	line: '#262626',
	gridLine: '#6b6661',
	faint: '#bdb5ab',
	dot: '#45403b',
	label: '#625c55',
	entered: '#2f5d4a',
	selection: '#f3d9c9',
	sameDigit: '#dbe8df',
	unit: '#f5f1ea',
	cursor: '#a33a32',
	recent: '#b4553a'
};

/** Christmas draft C by night: a warm dark board, candle amber digits. */
const NORDIC_DARK: Palette = {
	...DARK,
	surface: '#1d1916',
	paper: '#1d1916',
	ink: '#f3ece2',
	line: '#bfb4a6',
	gridLine: '#7b7166',
	faint: '#4a423a',
	dot: '#bfb4a6',
	label: '#cdc2b4',
	entered: '#f0b866',
	selection: '#4a2e1c',
	sameDigit: '#2f3d33',
	unit: '#26211d',
	cursor: '#fbbf24',
	recent: '#f0b866'
};

export const PALETTES = {
	light: LIGHT,
	dark: DARK,
	halloweenLight: HALLOWEEN_LIGHT,
	halloweenDark: HALLOWEEN_DARK,
	snowLight: SNOW_LIGHT,
	snowDark: SNOW_DARK,
	marketLight: MARKET_LIGHT,
	marketDark: MARKET_DARK,
	nordicLight: NORDIC_LIGHT,
	nordicDark: NORDIC_DARK
} satisfies Record<string, Palette>;

const NAMES = Object.keys(LIGHT) as ColourName[];

const variable = (name: ColourName) =>
	`--board-${name.replace(/[A-Z0-9]/g, (ch) => '-' + ch.toLowerCase())}`;

/** What boards put in fill and stroke attributes: `var(--board-…)`, following night mode. */
export const colours = Object.fromEntries(
	NAMES.map((name) => [name, `var(${variable(name)})`])
) as Palette;

const declarations = (palette: Palette) =>
	NAMES.map((name) => `${variable(name)}:${palette[name]};`).join('');

/**
 * The CSS variables: dark when the page has the `dark` class, light otherwise, in the Halloween
 * colours when it has `data-theme="halloween"`, and always classic light inside an element with
 * the class `board-light` (the printed board).
 */
export function paletteCss(): string {
	const looks: [string, Palette, Palette][] = [
		['halloween', HALLOWEEN_LIGHT, HALLOWEEN_DARK],
		['snow', SNOW_LIGHT, SNOW_DARK],
		['market', MARKET_LIGHT, MARKET_DARK],
		['nordic', NORDIC_LIGHT, NORDIC_DARK]
	];
	return (
		`:root,.board-light{${declarations(LIGHT)}}` +
		`:root.dark{${declarations(DARK)}}` +
		looks
			.map(([look, light, dark]) => {
				const root = `:root[data-theme="${look}"]`;
				return `${root}{${declarations(light)}}${root}.dark{${declarations(dark)}}`;
			})
			.join('') +
		`:root.dark .board-light,:root[data-theme] .board-light{${declarations(LIGHT)}}`
	);
}

/** Replaces the colour variables in serialised board markup with the light colours. */
export function lightColours(markup: string): string {
	return markup.replace(/var\(--board-([a-z0-9-]+)\)/g, (match, name: string) => {
		const key = name.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
		return (LIGHT as Record<string, string>)[key] ?? match;
	});
}

/** WCAG contrast ratio of two `#rrggbb` colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
	const luminance = (hex: string) => {
		const [r, g, b] = [1, 3, 5].map((k) => {
			const c = parseInt(hex.slice(k, k + 2), 16) / 255;
			return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}
