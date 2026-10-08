import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colours, contrast, lightColours, paletteCss, PALETTES, type ColourName } from './palette';

/** Text needs 4.5:1 against what it sits on (WCAG AA), lines and marks 3:1. */
const TEXT: [ColourName, ColourName[]][] = [
	['ink', ['surface', 'selection', 'sameDigit', 'unit', 'errorFill', 'blueErrorFill']],
	['entered', ['surface', 'selection', 'sameDigit', 'unit']],
	['label', ['surface', 'paper', 'selection', 'unit']],
	['error', ['surface', 'errorFill', 'unit', 'selection']],
	['blueError', ['surface', 'blueErrorFill', 'unit', 'selection']]
];
const NOTES = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `note${n}` as ColourName);
const SHADES: ColourName[] = [
	'shaded',
	'group',
	'errorShade',
	'blueErrorShade',
	'tetrominoL',
	'tetrominoI',
	'tetrominoT',
	'tetrominoS'
];
const MARKS: [ColourName, ColourName[]][] = [
	['ink', ['paper', 'faint', ...NOTES, 'errorCell', 'blueErrorCell', ...SHADES]],
	['dot', ['paper', ...NOTES]],
	['cross', ['surface', 'paper', ...NOTES]],
	['shaded', ['surface']],
	['surface', ['errorShade', 'blueErrorShade']],
	['recent', ['surface', 'paper']],
	['cursor', ['surface', 'paper']]
];

describe('board palette', () => {
	for (const [theme, palette] of Object.entries(PALETTES)) {
		it(`${theme}: text and marks stand out from their background`, () => {
			for (const [minimum, pairs] of [
				[4.5, TEXT],
				[3, MARKS]
			] as const) {
				for (const [front, backs] of pairs) {
					for (const back of backs) {
						const ratio = contrast(palette[front], palette[back]);
						expect(ratio, `${front} on ${back}`).toBeGreaterThanOrEqual(minimum);
					}
				}
			}
		});
	}

	it('defines every colour in both themes as a CSS variable', () => {
		const css = paletteCss();
		for (const [name, value] of Object.entries(colours)) {
			const variable = value.slice(4, -1);
			expect(css.split(`${variable}:`).length, name).toBe(4);
		}
		expect(css).toContain(':root.dark{--board-surface:#1c1917;');
	});

	it('puts the light colours into board markup', () => {
		const markup = `<rect fill="${colours.errorFill}" stroke="${colours.tetrominoL}"/>`;
		expect(lightColours(markup)).toBe('<rect fill="#fee2e2" stroke="#f3a5a5"/>');
		expect(lightColours(`<g fill="${colours.note9}"/>`)).toBe('<g fill="#f9d1a8"/>');
		expect(lightColours('fill="var(--other)"')).toBe('fill="var(--other)"');
	});

	it('measures contrast as WCAG does', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
		expect(contrast('#ffffff', '#ffffff')).toBe(1);
		expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
	});
});

describe('boards', () => {
	it('take every colour from the palette', () => {
		for (const game of readdirSync('src/lib/games', { withFileTypes: true })) {
			if (!game.isDirectory()) continue;
			const source = readFileSync(`src/lib/games/${game.name}/Board.svelte`, 'utf8');
			expect(source.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi), game.name).toBeNull();
		}
	});
});
