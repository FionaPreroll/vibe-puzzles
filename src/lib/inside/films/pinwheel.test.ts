import { describe, expect, it } from 'vitest';
import { generatePinwheel } from '../../games/pinwheel/generator';
import {
	interiorEdges,
	hIndex,
	LINE,
	vIndex,
	type PinwheelState
} from '../../games/pinwheel/rules';
import { i18n } from '../../i18n/index.svelte';
import { Timeline } from '../film';
import { ti } from '../i18n';
import { PINWHEEL_SEED, pinwheelFilm } from './pinwheel';

const film = pinwheelFilm();
const [grow, unique, grade] = film.chapters;
const { puzzle, solution } = generatePinwheel(7, 7, 'hard', PINWHEEL_SEED);
const keys = (chapter: typeof grow) => chapter.frames.map((f) => f.caption.key);
const coloured = (s: PinwheelState) => s.colors.filter(Boolean).length;
const line = (s: PinwheelState, e: ReturnType<typeof interiorEdges>[number]) =>
	(e.kind === 'h' ? s.h[hIndex(puzzle, e.i, e.j)] : s.v[vIndex(puzzle, e.i, e.j)]) === LINE;

describe('the Pinwheel film', () => {
	it('has three chapters on the Pinwheel board, without its error colours', () => {
		expect(film.game).toBe('pinwheel');
		expect(film.settings).toMatchObject({ highlightErrors: false, autoColor: false });
		expect(film.chapters.map((c) => c.title)).toEqual([
			'pinwheel.chapters.grow',
			'pinwheel.chapters.unique',
			'pinwheel.chapters.grade'
		]);
	});

	it('grows galaxies from an empty board until every cell has one', () => {
		const [first] = grow.frames;
		expect(first.puzzle.centres).toEqual([]);
		expect(coloured(first.state)).toBe(0);
		expect(coloured(grow.frames.at(-1)!.state)).toBe(49);
		// Each new galaxy rings its centre; growing rings the centre and the two cells.
		const centre = grow.frames.find((f) => f.caption.key === 'pinwheel.grow.centre')!;
		expect(centre.spotlight).toEqual([`g:${centre.puzzle.centres.length - 1}`]);
		const grown = grow.frames.find((f) => f.caption.key === 'pinwheel.grow.grow')!;
		expect(grown.spotlight).toHaveLength(3);
		expect(keys(grow)).toContain('pinwheel.grow.absorb');
	});

	it('shows the second solution in teal, then the cut that removes it', () => {
		expect(keys(unique)).toEqual([
			'pinwheel.unique.start',
			'pinwheel.unique.second',
			'pinwheel.unique.cut',
			'pinwheel.unique.done'
		]);
		const [start, second, cut] = unique.frames;
		expect(second.trial!.length).toBeGreaterThan(0);
		// The teal lines are the other solution's, where the partition has none.
		for (const k of second.trial!) {
			const [kind, i, j] = k.split(':');
			const e = { kind: kind as 'h' | 'v', i: +i, j: +j, a: 0, b: 0 };
			expect(line(second.state, e)).toBe(true);
			expect(line(start.state, e)).toBe(false);
		}
		expect(second.spotlight!.every((k) => k.startsWith('c:'))).toBe(true);
		expect(cut.puzzle.centres).toHaveLength(start.puzzle.centres.length + 2);
		expect(unique.frames.at(-1)!.puzzle.centres).toHaveLength(puzzle.centres.length);
	});

	it('grades by propagation round by round, stuck on a hard puzzle, and ends on the solution', () => {
		const [start] = grade.frames;
		expect(start.caption).toEqual({ key: 'pinwheel.grade.start', params: { settled: 33 } });
		const rounds = grade.frames.filter((f) => f.caption.key === 'pinwheel.grade.round');
		expect(rounds.length).toBeGreaterThan(0);
		for (const r of rounds) expect(r.spotlight).toHaveLength(Number(r.caption.params!.count));
		const stuck = grade.frames.find((f) => f.caption.key === 'pinwheel.grade.stuck')!;
		expect(stuck.spotlight).toHaveLength(Number(stuck.caption.params!.open));
		expect(49 - coloured(stuck.state)).toBe(stuck.caption.params!.open);
		expect(
			grade.frames.find((f) => f.caption.key === 'pinwheel.grade.attempts')!.caption.params
		).toEqual({ attempt: 2, easy: 1, dropped: 0 });
		const end = grade.frames.at(-1)!;
		expect(end.caption.key).toBe('pinwheel.grade.solution');
		expect(end.puzzle).toEqual(puzzle);
		// Galaxies that touch have different colours.
		for (const e of interiorEdges(puzzle)) {
			if (solution[e.a] === solution[e.b]) continue;
			expect(line(end.state, e)).toBe(true);
			expect(end.state.colors[e.a]).not.toBe(end.state.colors[e.b]);
		}
	});

	it('says when a partition is unique at once, settled by propagation, in one attempt', () => {
		const normal = pinwheelFilm(1, 'normal');
		const [, plain, graded] = normal.chapters;
		expect(plain.frames.map((f) => f.caption.key)).toEqual([
			'pinwheel.unique.start',
			'pinwheel.unique.already'
		]);
		const captions = graded.frames.map((f) => f.caption.key);
		expect(captions).toContain('pinwheel.grade.solved');
		expect(captions).not.toContain('pinwheel.grade.attempts');
	});

	it('is the same for the same seed', () => {
		expect(pinwheelFilm(PINWHEEL_SEED)).toEqual(film);
	});

	it('has every text it says in both languages, with its values', () => {
		const frames = [film, pinwheelFilm(1, 'normal')].flatMap((f) => new Timeline(f).frames);
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
