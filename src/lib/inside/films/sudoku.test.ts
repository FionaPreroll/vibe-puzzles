import { describe, expect, it } from 'vitest';
import { generateSudoku } from '../../games/sudoku/generator';
import { candidates, currentGrid, isSolvedGrid } from '../../games/sudoku/rules';
import { Timeline } from '../film';
import { i18n } from '../../i18n/index.svelte';
import { ti } from '../i18n';
import { SUDOKU_SEED, SUDOKU_TYPE, sudokuFilm } from './sudoku';

const film = sudokuFilm();
const [fill, dig, solve] = film.chapters;
const { puzzle, solution } = generateSudoku(9, 'normal', SUDOKU_SEED);
const keys = (chapter: typeof fill) => chapter.frames.map((f) => f.caption.key);
const easy = sudokuFilm(SUDOKU_SEED, { ...SUDOKU_TYPE, difficulty: 'easy' });

describe('the Sudoku film', () => {
	it('has three chapters on the Sudoku board', () => {
		expect(film.game).toBe('sudoku');
		expect(film.chapters.map((c) => c.title)).toEqual([
			'sudoku.chapters.fill',
			'sudoku.chapters.dig',
			'sudoku.chapters.solve'
		]);
	});

	it('fills the empty grid into the solution, backing out of dead ends', () => {
		expect(fill.frames[0].puzzle.givens.every((d) => d === 0)).toBe(true);
		expect(fill.frames.at(-1)!.puzzle.givens).toEqual(solution);
		// The film's seed runs into a dead end: the cell where nothing fits, then the digit taken back.
		const stuck = fill.frames.find((f) => f.caption.key === 'sudoku.fill.stuck')!;
		expect(stuck.mistake).toBe(true);
		const cell = Number(stuck.spotlight![0]);
		expect(stuck.puzzle.givens[cell]).toBe(0);
		expect(candidates(9, stuck.puzzle.givens, cell)).toBe(0);
		const next = fill.frames[fill.frames.indexOf(stuck) + 1];
		expect(next.caption.key).toBe('sudoku.fill.back');
		// The first digits show where they had to fit; later ones go faster.
		const places = fill.frames.filter((f) => f.caption.key === 'sudoku.fill.place');
		expect(places[0].area).toHaveLength(27);
		expect(places[5].area).toBeUndefined();
		expect(places[0].hold).toBeGreaterThan(places[5].hold!);
	});

	it('digs from the solution down to the puzzle, putting back what logic cannot spare', () => {
		expect(dig.frames[0].puzzle.givens).toEqual(solution);
		expect(dig.frames.at(-1)!.puzzle.givens).toEqual(puzzle.givens);
		expect(keys(dig).filter((k) => k === 'sudoku.dig.try')).toHaveLength(41);
		for (const [i, f] of dig.frames.entries()) {
			if (f.caption.key !== 'sudoku.dig.restore') continue;
			expect(f.mistake).toBe(true);
			// The pair tried is back.
			const tried = dig.frames[i - 1];
			expect(tried.spotlight).toEqual(f.spotlight);
			for (const cell of f.spotlight!) {
				expect(tried.puzzle.givens[+cell]).toBe(0);
				expect(f.puzzle.givens[+cell]).toBe(solution[+cell]);
			}
		}
		const done = dig.frames.at(-1)!.caption;
		expect(done.params?.givens).toBe(puzzle.givens.filter(Boolean).length);
	});

	it('solves the puzzle single by single, from every candidate noted', () => {
		const [start] = solve.frames;
		expect(start.puzzle.givens).toEqual(puzzle.givens);
		const open = puzzle.givens.indexOf(0);
		expect(start.state.notes[open]).toBe(candidates(9, puzzle.givens, open));
		const end = solve.frames.at(-1)!;
		expect(currentGrid(end.puzzle, end.state)).toEqual(solution);
		expect(isSolvedGrid(9, currentGrid(end.puzzle, end.state))).toBe(true);
		expect(end.state.notes.every((n) => n === 0)).toBe(true);
		const steps = keys(solve).filter((k) => k.includes('.naked') || k.includes('.hidden'));
		expect(steps).toHaveLength(puzzle.givens.filter((d) => !d).length);
		expect(steps).toContain('sudoku.solve.naked');
		expect(steps.some((k) => k.startsWith('sudoku.solve.hidden.'))).toBe(true);
		// A hidden single tints its unit; a naked one the cell's row, column and box.
		for (const f of solve.frames.slice(1, -1)) {
			expect(f.area).toHaveLength(f.caption.key === 'sudoku.solve.naked' ? 27 : 9);
			expect(f.area).toContain(f.spotlight![0]);
		}
	});

	it('makes an easy puzzle the same way, keeping enough digits', () => {
		const made = generateSudoku(9, 'easy', SUDOKU_SEED).puzzle;
		const [, digging, solving] = easy.chapters;
		const end = digging.frames.at(-1)!;
		expect(end.puzzle.givens).toEqual(made.givens);
		expect(end.caption.key).toBe('sudoku.dig.doneEasy');
		expect(end.caption.params!.givens).toBeGreaterThanOrEqual(Number(end.caption.params!.least));
		expect(solving.frames.at(-1)!.caption.key).toBe('sudoku.solve.doneEasy');
		expect(keys(dig).at(-1)).toBe('sudoku.dig.done');
	});

	it('is the same for the same seed, and another for another', () => {
		expect(sudokuFilm(SUDOKU_SEED)).toEqual(film);
		expect(sudokuFilm(SUDOKU_SEED + 1).chapters[1].frames.at(-1)!.puzzle).not.toEqual(puzzle);
	});

	it('has every text it says in both languages, with its values', () => {
		const frames = [sudokuFilm(7), easy].flatMap((f) => new Timeline(f).frames);
		const captions = frames.flatMap((f) => [f.caption, ...(f.detail ? [f.detail] : [])]);
		try {
			for (const locale of ['en', 'de'] as const) {
				i18n.locale = locale;
				for (const title of film.chapters.map((c) => c.title)) {
					expect(ti(title)).not.toBe(title);
				}
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
