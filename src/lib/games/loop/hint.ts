import {
	clueAt,
	CROSS,
	edgeValues,
	isSolvedState,
	LINE,
	OPEN,
	type LoopPuzzle,
	type LoopState
} from './rules';
import { LoopLevel, loopLayout, LoopSolver, rateLoop, solveLoop, type LoopLayout } from './solver';

/**
 * Deductions a hint can name, from the simplest to the hardest. Each looks at a small part of the
 * board with the player's lines and crosses and decides edges there.
 *
 * - `clue`: a number with all its lines, or with just enough free sides left for them.
 * - `dot`: the loop passes a dot with two lines or none.
 * - `loop`: an edge that would close a small loop while the rest still needs the loop.
 * - `corner`: a number together with the dots at its corners, none of which may end up with one
 *   line or three (a 3 in the corner of the grid, a line running into the corner of a 3 or a 1).
 * - `pair`: two numbers that share a dot, with the dots around them (two 3s on a diagonal).
 * - `block`: a 2×2 block of cells with its numbers and dots, when no pair decides an edge.
 * - `sides`: inside and outside. A line switches sides, a cross does not, and beyond the grid is
 *   outside; cells known to be on the same side, or on different sides, decide the edge between.
 * - `split`: inside and outside around a number, which counts its neighbours on the other side
 *   (a 2 has two neighbours inside and two outside): with the cells joined to them, that puts
 *   cells on known sides of each other.
 * - `splitPair`: the same around two numbers together.
 * - `assumption`: none of those applies, but trying a line or a cross on an edge leads to a
 *   contradiction.
 */
export const TECHNIQUES = [
	'clue',
	'dot',
	'loop',
	'corner',
	'pair',
	'sides',
	'block',
	'split',
	'splitPair',
	'assumption'
] as const;
export type Technique = (typeof TECHNIQUES)[number];

/** Why a step's edges follow, one per text the hint shows. */
export type Reason =
	| 'clueZero'
	| 'clueFull'
	| 'clueFill'
	| 'dotFull'
	| 'dotOn'
	| 'dotEnd'
	| 'loop'
	| 'cornerLine'
	| 'cornerCross'
	| 'pairLine'
	| 'pairCross'
	| 'blockLine'
	| 'blockCross'
	| 'sidesSame'
	| 'sidesOther'
	| 'splitLine'
	| 'splitCross'
	| 'splitPairLine'
	| 'splitPairCross'
	| 'assumeLine'
	| 'assumeCross';

/** Crosses a line rests on that are not on the board yet: one deduction, and its edges the line needs. */
export interface Support {
	reason: Reason;
	edges: number[];
	cells: number[];
	dots: number[];
}

export type LoopHint =
	/** Lines where the loop does not run, and crosses where it does. Edges in the graph's numbering. */
	| { kind: 'mistake'; edges: number[] }
	/**
	 * Edges that follow, all with the same mark. `cells` and `dots` are what the deduction looks
	 * at; `path` the edges of a line that matters (the loop that must not close).
	 */
	| {
			kind: 'step';
			technique: Technique;
			reason: Reason;
			mark: 'line' | 'cross';
			edges: number[];
			cells: number[];
			dots: number[];
			path: number[];
			/** The number of the cell the deduction starts from, for the texts. */
			clue?: number;
			/** For an assumption: what breaks when the edge is tried (a number, a dot, ...). */
			breaks?: Breaks;
			/** Crosses the step needs that the player has not set, in the order they follow. */
			support?: Support[];
	  }
	/** No deduction applies (not seen on a puzzle with one solution): an open edge to try. */
	| { kind: 'stuck'; edges: number[] };

type Step = Extract<LoopHint, { kind: 'step' }>;

/** What an assumption runs into: a number's count, a dot, a loop that closes early, or inside and outside. */
export type Breaks = 'clue' | 'dot' | 'loop' | 'sides';

const solutions = new WeakMap<LoopPuzzle, Uint8Array | null>();

function solutionOf(p: LoopPuzzle): Uint8Array | null {
	if (!solutions.has(p)) {
		// Marks can only be wrong against the one solution of a proper puzzle.
		const res = solveLoop(p, { limit: 2, maxNodes: 2_000_000 });
		solutions.set(p, res.solutions.length === 1 ? res.solutions[0] : null);
	}
	return solutions.get(p)!;
}

/** The next step from the player's lines and crosses: a mistake, edges that follow, or none. */
export function loopHint(p: LoopPuzzle, state: LoopState): LoopHint | null {
	if (isSolvedState(p, state)) return null;
	const v = Uint8Array.from(edgeValues(state));
	const solution = solutionOf(p);
	if (solution) {
		const wrong = [...v.keys()].filter(
			(e) => (v[e] === LINE && solution[e] !== LINE) || (v[e] === CROSS && solution[e] === LINE)
		);
		if (wrong.length) return { kind: 'mistake', edges: wrong };
	}
	return new Deduction(p, v).next();
}

const lists = new WeakMap<LoopLayout, { cells: number[][]; dots: number[][] }>();

/** The edges of every cell and every dot of a grid, made once per size: hints look them up a lot. */
function edgeLists(l: LoopLayout) {
	let known = lists.get(l);
	if (!known) {
		known = {
			cells: Array.from({ length: l.n }, (_, c) => [...l.g.cellEdges.subarray(4 * c, 4 * c + 4)]),
			dots: Array.from({ length: l.g.dots }, (_, d) =>
				[...l.dotEdge.subarray(4 * d, 4 * d + 4)].filter((e) => e >= 0)
			)
		};
		lists.set(l, known);
	}
	return known;
}

/** Edges a window decides, and the edges it looked at; null when it decides none. */
type WindowResult = { edges: number[]; inputs: number[] } | null;

/** The steps of one technique with a given mark (LINE or CROSS), found one after the other. */
type Finder = (want: number) => Iterable<Step>;

class Deduction {
	private readonly l: LoopLayout;
	private readonly n: number;
	private readonly clue: number[];
	/** The deductions, simplest first. */
	private readonly finders: Finder[];
	/** The edges each step looked at, to find the crosses it rests on. */
	private readonly inputs = new Map<Step, readonly number[]>();
	/** Crosses that followed on the way to a line, per edge, in the order they followed. */
	private readonly made = new Map<number, Step>();
	/** When each edge got a cross that followed (`clock` counts the crosses), for `cachedWindow`. */
	private readonly changedAt: Int32Array;
	private clock = 0;
	private border: [number, number][] | null = null;
	private readonly windowCache = new Map<
		string,
		{ at: number; reads: number[]; found: WindowResult }
	>();

	/** `v`: the player's marks, a copy that takes the crosses that follow. */
	constructor(
		private readonly p: LoopPuzzle,
		private readonly v: Uint8Array
	) {
		this.l = loopLayout(p.width, p.height);
		this.n = p.width * p.height;
		this.clue = Array.from({ length: this.n }, (_, c) => clueAt(p, c));
		this.changedAt = new Int32Array(v.length);
		this.finders = [
			(want) => this.clueSteps(want),
			(want) => this.dotSteps(want),
			(want) => (want === CROSS ? this.loopSteps() : []),
			(want) => this.cornerSteps(want),
			(want) => this.pairSteps(want),
			(want) => this.sidesSteps(want),
			(want) => this.blockSteps(want),
			(want) => this.splitSteps(want, false),
			(want) => this.splitSteps(want, true)
		];
	}

	/**
	 * Lines first: they are what solves the puzzle, while crosses only help. So the deductions up
	 * to a technique look for a line; when there is none, the simplest cross they find goes on the
	 * board copy and they look again, and only when no cross follows either does the next
	 * technique join in. The line found comes with the crosses it rests on. When no line follows
	 * at all, an edge is tried; a cross the player can set right away is the last resort.
	 */
	next(): LoopHint {
		let first: Step | null = null;
		for (let level = 0; level < this.finders.length;) {
			const line = this.find(level, LINE);
			if (line) return { ...line, support: this.support(line) };
			const cross = this.find(level, CROSS);
			if (!cross) {
				level++;
				continue;
			}
			first ??= cross;
			this.clock++;
			for (const e of cross.edges) {
				this.v[e] = CROSS;
				this.changedAt[e] = this.clock;
				this.made.set(e, cross);
			}
		}
		return this.assume() ?? first ?? { kind: 'stuck', edges: this.open().slice(0, 1) };
	}

	/** The first step with mark `want` of the techniques up to `level`, the simplest first. */
	private find(level: number, want: number): Step | null {
		for (let t = 0; t <= level; t++) {
			for (const step of this.finders[t](want)) return step;
		}
		return null;
	}

	/**
	 * The crosses `step` rests on that are not the player's, and in turn the ones they rest on,
	 * in the order they followed. Each with the edges that were needed of it.
	 */
	private support(step: Step): Support[] {
		const needed = new Map<Step, Set<number>>();
		const visit = (edges: readonly number[]) => {
			for (const e of edges) {
				const by = this.made.get(e);
				if (!by) continue;
				const known = needed.get(by);
				if (known) {
					known.add(e);
					continue;
				}
				needed.set(by, new Set([e]));
				// What it rests on, not the other edges it decided.
				visit(this.inputs.get(by)!.filter((x) => !by.edges.includes(x)));
			}
		};
		visit(this.inputs.get(step)!);
		const order = [...new Set(this.made.values())];
		return [...needed]
			.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
			.map(([s, edges]) => ({
				reason: s.reason,
				edges: s.edges.filter((e) => edges.has(e)),
				cells: s.cells,
				dots: s.dots
			}));
	}

	private open(): number[] {
		return [...this.v.keys()].filter((e) => this.v[e] === OPEN);
	}

	private cellEdges(c: number): readonly number[] {
		return edgeLists(this.l).cells[c];
	}

	private dotEdges(d: number): readonly number[] {
		return edgeLists(this.l).dots[d];
	}

	private cornerDots(c: number): number[] {
		return [...this.l.cornerDot.subarray(4 * c, 4 * c + 4)];
	}

	private count(edges: readonly number[], value: number): number {
		return edges.filter((e) => this.v[e] === value).length;
	}

	/** A step that decides `edges`, having looked at the edges `inputs`. */
	private step(
		technique: Technique,
		reason: Reason,
		edges: number[],
		value: number,
		inputs: readonly number[],
		where: Partial<Pick<Step, 'cells' | 'dots' | 'path' | 'clue' | 'breaks'>>
	): Step {
		const step: Step = {
			kind: 'step',
			technique,
			reason,
			mark: value === LINE ? 'line' : 'cross',
			edges,
			cells: [],
			dots: [],
			path: [],
			...where
		};
		this.inputs.set(step, inputs);
		return step;
	}

	/** A number with all its lines (cross the rest), or with just enough free sides (draw them). */
	private *clueSteps(want: number): Generator<Step> {
		for (let c = 0; c < this.n; c++) {
			const clue = this.clue[c];
			if (clue < 0) continue;
			const edges = this.cellEdges(c);
			const open = edges.filter((e) => this.v[e] === OPEN);
			if (!open.length) continue;
			const lines = this.count(edges, LINE);
			if (want === LINE && lines + open.length === clue) {
				yield this.step('clue', 'clueFill', open, LINE, edges, { cells: [c], clue });
			}
			if (want === CROSS && lines === clue) {
				const reason = clue === 0 ? 'clueZero' : 'clueFull';
				yield this.step('clue', reason, open, CROSS, edges, { cells: [c], clue });
			}
		}
	}

	/** Two lines meet (cross the rest), a line has one way on, or a dot has one free edge left. */
	private *dotSteps(want: number): Generator<Step> {
		for (let d = 0; d < this.l.g.dots; d++) {
			const edges = this.dotEdges(d);
			const open = edges.filter((e) => this.v[e] === OPEN);
			if (!open.length) continue;
			const lines = this.count(edges, LINE);
			if (want === LINE && lines === 1 && open.length === 1) {
				yield this.step('dot', 'dotOn', open, LINE, edges, { dots: [d] });
			}
			if (want !== CROSS) continue;
			if (lines === 2) yield this.step('dot', 'dotFull', open, CROSS, edges, { dots: [d] });
			else if (lines === 0 && open.length === 1) {
				yield this.step('dot', 'dotEnd', open, CROSS, edges, { dots: [d] });
			}
		}
	}

	/** An open edge between the two ends of one line, which may not close the loop yet. */
	private *loopSteps(): Generator<Step> {
		const { ends, edges } = this.l.g;
		const parent = Array.from({ length: this.l.g.dots }, (_, d) => d);
		const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
		let lines = 0;
		for (let e = 0; e < edges; e++) {
			if (this.v[e] !== LINE) continue;
			lines++;
			parent[find(ends[2 * e])] = find(ends[2 * e + 1]);
		}
		for (let e = 0; e < edges; e++) {
			if (this.v[e] !== OPEN) continue;
			const root = find(ends[2 * e]);
			if (root !== find(ends[2 * e + 1])) continue;
			const path = [...this.v.keys()].filter(
				(x) => this.v[x] === LINE && find(ends[2 * x]) === root
			);
			// Closing it is the last step of the puzzle when every line and number agrees.
			if (path.length === lines && this.closesSolution(e)) continue;
			yield this.step('loop', 'loop', [e], CROSS, path, { path });
		}
	}

	private closesSolution(e: number): boolean {
		for (let c = 0; c < this.n; c++) {
			if (this.clue[c] < 0) continue;
			const edges = this.cellEdges(c);
			if (this.count(edges, LINE) + (edges.includes(e) ? 1 : 0) !== this.clue[c]) return false;
		}
		return true;
	}

	/**
	 * `window`, looked up again only when an edge it reads has changed since: `next` scans the
	 * whole board again after every cross it finds, which would try thousands of ways for every
	 * 2×2 block of a big grid each time.
	 */
	private cachedWindow(cells: number[], want: number): WindowResult {
		const key = `${want}:${cells.join(',')}`;
		const known = this.windowCache.get(key);
		if (known && known.reads.every((e) => this.changedAt[e] <= known.at)) return known.found;
		const reads: number[] = [];
		const found = this.window(cells, want, reads);
		this.windowCache.set(key, { at: this.clock, reads, found });
		return found;
	}

	/**
	 * Tries every way to draw the open edges of these cells. A way fits when each number keeps
	 * its count and each dot can still end with two lines or none: no dot gets three lines, and
	 * one with a single line has a free edge left outside these cells. Returns the edges that
	 * every way that fits agrees on with mark `want`, and the edges it looked at.
	 */
	private window(cells: number[], want: number, reads: number[]): WindowResult {
		const around = [...new Set(cells.flatMap((c) => this.cellEdges(c)))];
		reads.push(...around);
		const w = around.filter((e) => this.v[e] === OPEN);
		if (!w.length) return null;
		const { ends } = this.l.g;
		const dots = [...new Set(w.flatMap((e) => [ends[2 * e], ends[2 * e + 1]]))];
		for (const d of dots) reads.push(...this.dotEdges(d));
		const bit = new Map(w.map((e, k) => [e, 1 << k]));
		const maskOf = (edges: readonly number[]) => edges.reduce((m, e) => m | (bit.get(e) ?? 0), 0);
		// Each number needs this many more lines among its open edges, which are all in the window.
		const needs = cells.flatMap((c) => {
			if (this.clue[c] < 0) return [];
			const edges = this.cellEdges(c);
			return [[maskOf(edges), this.clue[c] - this.count(edges, LINE)]];
		});
		// Each dot: its edges in the window, its lines, and whether an edge outside stays free.
		const ways = dots.map((d) => {
			const edges = this.dotEdges(d);
			const free = edges.some((e) => this.v[e] === OPEN && !bit.has(e));
			return [maskOf(edges), this.count(edges, LINE), free ? 1 : 0];
		});
		let all = (1 << w.length) - 1;
		let any = 0;
		let found = false;
		for (let a = 0; a < 1 << w.length; a++) {
			let fits = needs.every(([mask, need]) => popCount(a & mask) === need);
			for (let k = 0; fits && k < ways.length; k++) {
				const [mask, before, free] = ways[k];
				const lines = before + popCount(a & mask);
				fits = lines <= 2 && (lines !== 1 || free === 1);
			}
			if (!fits) continue;
			found = true;
			all &= a;
			any |= a;
		}
		if (!found) return null;
		const edges =
			want === LINE ? w.filter((_, k) => all & (1 << k)) : w.filter((_, k) => !(any & (1 << k)));
		if (!edges.length) return null;
		return { edges, inputs: [...new Set([...around, ...dots.flatMap((d) => this.dotEdges(d))])] };
	}

	/** Windows over these groups of cells that decide edges with mark `want`. */
	private *windows(
		groups: number[][],
		want: number,
		make: (cells: number[], edges: number[], inputs: number[]) => Step
	): Generator<Step> {
		for (const cells of groups) {
			const found = this.cachedWindow(cells, want);
			if (found) yield make(cells, found.edges, found.inputs);
		}
	}

	private *cornerSteps(want: number): Generator<Step> {
		const groups = this.clue.flatMap((clue, c) => (clue >= 0 ? [[c]] : []));
		const reason = want === LINE ? 'cornerLine' : 'cornerCross';
		yield* this.windows(groups, want, ([c], edges, inputs) =>
			this.step('corner', reason, edges, want, inputs, {
				cells: [c],
				dots: this.cornerDots(c),
				clue: this.clue[c]
			})
		);
	}

	private *pairSteps(want: number): Generator<Step> {
		const w = this.p.width;
		const groups: number[][] = [];
		for (let c = 0; c < this.n; c++) {
			if (this.clue[c] < 0) continue;
			const r = Math.floor(c / w);
			const col = c % w;
			// The neighbours that share a dot with it, each pair once.
			for (const [dr, dc] of [
				[0, 1],
				[1, -1],
				[1, 0],
				[1, 1]
			]) {
				const r2 = r + dr;
				const c2 = col + dc;
				if (r2 >= this.p.height || c2 < 0 || c2 >= w || this.clue[r2 * w + c2] < 0) continue;
				groups.push([c, r2 * w + c2]);
			}
		}
		const reason = want === LINE ? 'pairLine' : 'pairCross';
		yield* this.windows(groups, want, (cells, edges, inputs) => {
			const shared = this.cornerDots(cells[0]).filter((d) => this.cornerDots(cells[1]).includes(d));
			return this.step('pair', reason, edges, want, inputs, { cells, dots: shared });
		});
	}

	private *blockSteps(want: number): Generator<Step> {
		const w = this.p.width;
		const groups: number[][] = [];
		for (let r = 0; r + 1 < this.p.height; r++) {
			for (let c = 0; c + 1 < w; c++) {
				const top = r * w + c;
				groups.push([top, top + 1, top + w, top + w + 1]);
			}
		}
		const reason = want === LINE ? 'blockLine' : 'blockCross';
		yield* this.windows(groups, want, (cells, edges, inputs) =>
			this.step('block', reason, edges, want, inputs, { cells })
		);
	}

	/**
	 * Inside and outside along the decided edges: an open edge whose two cells are joined by a
	 * path of decided edges (outside the grid counts as one more cell). An odd number of lines on
	 * the way puts them on different sides (a line), an even one on the same side (a cross). The
	 * shortest such path to an edge with mark `want` is named.
	 */
	private *sidesSteps(want: number): Generator<Step> {
		const { edgeSide, cellSide } = this.l;
		const out = this.n;
		let best: { e: number; cells: number[]; path: number[] } | null = null;
		// Cells joined by decided edges: only edges between two joined cells need the search.
		const parent = Int32Array.from({ length: out + 1 }, (_, x) => x);
		const root = (x: number): number => {
			while (parent[x] !== x) x = parent[x] = parent[parent[x]];
			return x;
		};
		for (let e = 0; e < this.v.length; e++) {
			if (this.v[e] !== OPEN) parent[root(edgeSide[2 * e])] = root(edgeSide[2 * e + 1]);
		}
		for (const e of this.open()) {
			const [a, b] = [edgeSide[2 * e], edgeSide[2 * e + 1]];
			if (root(a) !== root(b)) continue;
			// Breadth-first from a to b over decided edges.
			const prev = new Map<number, [number, number]>([[a, [-1, -1]]]);
			const queue = [a];
			for (let head = 0; head < queue.length && !prev.has(b); head++) {
				const x = queue[head];
				const steps: [number, number][] =
					x === out
						? this.borderSteps()
						: [0, 1, 2, 3].map((k) => [cellSide[4 * x + k], this.l.g.cellEdges[4 * x + k]]);
				for (const [y, edge] of steps) {
					if (this.v[edge] === OPEN || prev.has(y)) continue;
					prev.set(y, [x, edge]);
					queue.push(y);
				}
			}
			if (!prev.has(b)) continue;
			const cells: number[] = [];
			const path: number[] = [];
			for (let x = b; x !== a;) {
				const [from, edge] = prev.get(x)!;
				path.push(edge);
				if (x !== out) cells.push(x);
				x = from;
			}
			const lines = this.count(path, LINE);
			if ((lines % 2 ? LINE : CROSS) !== want) continue;
			if (a !== out) cells.push(a);
			if (!best || cells.length < best.cells.length) best = { e, cells, path };
		}
		if (!best) return;
		const reason = want === LINE ? 'sidesOther' : 'sidesSame';
		yield this.step('sides', reason, [best.e], want, best.path, { cells: best.cells.reverse() });
	}

	/**
	 * Cells joined by decided edges: per cell (outside last) the first cell of its group and its
	 * side relative to that one (1: across an odd number of lines).
	 */
	private sideGroups(): { group: Int32Array; side: Uint8Array } {
		const out = this.n;
		const group = new Int32Array(out + 1).fill(-1);
		const side = new Uint8Array(out + 1);
		const { cellSide } = this.l;
		const { cellEdges } = this.l.g;
		const queue = new Int32Array(out + 1);
		for (let s = 0; s <= out; s++) {
			if (group[s] >= 0) continue;
			group[s] = s;
			queue[0] = s;
			for (let head = 0, tail = 1; head < tail; head++) {
				const x = queue[head];
				const visit = (y: number, edge: number) => {
					if (this.v[edge] === OPEN || group[y] >= 0) return;
					group[y] = s;
					side[y] = side[x] ^ (this.v[edge] === LINE ? 1 : 0);
					queue[tail++] = y;
				};
				if (x === out) for (const [y, edge] of this.borderSteps()) visit(y, edge);
				else for (let k = 0; k < 4; k++) visit(cellSide[4 * x + k], cellEdges[4 * x + k]);
			}
		}
		return { group, side };
	}

	/**
	 * Inside and outside around numbers: a number counts its neighbours on the other side of the
	 * loop. Cells joined by decided edges keep their sides to each other, so only some ways to put
	 * a number and its neighbours inside or outside fit its count. Where two of them lie the same
	 * way to each other in every way that fits, an open edge between cells joined to them
	 * follows: a line when its cells lie on different sides, a cross when on the same side. One
	 * number at a time, or (`two`) two numbers whose neighbours are joined, with the ways that fit
	 * both. The step with the shortest walks is named.
	 */
	private *splitSteps(want: number, two: boolean): Generator<Step> {
		const { edgeSide } = this.l;
		const out = this.n;
		const { group, side } = this.sideGroups();
		// Open edges by the groups of their two cells.
		const between = new Map<number, number[]>();
		const pair = (a: number, b: number) => (a < b ? a * (out + 1) + b : b * (out + 1) + a);
		for (const e of this.open()) {
			const [ga, gb] = [group[edgeSide[2 * e]], group[edgeSide[2 * e + 1]]];
			if (ga === gb) continue;
			const known = between.get(pair(ga, gb));
			if (known) known.push(e);
			else between.set(pair(ga, gb), [e]);
		}
		// The numbers by an open edge: their neighbours lie in two groups or more.
		const numbers = this.clue.flatMap((clue, c) =>
			clue >= 0 && new Set(this.around(c).map((x) => group[x])).size > 1 ? [c] : []
		);
		const sets = two ? this.splitPairs(numbers, group, side) : numbers.map((c) => [c]);
		let best: {
			cost: number;
			set: number[];
			e: number;
			joins: (Walk | null)[];
			walks: Map<number, Walk>;
		} | null = null;
		for (const set of sets) {
			const items = set.flatMap((c) => this.around(c));
			const groups = [...new Set(items.map((x) => group[x]))];
			const count = groups.length;
			const index = items.map((x) => groups.indexOf(group[x]));
			const clues = set.map((c) => this.clue[c]);
			const diff = splitDiffs(clues, items, index, count, side);
			if (!diff) continue;
			// Made once an edge follows: the walks that join the numbers and their neighbours within
			// a group, and per group the walks from them to every cell of it.
			const members = groups.map((g) => [...new Set(items.filter((x) => group[x] === g))]);
			let joins: (Walk | null)[] | null = null;
			let joined = 0;
			const walks = new Map<number, Walk>();
			for (let i = 0; i < count; i++) {
				for (let j = i + 1; j < count; j++) {
					const d = diff[i * count + j];
					if (d < 0) continue;
					for (const e of between.get(pair(groups[i], groups[j])) ?? []) {
						const ends = [edgeSide[2 * e], edgeSide[2 * e + 1]];
						if ((side[ends[0]] ^ side[ends[1]] ^ d ? LINE : CROSS) !== want) continue;
						if (!joins) {
							joins = members.map((m) => (m.length > 1 ? this.walk(m.slice(0, 1)) : null));
							joined = members.reduce(
								(sum, m, k) =>
									sum + m.reduce((steps, x) => steps + (joins![k]?.get(x)!.steps ?? 0), 0),
								0
							);
						}
						let cost = joined;
						for (const x of ends) {
							const g = groups.indexOf(group[x]);
							if (!walks.has(g)) walks.set(g, this.walk(members[g]));
							cost += walks.get(g)!.get(x)!.steps;
						}
						if (!best || cost < best.cost) best = { cost, set, e, joins, walks };
					}
				}
			}
		}
		if (!best) return;
		const { set, e, joins, walks } = best;
		const groups = [...new Set(set.flatMap((c) => this.around(c)).map((x) => group[x]))];
		const path = new Set<number>();
		const cells = new Set<number>(set);
		/** Back from `x` to where `walk` starts, with the cells and edges on the way. */
		const back = (walk: Walk, x: number) => {
			for (let at = x; ;) {
				if (at !== out) cells.add(at);
				const { from, edge } = walk.get(at)!;
				if (from < 0) return;
				path.add(edge);
				at = from;
			}
		};
		// The numbers and their neighbours joined within each group, then the edge's cells to them.
		for (const x of set.flatMap((c) => this.around(c))) {
			const walk = joins[groups.indexOf(group[x])];
			if (walk && walk.get(x)!.from >= 0) back(walk, x);
		}
		for (const x of [edgeSide[2 * e], edgeSide[2 * e + 1]]) {
			back(walks.get(groups.indexOf(group[x]))!, x);
		}
		const technique = two ? 'splitPair' : 'split';
		const reason = two
			? want === LINE
				? 'splitPairLine'
				: 'splitPairCross'
			: want === LINE
				? 'splitLine'
				: 'splitCross';
		yield this.step(technique, reason, [e], want, [...path], {
			cells: [...cells],
			path: [...path],
			...(!two && { clue: this.clue[set[0]] })
		});
	}

	/**
	 * Pairs of these numbers that may decide more together than each alone: their neighbours lie
	 * in two of the same groups, or in one that each of them puts on a known side of another.
	 */
	private splitPairs(numbers: number[], group: Int32Array, side: Uint8Array): number[][] {
		const known = numbers.map((c) => {
			const items = this.around(c);
			const groups = [...new Set(items.map((x) => group[x]))];
			const index = items.map((x) => groups.indexOf(group[x]));
			const diff = splitDiffs([this.clue[c]], items, index, groups.length, side);
			const linked = new Set<number>();
			for (let i = 0; diff && i < groups.length; i++) {
				for (let j = i + 1; j < groups.length; j++) {
					if (diff[i * groups.length + j] < 0) continue;
					linked.add(groups[i]);
					linked.add(groups[j]);
				}
			}
			return { c, groups, linked };
		});
		const byGroup = new Map<number, number[]>();
		known.forEach(({ groups }, k) => {
			for (const g of groups) byGroup.set(g, [...(byGroup.get(g) ?? []), k]);
		});
		const seen = new Set<number>();
		const pairs: number[][] = [];
		for (const list of byGroup.values()) {
			for (let i = 0; i < list.length; i++) {
				for (let j = i + 1; j < list.length; j++) {
					const key = list[i] * known.length + list[j];
					if (seen.has(key)) continue;
					seen.add(key);
					const [a, b] = [known[list[i]], known[list[j]]];
					const shared = a.groups.filter((g) => b.groups.includes(g));
					if (shared.length < 2 && !(a.linked.has(shared[0]) && b.linked.has(shared[0]))) continue;
					pairs.push([a.c, b.c]);
				}
			}
		}
		return pairs;
	}

	/** A number's cell and its four neighbours, above, below, left and right (`n` beyond the grid). */
	private around(c: number): number[] {
		return [c, ...this.l.cellSide.subarray(4 * c, 4 * c + 4)];
	}

	/**
	 * Breadth-first from `from` over decided edges (beyond the grid counts as one more cell): per
	 * cell reached, the cell it was reached from (-1 for a start), the edge between and the steps.
	 */
	private walk(from: number[]): Walk {
		const { cellSide } = this.l;
		const { cellEdges } = this.l.g;
		const out = this.n;
		const walk: Walk = new Map(from.map((x) => [x, { from: -1, edge: -1, steps: 0 }]));
		const queue = [...from];
		for (let head = 0; head < queue.length; head++) {
			const x = queue[head];
			const steps = walk.get(x)!.steps + 1;
			const visit = (y: number, edge: number) => {
				if (this.v[edge] === OPEN || walk.has(y)) return;
				walk.set(y, { from: x, edge, steps });
				queue.push(y);
			};
			if (x === out) for (const [y, edge] of this.borderSteps()) visit(y, edge);
			else for (let k = 0; k < 4; k++) visit(cellSide[4 * x + k], cellEdges[4 * x + k]);
		}
		return walk;
	}

	/** The cells along the border, with the edge between each and the outside. */
	private borderSteps(): [number, number][] {
		if (this.border) return this.border;
		const { cellSide } = this.l;
		const steps: [number, number][] = [];
		for (let c = 0; c < this.n; c++) {
			for (let k = 0; k < 4; k++) {
				if (cellSide[4 * c + k] === this.n) steps.push([c, this.l.g.cellEdges[4 * c + k]]);
			}
		}
		return (this.border = steps);
	}

	/**
	 * No local rule decides a line: tries a cross or a line on the open edges, those next to a
	 * line or a number first. One that leads to a contradiction is ruled out, with the place where
	 * it breaks. Lines first again (a cross that breaks), and the basic rules are tried on every
	 * edge before inside and outside.
	 */
	private assume(): Step | null {
		const { ends } = this.l.g;
		const { edgeSide } = this.l;
		const touchesLine = (e: number) =>
			[ends[2 * e], ends[2 * e + 1]].some((d) => this.count(this.dotEdges(d), LINE) > 0);
		const nearClue = (e: number) =>
			[edgeSide[2 * e], edgeSide[2 * e + 1]].some((c) => c < this.n && this.clue[c] >= 0);
		const rank = (e: number) => (touchesLine(e) ? 0 : nearClue(e) ? 1 : 2);
		const order = this.open().sort((a, b) => rank(a) - rank(b));
		for (const level of [LoopLevel.Basic, LoopLevel.Advanced]) {
			// Trying an edge picks up where the techniques stop without it, which is much faster on a
			// big grid; only the edge that breaks is rated again from the start, to say where.
			const trials = new LoopSolver(this.p);
			const quick = trials.startTrials(level, this.v);
			for (const trial of [CROSS, LINE]) {
				for (const e of order) {
					if (quick && !trials.breaks(e, trial)) continue;
					const from = this.v.slice();
					from[e] = trial;
					const { brokenAt } = rateLoop(this.p, level, from);
					if (!brokenAt) continue;
					const cells = [edgeSide[2 * e], edgeSide[2 * e + 1]].filter((c) => c < this.n);
					const dots: number[] = [];
					let breaks: Breaks = brokenAt.kind === 'cell' ? 'clue' : brokenAt.kind;
					if (brokenAt.kind === 'cell') {
						// A cell without a number breaks through a dot at one of its corners.
						if (this.clue[brokenAt.at] < 0) breaks = 'dot';
						if (!cells.includes(brokenAt.at)) cells.push(brokenAt.at);
					} else if (brokenAt.kind === 'dot') dots.push(brokenAt.at);
					const reason = trial === LINE ? 'assumeLine' : 'assumeCross';
					return this.step('assumption', reason, [e], trial === LINE ? CROSS : LINE, [], {
						cells,
						dots,
						breaks
					});
				}
			}
		}
		return null;
	}
}

/** Cells reached by `walk`: where each was reached from, over which edge, in how many steps. */
type Walk = Map<number, { from: number; edge: number; steps: number }>;

/**
 * The ways to put groups of cells inside or outside: `items` holds a number's cell and its four
 * neighbours per clue of `clues`, `index` the group of each item (of `count`) and `side` its side
 * to its group. Per pair of groups (i * count + j): the difference every way that fits all the
 * clues agrees on, or -1. Null when no way fits.
 */
function splitDiffs(
	clues: number[],
	items: number[],
	index: number[],
	count: number,
	side: Uint8Array
): Int8Array | null {
	const diff = new Int8Array(count * count).fill(-2);
	let fits = false;
	// The first group is inside: only differences matter.
	for (let a = 0; a < 1 << (count - 1); a++) {
		const bits = a << 1;
		const colour = (k: number) => ((bits >> index[k]) & 1) ^ side[items[k]];
		let ok = true;
		for (let m = 0; ok && m < clues.length; m++) {
			let other = 0;
			for (let k = 5 * m + 1; k < 5 * m + 5; k++) other += colour(k) ^ colour(5 * m);
			ok = other === clues[m];
		}
		if (!ok) continue;
		fits = true;
		for (let i = 0; i < count; i++) {
			for (let j = i + 1; j < count; j++) {
				const d = ((bits >> i) ^ (bits >> j)) & 1;
				const k = i * count + j;
				diff[k] = diff[k] === -2 || diff[k] === d ? d : -1;
			}
		}
	}
	return fits ? diff : null;
}

/** The number of bits set in `m`. */
function popCount(m: number): number {
	let k = 0;
	for (; m; m &= m - 1) k++;
	return k;
}
