import { generatePinwheel } from '../../games/pinwheel/generator';
import {
	emptyPinwheelState,
	hIndex,
	interiorEdges,
	LINE,
	vIndex,
	type PinwheelPuzzle,
	type PinwheelState
} from '../../games/pinwheel/rules';
import { PinwheelSolver, type PinwheelTraceEvent } from '../../games/pinwheel/solver';
import type { Difficulty } from '../../core/variants';
import type { Caption, Chapter, Film, Frame } from '../film';

type PinwheelFrame = Frame<PinwheelPuzzle, PinwheelState>;
type PinwheelChapter = Chapter<PinwheelPuzzle, PinwheelState>;
type Kind = PinwheelTraceEvent['kind'];
type Event<K extends Kind> = Extract<PinwheelTraceEvent, { kind: K }>;
type Centre = [number, number];

const SIZE = 7;
/** The film's puzzle: a hard 7×7 whose second attempt needs a cut to become unique. */
export const PINWHEEL_SEED = 35;
/** The first steps of a kind stay longer, so that the idea can be followed before it speeds up. */
const SLOW_STEPS = 3;
/** Galaxy colours (the board's note colours), in the order the board colours finished galaxies. */
const COLOURS = [6, 7, 8, 9, 1, 2, 3, 4, 5];

const key = ([hr, hc]: Centre) => `${hr},${hc}`;
const cellKeys = (cells: Iterable<number>) => [...cells].map((i) => `c:${i}`);

/** The events of the given kinds, in order. */
function only<K extends Kind>(events: PinwheelTraceEvent[], ...kinds: K[]): Event<K>[] {
	return events.filter((e): e is Event<K> => (kinds as Kind[]).includes(e.kind));
}

/** The galaxies on the board as the film goes: their centres, in the generator's order, and cells. */
class Sky {
	readonly galaxies = new Map<string, { centre: Centre; cells: Set<number> }>();

	add(centre: Centre, cells: number[]) {
		this.galaxies.set(key(centre), { centre, cells: new Set(cells) });
	}

	ownerOf(cell: number): string | null {
		for (const [k, g] of this.galaxies) if (g.cells.has(cell)) return k;
		return null;
	}

	/** The galaxy (centre key) of every cell, or null. */
	get owners(): (string | null)[] {
		return Array.from({ length: SIZE * SIZE }, (_, i) => this.ownerOf(i));
	}

	/** Moves `cells` to the galaxy at `centre`; galaxies left empty go. */
	take(centre: Centre, cells: number[]) {
		for (const i of cells) {
			const from = this.ownerOf(i);
			if (from) this.galaxies.get(from)!.cells.delete(i);
			this.galaxies.get(key(centre))!.cells.add(i);
		}
		for (const [k, g] of this.galaxies) if (!g.cells.size) this.galaxies.delete(k);
	}

	/** Takes `cells` out of their galaxies. */
	cut(cells: number[]) {
		for (const i of cells) this.galaxies.get(this.ownerOf(i)!)!.cells.delete(i);
	}

	/** Applies a step of the partition or of making it unique. */
	apply(e: Event<'centre' | 'grow' | 'absorb' | 'split'>) {
		if (e.kind === 'centre') this.add(e.centre, e.cells);
		else if (e.kind === 'split') {
			this.cut(e.cells);
			for (const g of e.galaxies) this.add(g.centre, g.cells);
		} else this.take(e.centre, e.cells);
	}

	get centres(): Centre[] {
		return [...this.galaxies.values()].map((g) => g.centre);
	}

	/** The board: every galaxy's centre and colour, and lines around each galaxy. */
	draw(colours: Map<string, number>): { puzzle: PinwheelPuzzle; state: PinwheelState } {
		return board(this.centres, this.owners, (k) => colours.get(k)!);
	}

	/** Spotlight keys of the centres at `centres`. */
	centreKeys(...centres: Centre[]): string[] {
		const order = this.centres.map(key);
		return centres.map((c) => `g:${order.indexOf(key(c))}`);
	}
}

/**
 * A colour for every galaxy of the film (by centre key) that no galaxy it ever touches has, so
 * that colours stay put while galaxies grow, and neighbours always differ.
 */
function paint(events: Event<'centre' | 'grow' | 'absorb' | 'second' | 'split'>[]) {
	const sky = new Sky();
	const touching = new Map<string, Set<string>>();
	const meet = (owner: (string | null)[]) => {
		for (const { a, b } of interiorEdges({ width: SIZE, height: SIZE, centres: [] })) {
			const [x, y] = [owner[a], owner[b]];
			if (!x || !y || x === y) continue;
			for (const [p, q] of [
				[x, y],
				[y, x]
			]) {
				touching.get(p)!.add(q);
			}
		}
	};
	const order: string[] = [];
	for (const e of events) {
		if (e.kind === 'second') {
			meet(e.other.map((k) => key(e.centres[k])));
			continue;
		}
		sky.apply(e);
		for (const k of sky.galaxies.keys()) {
			if (order.includes(k)) continue;
			order.push(k);
			touching.set(k, new Set());
		}
		meet(sky.owners);
	}
	const colours = new Map<string, number>();
	for (const k of order) {
		const used = new Set([...touching.get(k)!].map((o) => colours.get(o)));
		colours.set(k, COLOURS.find((c) => !used.has(c)) ?? COLOURS[0]);
	}
	return colours;
}

/**
 * A board with `centres`, cells coloured by `colour(owner)` (no colour without an owner), and a
 * line wherever two cells have different owners and at least one has one.
 */
function board<O>(
	centres: Centre[],
	owner: (O | null)[],
	colour: (owner: O) => number
): { puzzle: PinwheelPuzzle; state: PinwheelState } {
	const puzzle: PinwheelPuzzle = { width: SIZE, height: SIZE, centres };
	const state = emptyPinwheelState(puzzle);
	state.colors = owner.map((o) => (o === null ? 0 : colour(o)));
	for (const e of interiorEdges(puzzle)) {
		if (owner[e.a] === owner[e.b]) continue;
		if (e.kind === 'h') state.h[hIndex(puzzle, e.i, e.j)] = LINE;
		else state.v[vIndex(puzzle, e.i, e.j)] = LINE;
	}
	return { puzzle, state };
}

/** The keys of the lines of `next` that `before` does not have. */
function newLines(before: PinwheelState, next: PinwheelState, puzzle: PinwheelPuzzle): string[] {
	return interiorEdges(puzzle).flatMap((e) => {
		const at = e.kind === 'h' ? hIndex(puzzle, e.i, e.j) : vIndex(puzzle, e.i, e.j);
		const arr = e.kind === 'h' ? 'h' : 'v';
		return next[arr][at] === LINE && before[arr][at] !== LINE ? [`${e.kind}:${e.i}:${e.j}`] : [];
	});
}

/**
 * How a 7×7 Pinwheel is made, from the generator's own trace: galaxies grow in mirror pairs, the
 * solver looks for a second solution and a cut removes it, and propagation alone settles every
 * cell (normal) or gets stuck (hard). The film shows a hard one.
 */
export function pinwheelFilm(
	seed = PINWHEEL_SEED,
	difficulty: Difficulty = 'hard'
): Film<PinwheelPuzzle, PinwheelState> {
	const events: PinwheelTraceEvent[] = [];
	const { puzzle, solution } = generatePinwheel(SIZE, SIZE, difficulty, seed, (e) =>
		events.push(e)
	);
	// Only the last attempt made the puzzle; the ones before were given up or too easy.
	const start = events.map((e) => e.kind).lastIndexOf('attempt');
	const earlier = events.slice(0, start);
	const last = events.slice(start);
	const colours = paint(only(last, 'centre', 'grow', 'absorb', 'second', 'split'));
	const sky = new Sky();
	const solving: PinwheelTraceEvent[] = [];
	new PinwheelSolver(puzzle).solve({ branch: false, trace: (e) => solving.push(e) });
	return {
		game: 'pinwheel',
		settings: { highlightErrors: false, autoColor: false, blackHoles: false },
		chapters: [
			grow(only(last, 'centre', 'grow', 'absorb'), sky, colours),
			unique(only(last, 'second', 'split', 'unique'), sky, colours),
			grade(only(solving, 'round'), puzzle, solution, colours, {
				attempt: only(events, 'attempt').length,
				easy: only(earlier, 'rated').filter((e) => e.easy).length,
				dropped: only(earlier, 'drop').length
			})
		]
	};
}

/** The partition: galaxies start at enclosed cells and grow in mirror pairs. */
function grow(
	events: Event<'centre' | 'grow' | 'absorb'>[],
	sky: Sky,
	colours: Map<string, number>
): PinwheelChapter {
	const detail = { key: 'pinwheel.grow.detail' };
	const frames: PinwheelFrame[] = [
		{ ...sky.draw(colours), caption: { key: 'pinwheel.grow.start' }, detail, hold: 5 }
	];
	const seen = { centre: 0, grow: 0, absorb: 0 };
	for (const e of events) {
		const slow = seen[e.kind]++ < SLOW_STEPS;
		sky.apply(e);
		frames.push({
			...sky.draw(colours),
			spotlight: [...sky.centreKeys(e.centre), ...(e.kind === 'centre' ? [] : cellKeys(e.cells))],
			caption: { key: `pinwheel.grow.${e.kind}` },
			detail,
			hold: slow ? 3 : e.kind === 'grow' ? 0.5 : 0.8
		});
	}
	frames.push({ ...sky.draw(colours), caption: { key: 'pinwheel.grow.done' }, detail, hold: 4 });
	return { title: 'pinwheel.chapters.grow', frames };
}

/** The solver looks for a second solution; a cut where it differs removes it. */
function unique(
	events: Event<'second' | 'split' | 'unique'>[],
	sky: Sky,
	colours: Map<string, number>
): PinwheelChapter {
	const detail = { key: 'pinwheel.unique.detail' };
	const frames: PinwheelFrame[] = [
		{ ...sky.draw(colours), caption: { key: 'pinwheel.unique.start' }, detail, hold: 5 }
	];
	let cuts = 0;
	for (const e of events) {
		if (e.kind === 'second') {
			const now = sky.draw(colours);
			const centreKeys = e.centres.map(key);
			const other = board(e.centres, e.other, (k) => colours.get(centreKeys[k])!);
			const differ = e.other.flatMap((k, i) => (k !== e.owner[i] ? [i] : []));
			frames.push({
				...other,
				spotlight: cellKeys(differ),
				trial: newLines(now.state, other.state, other.puzzle),
				caption: { key: 'pinwheel.unique.second' },
				detail,
				hold: 5
			});
		} else if (e.kind === 'split') {
			sky.apply(e);
			cuts++;
			frames.push({
				...sky.draw(colours),
				spotlight: [...sky.centreKeys(...e.galaxies.map((g) => g.centre)), ...cellKeys(e.cells)],
				caption: { key: 'pinwheel.unique.cut' },
				detail,
				hold: 5
			});
		} else {
			frames.push({
				...sky.draw(colours),
				caption: { key: cuts ? 'pinwheel.unique.done' : 'pinwheel.unique.already' },
				detail,
				hold: 4
			});
		}
	}
	return { title: 'pinwheel.chapters.unique', frames };
}

/** Propagation alone, round by round: where it gets stuck, the puzzle needs case analysis. */
function grade(
	rounds: Event<'round'>[],
	puzzle: PinwheelPuzzle,
	solution: number[],
	colours: Map<string, number>,
	attempts: { attempt: number; easy: number; dropped: number }
): PinwheelChapter {
	const keys = puzzle.centres.map(key);
	const colour = (k: number) => colours.get(keys[k])!;
	const settledBoard = (owner: number[]) =>
		board(
			puzzle.centres,
			owner.map((k) => (k < 0 ? null : k)),
			colour
		);
	const detail = { key: 'pinwheel.grade.levels' };
	const frames: PinwheelFrame[] = [];
	let before: number[] = [];
	rounds.forEach((r, n) => {
		const settled = r.owner.filter((k) => k >= 0).length;
		const fresh = r.owner.flatMap((k, i) => (k >= 0 && (before[i] ?? -1) < 0 ? [i] : []));
		const caption: Caption =
			n === 0
				? { key: 'pinwheel.grade.start', params: { settled } }
				: { key: 'pinwheel.grade.round', params: { round: n, count: fresh.length } };
		frames.push({
			...settledBoard(r.owner),
			spotlight: n === 0 ? undefined : cellKeys(fresh),
			caption,
			detail,
			hold: 5
		});
		before = r.owner;
	});
	const end = rounds.at(-1)!.owner;
	const open = end.flatMap((k, i) => (k < 0 ? [i] : []));
	frames.push({
		...settledBoard(end),
		spotlight: open.length ? cellKeys(open) : undefined,
		caption: {
			key: open.length ? 'pinwheel.grade.stuck' : 'pinwheel.grade.solved',
			params: { open: open.length }
		},
		detail,
		hold: 6
	});
	if (attempts.attempt > 1) {
		frames.push({
			...settledBoard(end),
			caption: { key: 'pinwheel.grade.attempts', params: attempts },
			detail: { key: 'pinwheel.grade.attemptsDetail' },
			hold: 6
		});
	}
	frames.push({
		...settledBoard(solution),
		caption: { key: 'pinwheel.grade.solution' },
		hold: 5
	});
	return { title: 'pinwheel.chapters.grade', frames };
}
