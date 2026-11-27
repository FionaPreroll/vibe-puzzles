import { describe, expect, it } from 'vitest';
import de from '../../i18n/de';
import en from '../../i18n/en';
import { generatePixels } from './generator';
import { lineSteps, pixelsHint, solutionOf, type PixelsHint } from './hint';
import { pixels } from './index';
import { CROSS, EMPTY, FILLED, puzzleOf, type PixelsPuzzle, type PixelsState } from './rules';
import { PixelsSolver } from './solver';

const picture = (...rows: string[]) => Array.from(rows.join(''), (ch) => (ch === '#' ? 1 : 0));
const board = (...rows: string[]): PixelsPuzzle =>
	puzzleOf(rows[0].length, rows.length, picture(...rows));
/** Marks from text: `#` filled, `x` crossed, `.` not marked. */
const marks = (text: string) =>
	Array.from(text, (ch) => (ch === '#' ? FILLED : ch === 'x' ? CROSS : EMPTY));
const empty = (p: PixelsPuzzle): PixelsState => ({
	cells: new Array(p.width * p.height).fill(EMPTY)
});

/** See pixels.test.ts: two pictures fit, and none fits. */
const DIAGONAL = board('#.', '.#');
const NO_PICTURE: PixelsPuzzle = {
	width: 4,
	height: 4,
	rows: [[1, 1], [1], [1, 1], [2]],
	cols: [[1, 1], [1, 1], [1], [2]]
};

/** Follows the hints from `s` while they give steps; every hint on the way goes to `seen`. */
function follow(p: PixelsPuzzle, s: PixelsState, seen: (h: PixelsHint, s: PixelsState) => void) {
	for (let n = 0; n <= s.cells.length; n++) {
		const h = pixelsHint(p, s);
		if (!h) break;
		seen(h, s);
		if (h.kind !== 'step') break;
		s = { cells: s.cells.map((m, c) => (h.cells.includes(c) ? h.value : m)) };
	}
	return s;
}

/** The steps a line of one row gives from its marks, by technique and value. */
function steps(clue: number[], text: string) {
	const p: PixelsPuzzle = { width: text.length, height: 1, rows: [clue], cols: [] };
	const res = lineSteps(new PixelsSolver(p), Uint8Array.from(marks(text)), 0);
	return res && { cells: Object.fromEntries(res.cells), blocks: [...res.blocks] };
}

const lookup = (dict: object, key: string) =>
	key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], dict);

describe('pixels hints', () => {
	it('lead from the empty board to the picture, a correct step at a time', () => {
		const techniques = new Set<string>();
		for (const [size, difficulty, seeds] of [
			[5, 'normal', [1, 2]],
			[10, 'normal', [1, 2, 3]],
			[5, 'hard', [1, 2]],
			[10, 'hard', [1, 2]]
		] as const) {
			for (const seed of seeds) {
				const { puzzle, solution } = generatePixels(size, size, difficulty, seed);
				const end = follow(puzzle, empty(puzzle), (h, s) => {
					expect(h.kind, `${size} ${difficulty} ${seed}`).toBe('step');
					if (h.kind !== 'step') return;
					techniques.add(h.technique);
					expect(h.cells.length).toBeGreaterThan(0);
					for (const c of h.cells) {
						expect(s.cells[c]).toBe(EMPTY);
						expect(solution[c] ? FILLED : CROSS).toBe(h.value);
					}
				});
				expect(end.cells).toEqual(solution.map((v) => (v ? FILLED : CROSS)));
				expect(pixelsHint(puzzle, end)).toBeNull();
				expect(pixels.hint!(puzzle, end)).toBeNull();
			}
		}
		expect([...techniques].sort()).toEqual(
			['assumption', 'done', 'line', 'overlap', 'reach', 'zero'].sort()
		);
	});

	it('name each cell a line decides by the simplest reason', () => {
		expect(steps([3], '.....')).toEqual({ cells: { 'overlap:1': [2] }, blocks: [0] });
		expect(steps([2, 2], '......')).toEqual({ cells: { 'overlap:1': [1, 4] }, blocks: [0, 1] });
		expect(steps([2], '.#...')).toEqual({ cells: { 'reach:2': [3, 4] }, blocks: [] });
		// The 2s lie at 0 and 3, or at 3 and 6: cell 4 is filled either way, by one or the other.
		expect(steps([2, 2], '..x#....')).toEqual({
			cells: { 'line:1': [4], 'line:2': [5] },
			blocks: []
		});
		expect(steps([1], '.#...')).toEqual({ cells: { 'done:2': [0, 2, 3, 4] }, blocks: [] });
		expect(steps([], '...')).toEqual({ cells: { 'zero:2': [0, 1, 2] }, blocks: [] });
		expect(steps([2], '#x.')).toBeNull();
	});

	it('point out marks that do not match the picture first', () => {
		const p = board('##.', '...', '.##');
		const s = { cells: marks('#x.' + '#..' + '..#') };
		expect(pixelsHint(p, s)).toEqual({ kind: 'mistake', cells: [1, 3] });
		expect(pixels.hint!(p, s)).toEqual({
			kind: 'mistake',
			spotlight: ['1', '3'],
			text: ['games.pixels.hints.mistake']
		});
	});

	it('try a cell where no line decides one, and name the line that breaks', () => {
		const { puzzle, solution } = generatePixels(5, 5, 'hard', 1);
		const solver = new PixelsSolver(puzzle);
		let tried = 0;
		follow(puzzle, empty(puzzle), (h, s) => {
			if (h.kind !== 'step' || h.technique !== 'assumption') return;
			tried++;
			const [cell] = h.cells;
			expect(solution[cell] ? FILLED : CROSS).toBe(h.value);
			const other = h.value === FILLED ? CROSS : FILLED;
			const scratch = new Uint8Array(s.cells.length);
			expect(solver.tryCell(Uint8Array.from(s.cells), cell, other, scratch)).toBe(false);
			expect(solver.broken).toBe(h.line);
			const hint = pixels.hint!(puzzle, s)!;
			expect(hint.teaser).toEqual(['games.pixels.hints.assumeLook']);
			expect(hint.text[0]).toMatch(/^games\.pixels\.hints\.assume(Filled|Empty)(Row|Col)$/);
			expect(hint.text[1]).toMatch(/^games\.pixels\.hints\.then(Fill|Cross)1$/);
			expect(hint.area).toEqual([String(cell), h.line < 5 ? `r:${h.line}` : `c:${h.line - 5}`]);
		});
		expect(tried).toBeGreaterThan(0);
	});

	it('say so where no rule decides a cell', () => {
		expect(pixelsHint(DIAGONAL, empty(DIAGONAL))).toEqual({ kind: 'stuck', cells: [0] });
		expect(pixelsHint(NO_PICTURE, empty(NO_PICTURE))).toEqual({ kind: 'stuck', cells: [0] });
		expect(solutionOf(NO_PICTURE)).toBeNull();
		expect(pixels.hint!(DIAGONAL, { cells: [FILLED, EMPTY, EMPTY, EMPTY] })).toEqual({
			kind: 'step',
			spotlight: ['1'],
			area: ['0', '1', 'r:0'],
			teaser: ['games.pixels.hints.lookRow1', 'games.pixels.hints.doneLook'],
			text: [
				'games.pixels.hints.lookRow1',
				'games.pixels.hints.done',
				'games.pixels.hints.thenCross1'
			],
			params: { n: 1, clue: '1', len: 0 }
		});
	});

	it('word a line step from where to look to the cells', () => {
		// Row 1 has its 3 in the middle; the columns' 1s and 0s follow.
		const p = board('.###.', '.....');
		expect(pixels.hint!(p, empty(p))).toEqual({
			kind: 'step',
			spotlight: ['2'],
			area: ['0', '1', '2', '3', '4', 'r:0'],
			teaser: ['games.pixels.hints.lookRow1', 'games.pixels.hints.overlapLook1'],
			text: [
				'games.pixels.hints.lookRow1',
				'games.pixels.hints.overlap',
				'games.pixels.hints.thenFill1'
			],
			params: { n: 1, clue: '3', len: 3 }
		});
		// Two blocks, each with a cell of its own.
		const two = board('##.##.', '......');
		expect(pixels.hint!(two, empty(two))).toMatchObject({
			spotlight: ['1', '4'],
			area: ['0', '1', '2', '3', '4', '5', 'r:0'],
			teaser: ['games.pixels.hints.lookRow', 'games.pixels.hints.overlapLook'],
			text: [
				'games.pixels.hints.lookRow',
				'games.pixels.hints.overlapMany',
				'games.pixels.hints.thenFill'
			],
			params: { n: 1, clue: '2 2', len: 0 }
		});
		const zero = board('...', '.#.', '...');
		expect(pixels.hint!(zero, empty(zero))).toMatchObject({
			spotlight: ['0', '1', '2'],
			teaser: ['games.pixels.hints.lookRow1', 'games.pixels.hints.zeroLook'],
			text: [
				'games.pixels.hints.lookRow1',
				'games.pixels.hints.zero',
				'games.pixels.hints.thenCross'
			],
			params: { n: 1, clue: '0' }
		});
	});

	it('word each technique by its reason', () => {
		const reasons = new Map<string, Set<string>>();
		for (const [difficulty, seed] of [
			['normal', 1],
			['normal', 2],
			['hard', 1],
			// Fills a cell that one block or another covers, at step 34.
			['hard', 8]
		] as const) {
			const { puzzle } = generatePixels(10, 10, difficulty, seed);
			follow(puzzle, empty(puzzle), (h, at) => {
				if (h.kind !== 'step' || h.technique === 'assumption') return;
				const hint = pixels.hint!(puzzle, at)!;
				const one = (h.line < 10 ? puzzle.rows[h.line] : puzzle.cols[h.line - 10]).length <= 1;
				const at1 = one && ['overlap', 'reach', 'line'].includes(h.technique) ? '1' : '';
				expect(hint.teaser![1]).toBe(`games.pixels.hints.${h.technique}Look${at1}`);
				expect(hint.text[0]).toBe(hint.teaser![0]);
				const reason = hint.text[1].replace('games.pixels.hints.', '');
				reasons.set(h.technique, (reasons.get(h.technique) ?? new Set()).add(reason));
			});
		}
		expect(Object.fromEntries([...reasons].map(([k, v]) => [k, [...v].sort()]))).toEqual({
			overlap: ['overlap', 'overlapMany'],
			done: ['done'],
			zero: ['zero'],
			reach: ['reach'],
			line: ['lineCross', 'lineFill']
		});
	});

	it('come with texts in every language, first where to look, then the cells', () => {
		const keys = new Set<string>();
		const kinds = new Set<string>();
		const collect = (p: PixelsPuzzle, s: PixelsState) =>
			follow(p, s, (_, at) => {
				const hint = pixels.hint!(p, at)!;
				kinds.add(hint.kind);
				for (const key of [...hint.text, ...(hint.teaser ?? [])]) keys.add(key);
				if (hint.kind === 'step') {
					expect(hint.text.at(-1)).toMatch(/^games\.pixels\.hints\.then(Fill|Cross)1?$/);
				}
			});
		for (const [difficulty, seed] of [
			['normal', 1],
			['hard', 1],
			['hard', 2]
		] as const) {
			const { puzzle } = generatePixels(10, 10, difficulty, seed);
			collect(puzzle, empty(puzzle));
		}
		collect(DIAGONAL, { cells: [CROSS, EMPTY, EMPTY, EMPTY] });
		collect(DIAGONAL, empty(DIAGONAL));
		expect([...kinds].sort()).toEqual(['mistake', 'step', 'stuck']);
		for (const key of Object.keys(en.games.pixels.hints)) keys.add(`games.pixels.hints.${key}`);
		for (const key of keys) {
			expect(lookup(en, key), key).toBeTypeOf('string');
			expect(lookup(de, key), key).toBeTypeOf('string');
		}
		expect(Object.keys(de.games.pixels.hints).sort()).toEqual(
			Object.keys(en.games.pixels.hints).sort()
		);
	});
});
