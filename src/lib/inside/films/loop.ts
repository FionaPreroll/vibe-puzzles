import { generateLoop } from '../../games/loop/generator';
import {
	clueAt,
	CROSS,
	edgeKey,
	LINE,
	OPEN,
	stateFromEdges,
	type LoopGraph,
	type LoopPuzzle,
	type LoopState
} from '../../games/loop/rules';
import {
	LoopLevel,
	loopLayout,
	rateLoop,
	type LoopLayout,
	type LoopTraceEvent
} from '../../games/loop/solver';
import type { Chapter, Film, FilmType, Frame } from '../film';

type LoopFrame = Frame<LoopPuzzle, LoopState>;
type LoopChapter = Chapter<LoopPuzzle, LoopState>;
type Kind = LoopTraceEvent['kind'];
type Event<K extends Kind> = Extract<LoopTraceEvent, { kind: K }>;

/** The film's puzzle: cells are turned away for both reasons, and the rules cross loops that close too early. */
export const LOOP_SEED = 13;
export const LOOP_TYPE: FilmType = { width: 7, height: 7, difficulty: 'normal' };
/** The first steps of a kind stay longer, so that the idea can be followed before it speeds up. */
const SLOW_STEPS = 3;

const cellKeys = (cells: Iterable<number>) => [...cells].map((c) => `c:${c}`);

/** A square board of the film's size: its graph, and puzzles and states of its shape. */
class Grid {
	readonly n: number;
	readonly layout: LoopLayout;
	readonly g: LoopGraph;
	/** The board without numbers, as the loop grows. */
	readonly bare: LoopPuzzle;

	constructor(readonly size: number) {
		this.n = size * size;
		this.layout = loopLayout(size, size);
		this.g = this.layout.g;
		this.bare = this.puzzleOf(new Array(this.n).fill(-1));
	}

	puzzleOf(clues: number[]): LoopPuzzle {
		const clue = (x: number) => (x < 0 ? '.' : String(x));
		return { width: this.size, height: this.size, clues: clues.map(clue).join('') };
	}

	edgeKeys(edges: number[]): string[] {
		return edges.map((e) => edgeKey(this.bare, e));
	}

	stateOf(edges: ArrayLike<number>): LoopState {
		return stateFromEdges(this.bare, edges);
	}

	blank(): LoopState {
		return this.stateOf(new Uint8Array(this.g.edges));
	}
}

/** The events of the given kinds, in order. */
function only<K extends Kind>(events: LoopTraceEvent[], ...kinds: K[]): Event<K>[] {
	return events.filter((e): e is Event<K> => (kinds as Kind[]).includes(e.kind));
}

/** The cells inside the loop as it grows, and what a cell would do to it. */
class Region {
	readonly inside: boolean[];

	constructor(readonly grid: Grid) {
		this.inside = new Array<boolean>(grid.n).fill(false);
	}

	/** The loop around the inside cells, as edge values: a line where the two sides differ. */
	border(inside = this.inside): Uint8Array {
		const { n, layout, g } = this.grid;
		const at = (c: number) => c < n && inside[c];
		const { edgeSide } = layout;
		return Uint8Array.from({ length: g.edges }, (_, e) =>
			at(edgeSide[2 * e]) === at(edgeSide[2 * e + 1]) ? OPEN : LINE
		);
	}

	cells(inside = this.inside): number[] {
		return inside.flatMap((x, c) => (x ? [c] : []));
	}

	/**
	 * Why `cell` cannot join: the dots where the loop would touch itself (inside cells on one
	 * diagonal, outside cells on the other), or else the outside cells it would cut off from the
	 * edge of the grid.
	 */
	why(cell: number): { dots: number[]; holes: number[] } {
		const inside = this.inside.slice();
		inside[cell] = true;
		const { n, layout, g } = this.grid;
		const at = (c: number) => c < n && inside[c];
		const { dotCell, cellSide } = layout;
		const dots: number[] = [];
		for (let d = 0; d < g.dots; d++) {
			const [a, b, x, y] = [0, 1, 2, 3].map((k) => at(dotCell[4 * d + k]));
			if (a === y && b === x && a !== b) dots.push(d);
		}
		// The outside cells that reach the edge of the grid, by flood fill from there.
		const sides = (c: number) => [...cellSide.slice(4 * c, 4 * c + 4)];
		const reached = inside.map((x, c) => !x && sides(c).includes(n));
		const stack = this.cells(reached);
		while (stack.length) {
			for (const k of sides(stack.pop()!)) {
				if (k < n && !inside[k] && !reached[k]) {
					reached[k] = true;
					stack.push(k);
				}
			}
		}
		const holes = inside.flatMap((x, c) => (x || reached[c] ? [] : [c]));
		return { dots, holes };
	}
}

/**
 * How a small normal Loop is made, from the generator's own trace: a region of cells grows so that
 * its border stays one loop, every cell gets the number of loop edges around it, numbers come out
 * while the rules still solve the puzzle, and the rules solve it step by step.
 */
export function loopFilm(
	seed = LOOP_SEED,
	type: FilmType = LOOP_TYPE
): Film<LoopPuzzle, LoopState> {
	const events: LoopTraceEvent[] = [];
	const grid = new Grid(type.width);
	const { puzzle } = generateLoop(grid.size, grid.size, 'normal', seed, (e) => events.push(e));
	// Only the last attempt made the puzzle; the ones before failed with every clue shown.
	const last = events.slice(events.map((e) => e.kind).lastIndexOf('attempt'));
	const solving: LoopTraceEvent[] = [];
	rateLoop(puzzle, LoopLevel.Basic, undefined, (e) => solving.push(e));
	const region = new Region(grid);
	const clues = only(last, 'clues')[0].clues;
	return {
		game: 'loop',
		puzzle,
		settings: { dimSatisfiedClues: false },
		chapters: [
			grow(only(last, 'grow', 'block'), region),
			{
				title: 'loop.chapters.numbers',
				frames: [...numbers(clues, region), ...dig(only(last, 'remove'), clues.slice(), grid)]
			},
			solve(only(solving, 'decide'), puzzle, grid)
		]
	};
}

/** A region grows from one cell, cell by cell, and its border is always one loop. */
function grow(events: Event<'grow' | 'block'>[], region: Region): LoopChapter {
	const { grid } = region;
	const detail = { key: 'loop.grow.detail' };
	const frames: LoopFrame[] = [
		{
			puzzle: grid.bare,
			state: grid.blank(),
			caption: { key: 'loop.grow.start', params: { size: grid.size } },
			detail,
			hold: 6
		}
	];
	let grown = 0;
	for (const e of events) {
		if (e.kind === 'grow') {
			region.inside[e.cell] = true;
			const slow = grown < SLOW_STEPS;
			frames.push({
				puzzle: grid.bare,
				state: grid.stateOf(region.border()),
				spotlight: cellKeys([e.cell]),
				area: cellKeys(region.cells()),
				caption: { key: grown++ ? 'loop.grow.grow' : 'loop.grow.first' },
				detail,
				hold: slow ? 3 : 0.5
			});
		} else {
			// The loop as it would be with the cell, its new lines in teal.
			const tried = region.inside.slice();
			tried[e.cell] = true;
			const now = region.border();
			const then = region.border(tried);
			const { dots, holes } = region.why(e.cell);
			frames.push({
				puzzle: grid.bare,
				state: grid.stateOf(then),
				spotlight: [
					...cellKeys([e.cell]),
					...(dots.length ? dots.map((d) => `d:${d}`) : cellKeys(holes))
				],
				area: cellKeys(region.cells(tried)),
				trial: grid.edgeKeys([...then.keys()].filter((k) => then[k] === LINE && now[k] !== LINE)),
				mistake: true,
				caption: { key: dots.length ? 'loop.grow.touch' : 'loop.grow.hole' },
				detail,
				hold: 5
			});
		}
	}
	frames.push({
		puzzle: grid.bare,
		state: grid.stateOf(region.border()),
		area: cellKeys(region.cells()),
		caption: { key: 'loop.grow.done', params: { cells: region.cells().length } },
		detail,
		hold: 4
	});
	return { title: 'loop.chapters.grow', frames };
}

/** Every cell gets the number of loop edges around it; then the loop is hidden. */
function numbers(clues: number[], region: Region): LoopFrame[] {
	const { grid } = region;
	const detail = { key: 'loop.numbers.detail' };
	const loop = region.border();
	const shown = { puzzle: grid.puzzleOf(clues), state: grid.stateOf(loop) };
	const frames: LoopFrame[] = [
		{
			...shown,
			area: cellKeys(region.cells()),
			caption: { key: 'loop.numbers.all' },
			detail,
			hold: 5
		}
	];
	// A 3 and a 0 as examples, where there are, with the lines that the number counts.
	for (const cell of [3, 0].map((clue) => clues.indexOf(clue)).filter((c) => c >= 0)) {
		const counted = [...grid.g.cellEdges.slice(4 * cell, 4 * cell + 4)].filter(
			(e) => loop[e] === LINE
		);
		frames.push({
			...shown,
			spotlight: cellKeys([cell]),
			area: grid.edgeKeys(counted),
			caption: { key: 'loop.numbers.example', params: { clue: clues[cell] } },
			detail,
			hold: 4
		});
	}
	frames.push({
		puzzle: grid.puzzleOf(clues),
		state: grid.blank(),
		caption: { key: 'loop.numbers.hide' },
		detail,
		hold: 5
	});
	return frames;
}

/** Numbers come out in random order; one goes back where the rules get stuck without it. */
function dig(events: Event<'remove'>[], clues: number[], grid: Grid): LoopFrame[] {
	const detail = { key: 'loop.dig.detail' };
	const count = () => clues.filter((x) => x >= 0).length;
	const frames: LoopFrame[] = [
		{
			puzzle: grid.puzzleOf(clues),
			state: grid.blank(),
			caption: { key: 'loop.dig.start' },
			detail,
			hold: 5
		}
	];
	const seen = { kept: 0, back: 0 };
	events.forEach((e, k) => {
		const clue = clues[e.cell];
		clues[e.cell] = -1;
		frames.push({
			puzzle: grid.puzzleOf(clues),
			state: grid.blank(),
			spotlight: cellKeys([e.cell]),
			caption: { key: 'loop.dig.try' },
			detail,
			hold: k < SLOW_STEPS ? 2.5 : 0.6
		});
		if (e.solved) {
			frames.push({
				puzzle: grid.puzzleOf(clues),
				state: grid.blank(),
				caption: { key: 'loop.dig.keep', params: { count: count() } },
				detail,
				hold: seen.kept++ < SLOW_STEPS ? 2.5 : 0.6
			});
			return;
		}
		// Where the rules get without it: the edges they leave open are what the number decides.
		const stuck = rateLoop(grid.puzzleOf(clues), LoopLevel.Basic).edges;
		frames.push({
			puzzle: grid.puzzleOf(clues),
			state: grid.stateOf(stuck),
			spotlight: cellKeys([e.cell]),
			mistake: true,
			caption: { key: 'loop.dig.stuck' },
			detail,
			hold: seen.back++ < SLOW_STEPS ? 4 : 1.5
		});
		clues[e.cell] = clue;
	});
	frames.push({
		puzzle: grid.puzzleOf(clues),
		state: grid.blank(),
		caption: { key: 'loop.dig.done', params: { count: count() } },
		detail,
		hold: 5
	});
	return frames;
}

/** What a step of the rules is, from what it decided and how the board looks after it. */
function kindOf(e: Event<'decide'>, puzzle: LoopPuzzle, edges: Uint8Array, grid: Grid): string {
	const crossesOnly = e.lines.length === 0;
	const linesOnly = e.crosses.length === 0;
	const around = (list: Int32Array) => {
		const own = [...list].filter((x) => x >= 0);
		return {
			lines: own.filter((x) => edges[x] === LINE).length,
			open: own.filter((x) => edges[x] === OPEN).length
		};
	};
	if (e.rule === 'cell') {
		const clue = clueAt(puzzle, e.at);
		const { lines, open } = around(grid.g.cellEdges.slice(4 * e.at, 4 * e.at + 4));
		if (clue < 0) return 'cellCorner';
		if (clue === 0) return 'zero';
		if (open === 0 && lines === clue && crossesOnly) return 'full';
		if (open === 0 && lines === clue && linesOnly) return 'needs';
		return 'clueCorner';
	}
	if (e.rule === 'dot') {
		const { lines, open } = around(grid.layout.dotEdge.slice(4 * e.at, 4 * e.at + 4));
		if (lines === 2 && crossesOnly) return 'dotFull';
		if (lines === 2 && open === 0 && linesOnly) return 'dotOn';
		if (lines === 0 && open === 0 && crossesOnly) return 'dotEnd';
		return 'dotCorner';
	}
	return edges.includes(OPEN) ? 'loop' : 'closed';
}

const linesOf = (edges: Uint8Array) => [...edges.keys()].filter((e) => edges[e] === LINE);

/** The lines of the paths that the crossed edges would have closed into a loop. */
function pathsOf(crosses: number[], edges: Uint8Array, grid: Grid): number[] {
	const parent = Array.from({ length: grid.g.dots }, (_, d) => d);
	const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
	for (const e of linesOf(edges)) parent[find(grid.g.ends[2 * e])] = find(grid.g.ends[2 * e + 1]);
	const closed = new Set(crosses.map((e) => find(grid.g.ends[2 * e])));
	return linesOf(edges).filter((e) => closed.has(find(grid.g.ends[2 * e])));
}

/** The rating solver solves the puzzle the way a person would: one cell or dot at a time. */
function solve(steps: Event<'decide'>[], puzzle: LoopPuzzle, grid: Grid): LoopChapter {
	const edges = new Uint8Array(grid.g.edges);
	const frames: LoopFrame[] = [
		{
			puzzle,
			state: grid.blank(),
			caption: { key: 'loop.solve.start' },
			detail: { key: 'loop.solve.startDetail' },
			hold: 5
		}
	];
	const seen: Record<string, number> = {};
	for (const e of steps) {
		const before = edges.slice();
		for (const x of e.lines) edges[x] = LINE;
		for (const x of e.crosses) edges[x] = CROSS;
		const kind = kindOf(e, puzzle, edges, grid);
		const slow = (seen[kind] = (seen[kind] ?? 0) + 1) <= SLOW_STEPS;
		// The cell or dot whose rule it is, the path a crossed edge would close, or the whole loop.
		const area =
			e.rule === 'cell'
				? [`c:${e.at}`]
				: e.rule === 'dot'
					? [`d:${e.at}`]
					: grid.edgeKeys(kind === 'closed' ? linesOf(edges) : pathsOf(e.crosses, before, grid));
		frames.push({
			puzzle,
			state: grid.stateOf(edges),
			spotlight: grid.edgeKeys([...e.lines, ...e.crosses]),
			area,
			caption: {
				key: `loop.solve.${kind}`,
				params: e.rule === 'cell' ? { clue: clueAt(puzzle, e.at) } : undefined
			},
			detail: { key: `loop.solve.${e.rule}Detail` },
			hold: slow ? 4 : 0.8
		});
	}
	frames.push({
		puzzle,
		state: grid.stateOf(edges),
		caption: { key: 'loop.solve.done', params: { steps: steps.length } },
		detail: { key: 'loop.solve.doneDetail' },
		hold: 5
	});
	return { title: 'loop.chapters.solve', frames };
}
