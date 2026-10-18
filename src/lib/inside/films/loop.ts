import { generateLoop } from '../../games/loop/generator';
import {
	clueAt,
	CROSS,
	edgeKey,
	LINE,
	OPEN,
	stateFromEdges,
	type LoopPuzzle,
	type LoopState
} from '../../games/loop/rules';
import { LoopLevel, loopLayout, rateLoop, type LoopTraceEvent } from '../../games/loop/solver';
import type { Chapter, Film, Frame } from '../film';

type LoopFrame = Frame<LoopPuzzle, LoopState>;
type LoopChapter = Chapter<LoopPuzzle, LoopState>;
type Kind = LoopTraceEvent['kind'];
type Event<K extends Kind> = Extract<LoopTraceEvent, { kind: K }>;

const SIZE = 7;
const N = SIZE * SIZE;
/** The film's puzzle: cells are turned away for both reasons, and the rules cross loops that close too early. */
export const LOOP_SEED = 13;
/** The first steps of a kind stay longer, so that the idea can be followed before it speeds up. */
const SLOW_STEPS = 3;

const layout = loopLayout(SIZE, SIZE);
const { g } = layout;
const cellKeys = (cells: Iterable<number>) => [...cells].map((c) => `c:${c}`);
const puzzleOf = (clues: number[]): LoopPuzzle => ({
	width: SIZE,
	height: SIZE,
	clues: clues.map((x) => (x < 0 ? '.' : String(x))).join('')
});
/** The board without numbers, as the loop grows. */
const bare = puzzleOf(new Array(N).fill(-1));
const edgeKeys = (edges: number[]) => edges.map((e) => edgeKey(bare, e));
const stateOf = (edges: ArrayLike<number>) => stateFromEdges(bare, edges);
const blank = (): LoopState => stateOf(new Uint8Array(g.edges));

/** The events of the given kinds, in order. */
function only<K extends Kind>(events: LoopTraceEvent[], ...kinds: K[]): Event<K>[] {
	return events.filter((e): e is Event<K> => (kinds as Kind[]).includes(e.kind));
}

/** The cells inside the loop as it grows, and what a cell would do to it. */
class Region {
	readonly inside = new Array<boolean>(N).fill(false);

	/** The loop around the inside cells, as edge values: a line where the two sides differ. */
	border(inside = this.inside): Uint8Array {
		const at = (c: number) => c < N && inside[c];
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
		const at = (c: number) => c < N && inside[c];
		const { dotCell, cellSide } = layout;
		const dots: number[] = [];
		for (let d = 0; d < g.dots; d++) {
			const [a, b, x, y] = [0, 1, 2, 3].map((k) => at(dotCell[4 * d + k]));
			if (a === y && b === x && a !== b) dots.push(d);
		}
		// The outside cells that reach the edge of the grid, by flood fill from there.
		const sides = (c: number) => [...cellSide.slice(4 * c, 4 * c + 4)];
		const reached = inside.map((x, c) => !x && sides(c).includes(N));
		const stack = this.cells(reached);
		while (stack.length) {
			for (const k of sides(stack.pop()!)) {
				if (k < N && !inside[k] && !reached[k]) {
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
 * How a normal 7×7 Loop is made, from the generator's own trace: a region of cells grows so that
 * its border stays one loop, every cell gets the number of loop edges around it, numbers come out
 * while the rules still solve the puzzle, and the rules solve it step by step.
 */
export function loopFilm(seed = LOOP_SEED): Film<LoopPuzzle, LoopState> {
	const events: LoopTraceEvent[] = [];
	const { puzzle } = generateLoop(SIZE, SIZE, 'normal', seed, (e) => events.push(e));
	// Only the last attempt made the puzzle; the ones before failed with every clue shown.
	const last = events.slice(events.map((e) => e.kind).lastIndexOf('attempt'));
	const solving: LoopTraceEvent[] = [];
	rateLoop(puzzle, LoopLevel.Basic, undefined, (e) => solving.push(e));
	const region = new Region();
	const clues = only(last, 'clues')[0].clues;
	return {
		game: 'loop',
		settings: { dimSatisfiedClues: false },
		chapters: [
			grow(only(last, 'grow', 'block'), region),
			{
				title: 'loop.chapters.numbers',
				frames: [...numbers(clues, region), ...dig(only(last, 'remove'), clues.slice())]
			},
			solve(only(solving, 'decide'), puzzle)
		]
	};
}

/** A region grows from one cell, cell by cell, and its border is always one loop. */
function grow(events: Event<'grow' | 'block'>[], region: Region): LoopChapter {
	const detail = { key: 'loop.grow.detail' };
	const frames: LoopFrame[] = [
		{
			puzzle: bare,
			state: blank(),
			caption: { key: 'loop.grow.start' },
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
				puzzle: bare,
				state: stateOf(region.border()),
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
				puzzle: bare,
				state: stateOf(then),
				spotlight: [
					...cellKeys([e.cell]),
					...(dots.length ? dots.map((d) => `d:${d}`) : cellKeys(holes))
				],
				area: cellKeys(region.cells(tried)),
				trial: edgeKeys([...then.keys()].filter((k) => then[k] === LINE && now[k] !== LINE)),
				mistake: true,
				caption: { key: dots.length ? 'loop.grow.touch' : 'loop.grow.hole' },
				detail,
				hold: 5
			});
		}
	}
	frames.push({
		puzzle: bare,
		state: stateOf(region.border()),
		area: cellKeys(region.cells()),
		caption: { key: 'loop.grow.done', params: { cells: region.cells().length } },
		detail,
		hold: 4
	});
	return { title: 'loop.chapters.grow', frames };
}

/** Every cell gets the number of loop edges around it; then the loop is hidden. */
function numbers(clues: number[], region: Region): LoopFrame[] {
	const detail = { key: 'loop.numbers.detail' };
	const loop = region.border();
	const shown = { puzzle: puzzleOf(clues), state: stateOf(loop) };
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
		const counted = [...g.cellEdges.slice(4 * cell, 4 * cell + 4)].filter((e) => loop[e] === LINE);
		frames.push({
			...shown,
			spotlight: cellKeys([cell]),
			area: edgeKeys(counted),
			caption: { key: 'loop.numbers.example', params: { clue: clues[cell] } },
			detail,
			hold: 4
		});
	}
	frames.push({
		puzzle: puzzleOf(clues),
		state: blank(),
		caption: { key: 'loop.numbers.hide' },
		detail,
		hold: 5
	});
	return frames;
}

/** Numbers come out in random order; one goes back where the rules get stuck without it. */
function dig(events: Event<'remove'>[], clues: number[]): LoopFrame[] {
	const detail = { key: 'loop.dig.detail' };
	const count = () => clues.filter((x) => x >= 0).length;
	const frames: LoopFrame[] = [
		{
			puzzle: puzzleOf(clues),
			state: blank(),
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
			puzzle: puzzleOf(clues),
			state: blank(),
			spotlight: cellKeys([e.cell]),
			caption: { key: 'loop.dig.try' },
			detail,
			hold: k < SLOW_STEPS ? 2.5 : 0.6
		});
		if (e.solved) {
			frames.push({
				puzzle: puzzleOf(clues),
				state: blank(),
				caption: { key: 'loop.dig.keep', params: { count: count() } },
				detail,
				hold: seen.kept++ < SLOW_STEPS ? 2.5 : 0.6
			});
			return;
		}
		// Where the rules get without it: the edges they leave open are what the number decides.
		const stuck = rateLoop(puzzleOf(clues), LoopLevel.Basic).edges;
		frames.push({
			puzzle: puzzleOf(clues),
			state: stateOf(stuck),
			spotlight: cellKeys([e.cell]),
			mistake: true,
			caption: { key: 'loop.dig.stuck' },
			detail,
			hold: seen.back++ < SLOW_STEPS ? 4 : 1.5
		});
		clues[e.cell] = clue;
	});
	frames.push({
		puzzle: puzzleOf(clues),
		state: blank(),
		caption: { key: 'loop.dig.done', params: { count: count() } },
		detail,
		hold: 5
	});
	return frames;
}

/** What a step of the rules is, from what it decided and how the board looks after it. */
function kindOf(e: Event<'decide'>, puzzle: LoopPuzzle, edges: Uint8Array): string {
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
		const { lines, open } = around(g.cellEdges.slice(4 * e.at, 4 * e.at + 4));
		if (clue < 0) return 'cellCorner';
		if (clue === 0) return 'zero';
		if (open === 0 && lines === clue && crossesOnly) return 'full';
		if (open === 0 && lines === clue && linesOnly) return 'needs';
		return 'clueCorner';
	}
	if (e.rule === 'dot') {
		const { lines, open } = around(layout.dotEdge.slice(4 * e.at, 4 * e.at + 4));
		if (lines === 2 && crossesOnly) return 'dotFull';
		if (lines === 2 && open === 0 && linesOnly) return 'dotOn';
		if (lines === 0 && open === 0 && crossesOnly) return 'dotEnd';
		return 'dotCorner';
	}
	return edges.includes(OPEN) ? 'loop' : 'closed';
}

const linesOf = (edges: Uint8Array) => [...edges.keys()].filter((e) => edges[e] === LINE);

/** The lines of the paths that the crossed edges would have closed into a loop. */
function pathsOf(crosses: number[], edges: Uint8Array): number[] {
	const parent = Array.from({ length: g.dots }, (_, d) => d);
	const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
	for (const e of linesOf(edges)) parent[find(g.ends[2 * e])] = find(g.ends[2 * e + 1]);
	const closed = new Set(crosses.map((e) => find(g.ends[2 * e])));
	return linesOf(edges).filter((e) => closed.has(find(g.ends[2 * e])));
}

/** The rating solver solves the puzzle the way a person would: one cell or dot at a time. */
function solve(steps: Event<'decide'>[], puzzle: LoopPuzzle): LoopChapter {
	const edges = new Uint8Array(g.edges);
	const frames: LoopFrame[] = [
		{
			puzzle,
			state: blank(),
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
		const kind = kindOf(e, puzzle, edges);
		const slow = (seen[kind] = (seen[kind] ?? 0) + 1) <= SLOW_STEPS;
		// The cell or dot whose rule it is, the path a crossed edge would close, or the whole loop.
		const area =
			e.rule === 'cell'
				? [`c:${e.at}`]
				: e.rule === 'dot'
					? [`d:${e.at}`]
					: edgeKeys(kind === 'closed' ? linesOf(edges) : pathsOf(e.crosses, before));
		frames.push({
			puzzle,
			state: stateOf(edges),
			spotlight: edgeKeys([...e.lines, ...e.crosses]),
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
		state: stateOf(edges),
		caption: { key: 'loop.solve.done', params: { steps: steps.length } },
		detail: { key: 'loop.solve.doneDetail' },
		hold: 5
	});
	return { title: 'loop.chapters.solve', frames };
}
