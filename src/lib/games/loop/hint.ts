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
import { LoopLevel, loopLayout, rateLoop, solveLoop, type LoopLayout } from './solver';

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

/** The steps of one technique with a given mark (LINE or CROSS), found one after the other. */
type Finder = (want: number) => Iterable<Step>;

class Deduction {
	private readonly l: LoopLayout;
	private readonly n: number;
	private readonly clue: number[];
	/** The deductions, simplest first. */
	private readonly finders: Finder[];
	/** The edges each step looked at, to find the crosses it rests on. */
	private readonly inputs = new Map<Step, number[]>();
	/** Crosses that followed on the way to a line, per edge, in the order they followed. */
	private readonly made = new Map<number, Step>();

	/** `v`: the player's marks, a copy that takes the crosses that follow. */
	constructor(
		private readonly p: LoopPuzzle,
		private readonly v: Uint8Array
	) {
		this.l = loopLayout(p.width, p.height);
		this.n = p.width * p.height;
		this.clue = Array.from({ length: this.n }, (_, c) => clueAt(p, c));
		this.finders = [
			(want) => this.clueSteps(want),
			(want) => this.dotSteps(want),
			(want) => (want === CROSS ? this.loopSteps() : []),
			(want) => this.cornerSteps(want),
			(want) => this.pairSteps(want),
			(want) => this.sidesSteps(want),
			(want) => this.blockSteps(want)
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
			for (const e of cross.edges) {
				this.v[e] = CROSS;
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
		const visit = (edges: number[]) => {
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

	private cellEdges(c: number): number[] {
		return [...this.l.g.cellEdges.subarray(4 * c, 4 * c + 4)];
	}

	private dotEdges(d: number): number[] {
		return [...this.l.dotEdge.subarray(4 * d, 4 * d + 4)].filter((e) => e >= 0);
	}

	private cornerDots(c: number): number[] {
		return [...this.l.cornerDot.subarray(4 * c, 4 * c + 4)];
	}

	private count(edges: number[], value: number): number {
		return edges.filter((e) => this.v[e] === value).length;
	}

	/** A step that decides `edges`, having looked at the edges `inputs`. */
	private step(
		technique: Technique,
		reason: Reason,
		edges: number[],
		value: number,
		inputs: number[],
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
	 * Tries every way to draw the open edges of these cells. A way fits when each number keeps
	 * its count and each dot can still end with two lines or none: no dot gets three lines, and
	 * one with a single line has a free edge left outside these cells. Returns the edges that
	 * every way that fits agrees on with mark `want`, and the edges it looked at.
	 */
	private window(cells: number[], want: number): { edges: number[]; inputs: number[] } | null {
		const around = [...new Set(cells.flatMap((c) => this.cellEdges(c)))];
		const w = around.filter((e) => this.v[e] === OPEN);
		if (!w.length) return null;
		const { ends } = this.l.g;
		const dots = [...new Set(w.flatMap((e) => [ends[2 * e], ends[2 * e + 1]]))];
		const bit = new Map(w.map((e, k) => [e, k]));
		const value = (e: number, a: number) => {
			const k = bit.get(e);
			return k === undefined ? this.v[e] : (a >> k) & 1 ? LINE : CROSS;
		};
		let all = (1 << w.length) - 1;
		let any = 0;
		let found = false;
		for (let a = 0; a < 1 << w.length; a++) {
			const fits =
				cells.every((c) => {
					if (this.clue[c] < 0) return true;
					return this.cellEdges(c).filter((e) => value(e, a) === LINE).length === this.clue[c];
				}) &&
				dots.every((d) => {
					let lines = 0;
					let free = 0;
					for (const e of this.dotEdges(d)) {
						const x = value(e, a);
						if (x === LINE) lines++;
						else if (x === OPEN) free++;
					}
					return lines <= 2 && (lines !== 1 || free > 0);
				});
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
			const found = this.window(cells, want);
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
		for (const e of this.open()) {
			const [a, b] = [edgeSide[2 * e], edgeSide[2 * e + 1]];
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

	/** The cells along the border, with the edge between each and the outside. */
	private borderSteps(): [number, number][] {
		const { cellSide } = this.l;
		const steps: [number, number][] = [];
		for (let c = 0; c < this.n; c++) {
			for (let k = 0; k < 4; k++) {
				if (cellSide[4 * c + k] === this.n) steps.push([c, this.l.g.cellEdges[4 * c + k]]);
			}
		}
		return steps;
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
			for (const trial of [CROSS, LINE]) {
				for (const e of order) {
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
