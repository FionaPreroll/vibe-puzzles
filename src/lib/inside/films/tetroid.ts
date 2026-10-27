import { generateTetroid } from '../../games/tetroid/generator';
import {
	CROSS,
	EMPTY,
	SHADED,
	type TetroidPuzzle,
	type TetroidState
} from '../../games/tetroid/rules';
import { TetroidSolver, type TetroidTraceEvent } from '../../games/tetroid/solver';
import type { Caption, Chapter, Film, FilmType, Frame } from '../film';

type TetroidFrame = Frame<TetroidPuzzle, TetroidState>;
type TetroidChapter = Chapter<TetroidPuzzle, TetroidState>;
type Kind = TetroidTraceEvent['kind'];
type Event<K extends Kind> = Extract<TetroidTraceEvent, { kind: K }>;

/** The film's puzzle: its regions need moves, a new tetromino and a look-ahead to settle. */
export const TETROID_SEED = 12;
export const TETROID_TYPE: FilmType = { width: 6, height: 6, difficulty: 'normal' };
/** The first steps of a kind stay longer, so that the idea can be followed before it speeds up. */
const SLOW_STEPS = 3;

const keys = (cells: Iterable<number>) => [...cells].map(String);

/** The events of the given kinds, in order. */
function only<K extends Kind>(events: TetroidTraceEvent[], ...kinds: K[]): Event<K>[] {
	return events.filter((e): e is Event<K> => (kinds as Kind[]).includes(e.kind));
}

/** The planted tetrominoes and the regions as the film goes. */
class Garden {
	/** Region of every cell, -1 while it has none. */
	readonly regions: number[];
	/** The planted shading, 0/1 per cell. */
	readonly shading: number[];
	private planted = 0;

	constructor(readonly size: number) {
		this.regions = new Array<number>(size * size).fill(-1);
		this.shading = new Array<number>(size * size).fill(0);
	}

	apply(e: Event<'plant' | 'assign' | 'move' | 'replant'>) {
		if (e.kind === 'plant') {
			for (const i of e.cells) {
				this.regions[i] = this.planted;
				this.shading[i] = 1;
			}
			this.planted++;
		} else if (e.kind === 'replant') {
			this.regions.forEach((r, i) => r === e.region && (this.shading[i] = 0));
			for (const i of e.cells) this.shading[i] = 1;
		} else this.regions[e.cell] = e.region;
	}

	cellsOf(region: number): number[] {
		return this.regions.flatMap((r, i) => (r === region ? [i] : []));
	}

	/**
	 * The board: the regions (a cell without one is a region of its own) and the shading, by
	 * default the planted one.
	 */
	draw(shading: number[] = this.shading): { puzzle: TetroidPuzzle; state: TetroidState } {
		const n = this.regions.length;
		return {
			puzzle: {
				width: this.size,
				height: this.size,
				regions: this.regions.map((r, i) => (r < 0 ? n + i : r))
			},
			state: { marks: shading.map((s) => (s ? SHADED : EMPTY)), auto: new Array(n).fill(0) }
		};
	}
}

/**
 * How a small normal Tetroid is made, from the generator's own trace: tetrominoes are planted, the
 * free cells grow into regions around them, regions are reshaped until there is one solution that
 * deduction alone finds, and the deduction is shown round by round.
 */
export function tetroidFilm(
	seed = TETROID_SEED,
	type: FilmType = TETROID_TYPE
): Film<TetroidPuzzle, TetroidState> {
	const events: TetroidTraceEvent[] = [];
	const size = type.width;
	const { puzzle } = generateTetroid(size, size, 'normal', seed, (e) => events.push(e));
	// Only the last attempt made the puzzle; the ones before could not be made logical.
	const last = events.slice(events.map((e) => e.kind).lastIndexOf('attempt'));
	const solving: TetroidTraceEvent[] = [];
	new TetroidSolver(puzzle).solve({ branch: false, trace: (e) => solving.push(e) });
	const garden = new Garden(size);
	return {
		game: 'tetroid',
		puzzle,
		settings: { highlightErrors: false, colorTetrominoes: true },
		chapters: [
			plant(only(last, 'plant'), garden),
			grow(only(last, 'assign'), garden),
			reshape(
				only(last, 'alternative', 'move', 'replant', 'alone', 'stuck', 'unique'),
				garden,
				only(events, 'attempt').length
			),
			solve(only(solving, 'round'), puzzle)
		]
	};
}

/** Tetrominoes are planted one by one, each the seed of a region. */
function plant(events: Event<'plant'>[], garden: Garden): TetroidChapter {
	const detail = { key: 'tetroid.plant.detail' };
	const frames: TetroidFrame[] = [
		{
			...garden.draw(),
			caption: { key: 'tetroid.plant.start', params: { size: garden.size } },
			detail,
			hold: 6
		}
	];
	events.forEach((e, k) => {
		garden.apply(e);
		frames.push({
			...garden.draw(),
			spotlight: keys(e.cells),
			caption: { key: 'tetroid.plant.plant' },
			detail,
			hold: k < SLOW_STEPS ? 3 : 1.2
		});
	});
	frames.push({ ...garden.draw(), caption: { key: 'tetroid.plant.done' }, detail, hold: 4 });
	return { title: 'tetroid.chapters.plant', frames };
}

/** Every free cell joins a neighbouring region. */
function grow(events: Event<'assign'>[], garden: Garden): TetroidChapter {
	const detail = { key: 'tetroid.grow.detail' };
	const frames: TetroidFrame[] = [];
	events.forEach((e, k) => {
		garden.apply(e);
		frames.push({
			...garden.draw(),
			spotlight: keys([e.cell]),
			area: keys(garden.cellsOf(e.region)),
			caption: { key: 'tetroid.grow.assign' },
			detail,
			hold: k < SLOW_STEPS ? 3 : 0.5
		});
	});
	frames.push({ ...garden.draw(), caption: { key: 'tetroid.grow.done' }, detail, hold: 4 });
	return { title: 'tetroid.chapters.grow', frames };
}

/**
 * Regions are reshaped: first until no region has a second tetromino of its own, then until
 * deduction alone settles every region.
 */
function reshape(
	events: Event<'alternative' | 'move' | 'replant' | 'alone' | 'stuck' | 'unique'>[],
	garden: Garden,
	attempt: number
): TetroidChapter {
	const frames: TetroidFrame[] = [];
	const seen: Record<string, number> = {};
	/** Moves after propagation got stuck are there to rule options out, not alternatives. */
	let logical = false;
	for (const e of events) {
		const slow = (seen[e.kind] = (seen[e.kind] ?? 0) + 1) <= SLOW_STEPS;
		const step = (caption: Caption, hold: number, extra: Partial<TetroidFrame> = {}) =>
			frames.push({
				...garden.draw(),
				caption,
				detail: { key: logical ? 'tetroid.reshape.logicalDetail' : 'tetroid.reshape.detail' },
				hold: slow ? hold : Math.min(hold, 1),
				...extra
			});
		if (e.kind === 'alternative') {
			// The region with its other tetromino instead of the planted one, in teal.
			const other = garden.shading.slice();
			garden.cellsOf(e.region).forEach((i) => (other[i] = 0));
			for (const i of e.cells) other[i] = 1;
			step({ key: 'tetroid.reshape.alternative' }, 4, {
				...garden.draw(other),
				area: keys(garden.cellsOf(e.region)),
				trial: keys(e.cells)
			});
		} else if (e.kind === 'move') {
			garden.apply(e);
			step({ key: logical ? 'tetroid.reshape.logicalMove' : 'tetroid.reshape.move' }, 3, {
				spotlight: keys([e.cell]),
				area: keys(garden.cellsOf(e.region))
			});
		} else if (e.kind === 'replant') {
			garden.apply(e);
			step({ key: 'tetroid.reshape.replant' }, 4, { spotlight: keys(e.cells) });
		} else if (e.kind === 'alone') {
			step({ key: 'tetroid.reshape.alone' }, 4);
		} else if (e.kind === 'stuck') {
			logical = true;
			step({ key: 'tetroid.reshape.stuck' }, 4, { area: keys(e.cells) });
		} else {
			step({ key: 'tetroid.reshape.unique' }, 5);
			if (attempt > 1) step({ key: 'tetroid.reshape.attempts', params: { attempt } }, 5);
		}
	}
	return { title: 'tetroid.chapters.reshape', frames };
}

/** Deduction alone, pass by pass, settles every region of the puzzle. */
function solve(rounds: Event<'round'>[], puzzle: TetroidPuzzle): TetroidChapter {
	const frames: TetroidFrame[] = [];
	let known = new Set<number>();
	const n = puzzle.regions.length;
	for (const r of rounds) {
		const marks = new Array<number>(n).fill(EMPTY);
		for (const i of r.shaded) marks[i] = SHADED;
		for (const i of r.empty) marks[i] = CROSS;
		const decided = [...r.shaded, ...r.empty];
		const fresh = decided.filter((i) => !known.has(i));
		known = new Set(decided);
		frames.push({
			puzzle,
			state: { marks, auto: new Array(n).fill(0) },
			spotlight: r.rule === 'start' ? undefined : keys(fresh),
			caption: { key: `tetroid.solve.${r.rule}`, params: { count: fresh.length } },
			detail: { key: `tetroid.solve.${r.rule}Detail` },
			hold: 5
		});
	}
	const end = frames.at(-1)!;
	frames.push({
		...end,
		spotlight: undefined,
		caption: { key: 'tetroid.solve.done' },
		detail: undefined,
		hold: 5
	});
	return { title: 'tetroid.chapters.solve', frames };
}
