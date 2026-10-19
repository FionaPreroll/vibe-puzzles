import { EASY_GIVENS, generateSudoku } from '../../games/sudoku/generator';
import {
	bit,
	candidates,
	geometry,
	type SudokuPuzzle,
	type SudokuState
} from '../../games/sudoku/rules';
import { Level, ratePuzzle, type SudokuTraceEvent } from '../../games/sudoku/solver';
import type { Chapter, Film, FilmType, Frame } from '../film';

type SudokuFrame = Frame<SudokuPuzzle, SudokuState>;
type SudokuChapter = Chapter<SudokuPuzzle, SudokuState>;
type Kind = SudokuTraceEvent['kind'];
type Event<K extends Kind> = Extract<SudokuTraceEvent, { kind: K }>;

const SIZE = 9;
/** The film's puzzle when the viewer has not asked for another: a search with dead ends. */
export const SUDOKU_SEED = 12;
/** The type of the film's puzzle; Easy ones are made the same way and keep more digits. */
export const SUDOKU_TYPE: FilmType = { width: 9, height: 9, difficulty: 'normal' };
/** The first steps of a kind stay longer, so that the idea can be followed before it speeds up. */
const SLOW_STEPS = 3;

const keys = (cells: number[]) => cells.map(String);
const empty = (): SudokuState => ({
	values: new Array(SIZE * SIZE).fill(0),
	notes: new Array(SIZE * SIZE).fill(0)
});
const board = (givens: number[]): SudokuPuzzle => ({
	width: SIZE,
	height: SIZE,
	givens: givens.slice()
});
const count = (grid: number[]) => grid.filter(Boolean).length;

/** The events of the given kinds, in order. */
function only<K extends Kind>(events: SudokuTraceEvent[], ...kinds: K[]): Event<K>[] {
	return events.filter((e): e is Event<K> => (kinds as Kind[]).includes(e.kind));
}

/**
 * How a 9×9 Sudoku (normal, or easy) is made, from the generator's own trace: the search fills the
 * empty grid (with its dead ends), digging takes givens out while singles still solve the puzzle,
 * and the rating solver solves the result with pencil marks.
 */
export function sudokuFilm(
	seed = SUDOKU_SEED,
	type: FilmType = SUDOKU_TYPE
): Film<SudokuPuzzle, SudokuState> {
	const made: SudokuTraceEvent[] = [];
	const { puzzle, solution } = generateSudoku(SIZE, type.difficulty, seed, (e) => made.push(e));
	const easy = type.difficulty === 'easy';
	const rated: SudokuTraceEvent[] = [];
	ratePuzzle(puzzle, Level.Singles, (e) => rated.push(e));
	return {
		game: 'sudoku',
		chapters: [
			fill(only(made, 'place', 'unplace')),
			dig(only(made, 'try', 'keep', 'restore'), solution, easy),
			solve(only(rated, 'start')[0], only(rated, 'single'), puzzle, easy)
		]
	};
}

/** The search fills the empty grid, a digit at a time, and backs out of dead ends. */
function fill(events: Event<'place' | 'unplace'>[]): SudokuChapter {
	const grid = new Array(SIZE * SIZE).fill(0);
	const detail = { key: 'sudoku.fill.detail' };
	const frames: SudokuFrame[] = [
		{ puzzle: board(grid), state: empty(), caption: { key: 'sudoku.fill.start' }, detail, hold: 4 }
	];
	const { unitsOf, units } = geometry(SIZE);
	let placed = 0;
	let previous: Kind | null = null;
	for (const e of events) {
		if (e.kind === 'place') {
			grid[e.cell] = e.digit;
			const slow = placed++ < SLOW_STEPS;
			frames.push({
				puzzle: board(grid),
				state: empty(),
				spotlight: keys([e.cell]),
				// At first, where the digit had to fit: its row, column and box.
				area: slow ? unitsOf[e.cell].flatMap((u) => units[u]).map(String) : undefined,
				caption: { key: 'sudoku.fill.place' },
				detail,
				hold: slow ? 2.5 : 0.3
			});
		} else {
			if (previous === 'place') {
				// The search below the last digit found a cell where nothing fits.
				const stuck = grid.flatMap((d, i) => (!d && !candidates(SIZE, grid, i) ? [i] : []));
				frames.push({
					puzzle: board(grid),
					state: empty(),
					spotlight: keys(stuck),
					mistake: true,
					caption: { key: 'sudoku.fill.stuck' },
					detail,
					hold: 3
				});
			}
			grid[e.cell] = 0;
			frames.push({
				puzzle: board(grid),
				state: empty(),
				spotlight: keys([e.cell]),
				mistake: true,
				caption: { key: 'sudoku.fill.back' },
				detail,
				hold: 1.5
			});
		}
		previous = e.kind;
	}
	frames.push({
		puzzle: board(grid),
		state: empty(),
		caption: { key: 'sudoku.fill.done' },
		detail,
		hold: 4
	});
	return { title: 'sudoku.chapters.fill', frames };
}

/**
 * Pairs of givens go out while the rating solver still solves the puzzle with singles (and, for an
 * easy puzzle, while enough givens are left).
 */
function dig(
	events: Event<'try' | 'keep' | 'restore'>[],
	solution: number[],
	easy: boolean
): SudokuChapter {
	// Digging starts from the full grid, the solution.
	const grid = solution.slice();
	const detail = { key: 'sudoku.dig.detail' };
	const frames: SudokuFrame[] = [
		{ puzzle: board(grid), state: empty(), caption: { key: 'sudoku.dig.start' }, detail, hold: 4 }
	];
	const seen = { try: 0, keep: 0, restore: 0 };
	for (const e of events) {
		const slow = seen[e.kind]++ < SLOW_STEPS;
		if (e.kind === 'try') {
			for (const i of e.cells) grid[i] = 0;
			frames.push({
				puzzle: board(grid),
				state: empty(),
				spotlight: keys(e.cells),
				caption: { key: 'sudoku.dig.try' },
				detail,
				hold: slow ? 3 : 0.8
			});
		} else if (e.kind === 'keep') {
			frames.push({
				puzzle: board(grid),
				state: empty(),
				caption: { key: 'sudoku.dig.keep', params: { givens: count(grid) } },
				detail,
				hold: slow ? 2.5 : 0.6
			});
		} else {
			for (const i of e.cells) grid[i] = solution[i];
			frames.push({
				puzzle: board(grid),
				state: empty(),
				spotlight: keys(e.cells),
				mistake: true,
				caption: { key: 'sudoku.dig.restore' },
				detail,
				hold: slow ? 3 : 1.2
			});
		}
	}
	frames.push({
		puzzle: board(grid),
		state: empty(),
		caption: {
			key: easy ? 'sudoku.dig.doneEasy' : 'sudoku.dig.done',
			params: { givens: count(grid), least: EASY_GIVENS }
		},
		detail,
		hold: 4
	});
	return { title: 'sudoku.chapters.dig', frames };
}

/** The rating solver solves the puzzle like a person: pencil marks, then single after single. */
function solve(
	start: Event<'start'>,
	singles: Event<'single'>[],
	puzzle: SudokuPuzzle,
	easy: boolean
): SudokuChapter {
	const { units, unitsOf, peers } = geometry(SIZE);
	const state: SudokuState = { values: empty().values, notes: start.candidates.slice() };
	const snapshot = (): SudokuState => ({
		values: state.values.slice(),
		notes: state.notes.slice()
	});
	const frames: SudokuFrame[] = [
		{
			puzzle,
			state: snapshot(),
			caption: { key: 'sudoku.solve.start' },
			detail: { key: 'sudoku.solve.startDetail' },
			hold: 5
		}
	];
	singles.forEach((e, k) => {
		state.values[e.cell] = e.digit;
		state.notes[e.cell] = 0;
		for (const j of peers[e.cell]) state.notes[j] &= ~bit(e.digit);
		const unit = e.unit;
		const slow = k < SLOW_STEPS;
		frames.push({
			puzzle,
			state: snapshot(),
			spotlight: keys([e.cell]),
			// A hidden single rests on its unit, a naked one on the cell's row, column and box.
			area: (unit === null ? unitsOf[e.cell].flatMap((u) => units[u]) : units[unit]).map(String),
			caption:
				unit === null
					? { key: 'sudoku.solve.naked', params: { digit: e.digit } }
					: {
							key: `sudoku.solve.hidden.${['row', 'column', 'box'][Math.floor(unit / SIZE)]}`,
							params: { digit: e.digit }
						},
			detail: { key: unit === null ? 'sudoku.solve.nakedDetail' : 'sudoku.solve.hiddenDetail' },
			hold: slow ? 4 : 0.9
		});
	});
	frames.push({
		puzzle,
		state: snapshot(),
		caption: {
			key: easy ? 'sudoku.solve.doneEasy' : 'sudoku.solve.done',
			params: { singles: singles.length }
		},
		detail: { key: 'sudoku.solve.doneDetail' },
		hold: 5
	});
	return { title: 'sudoku.chapters.solve', frames };
}
