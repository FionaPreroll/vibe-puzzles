import { describe, expect, it } from 'vitest';
import { generateTetroid } from '../../games/tetroid/generator';
import { CROSS, EMPTY, SHADED, type TetroidState } from '../../games/tetroid/rules';
import { i18n } from '../../i18n/index.svelte';
import { Timeline } from '../film';
import { ti } from '../i18n';
import { TETROID_SEED, TETROID_TYPE, tetroidFilm } from './tetroid';

const film = tetroidFilm();
const [plant, grow, reshape, solve] = film.chapters;
const { puzzle, solution } = generateTetroid(6, 6, 'normal', TETROID_SEED);
const keys = (chapter: typeof plant) => chapter.frames.map((f) => f.caption.key);
const shaded = (s: TetroidState) => s.marks.filter((m) => m === SHADED).length;

describe('the Tetroid film', () => {
	it('has four chapters on the Tetroid board, coloured by shape', () => {
		expect(film.game).toBe('tetroid');
		expect(film.settings).toMatchObject({ highlightErrors: false, colorTetrominoes: true });
		expect(film.chapters.map((c) => c.title)).toEqual([
			'tetroid.chapters.plant',
			'tetroid.chapters.grow',
			'tetroid.chapters.reshape',
			'tetroid.chapters.solve'
		]);
	});

	it('plants tetrominoes one by one on an empty board, each a region of its own', () => {
		const plants = plant.frames.filter((f) => f.caption.key === 'tetroid.plant.plant');
		expect(shaded(plant.frames[0].state)).toBe(0);
		plants.forEach((f, k) => {
			expect(shaded(f.state)).toBe(4 * (k + 1));
			expect(f.spotlight).toHaveLength(4);
			// The new tetromino's cells share a region; the cells without one are regions of one.
			const regions = new Set(f.spotlight!.map((c) => f.puzzle.regions[+c]));
			expect(regions.size).toBe(1);
		});
		const free = plant.frames.at(-1)!.puzzle.regions.filter((r) => r >= 36);
		expect(new Set(free).size).toBe(free.length);
	});

	it('grows regions until every cell has one, tinting the region a cell joins', () => {
		for (const f of grow.frames.slice(0, -1)) {
			expect(f.area).toContain(f.spotlight![0]);
		}
		expect(grow.frames.at(-1)!.puzzle.regions.every((r) => r < 36)).toBe(true);
	});

	it('reshapes the regions until deduction settles them, and ends on the puzzle', () => {
		const captions = keys(reshape);
		for (const key of ['alternative', 'move', 'replant', 'alone', 'stuck', 'logicalMove']) {
			expect(captions).toContain(`tetroid.reshape.${key}`);
		}
		expect(captions.at(-1)).toBe('tetroid.reshape.unique');
		const alternative = reshape.frames.find(
			(f) => f.caption.key === 'tetroid.reshape.alternative'
		)!;
		// The other tetromino in teal, inside the tinted region.
		expect(alternative.trial).toHaveLength(4);
		for (const c of alternative.trial!) {
			expect(alternative.area).toContain(c);
			expect(alternative.state.marks[+c]).toBe(SHADED);
		}
		const stuck = reshape.frames.find((f) => f.caption.key === 'tetroid.reshape.stuck')!;
		expect(stuck.area!.length).toBeGreaterThan(0);
		expect(stuck.detail?.key).toBe('tetroid.reshape.logicalDetail');
		const end = reshape.frames.at(-1)!;
		expect(end.puzzle.regions).toEqual(puzzle.regions);
		expect(end.state.marks).toEqual(solution.map((s) => (s ? SHADED : EMPTY)));
	});

	it('solves the puzzle by deduction, pass by pass', () => {
		const [start] = solve.frames;
		expect(start.caption.key).toBe('tetroid.solve.start');
		expect(start.spotlight).toBeUndefined();
		const rules = keys(solve);
		expect(rules).toContain('tetroid.solve.shapes');
		expect(rules).toContain('tetroid.solve.lookAhead');
		for (const f of solve.frames.slice(1, -1)) {
			expect(f.spotlight).toHaveLength(Number(f.caption.params!.count));
		}
		const end = solve.frames.at(-1)!;
		expect(end.caption.key).toBe('tetroid.solve.done');
		expect(end.state.marks).toEqual(solution.map((s) => (s ? SHADED : CROSS)));
	});

	it('makes an 8×8 puzzle the same way', () => {
		const big = tetroidFilm(1, { ...TETROID_TYPE, width: 8, height: 8 });
		expect(big.chapters[0].frames[0].caption.params).toEqual({ size: 8 });
		const end = big.chapters[2].frames.at(-1)!;
		const made = generateTetroid(8, 8, 'normal', 1);
		expect(end.puzzle).toEqual(made.puzzle);
		expect(big.chapters[3].frames.at(-1)!.state.marks).toEqual(
			made.solution.map((s) => (s ? SHADED : CROSS))
		);
	});

	it('says how many attempts a puzzle took, and is the same for the same seed', () => {
		expect(keys(reshape)).not.toContain('tetroid.reshape.attempts');
		const retried = tetroidFilm(3).chapters[2].frames.at(-1)!;
		expect(retried.caption).toEqual({ key: 'tetroid.reshape.attempts', params: { attempt: 2 } });
		expect(tetroidFilm(TETROID_SEED)).toEqual(film);
	});

	it('has every text it says in both languages, with its values', () => {
		const big = tetroidFilm(1, { ...TETROID_TYPE, width: 8, height: 8 });
		const frames = [film, tetroidFilm(3), big].flatMap((f) => new Timeline(f).frames);
		const captions = frames.flatMap((f) => [f.caption, ...(f.detail ? [f.detail] : [])]);
		try {
			for (const locale of ['en', 'de'] as const) {
				i18n.locale = locale;
				for (const title of film.chapters.map((c) => c.title)) expect(ti(title)).not.toBe(title);
				for (const { key, params } of captions) {
					const text = ti(key, params);
					expect(text, key).not.toBe(key);
					expect(text, key).not.toMatch(/\{\w+\}/);
				}
			}
		} finally {
			i18n.locale = 'en';
		}
	});
});
