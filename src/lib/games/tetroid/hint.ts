import {
	CROSS,
	EMPTY,
	isSolvedMarks,
	SHADED,
	type TetroidPuzzle,
	type TetroidState
} from './rules';
import { TetroidModel, TetroidSolver } from './solver';

/**
 * Deductions a hint can name, from the simplest to the hardest. Each rules out placements of a
 * tetromino; a cell is decided once all placements left in its region cover it (shaded) or none
 * does (empty).
 *
 * - `region`: only the player's marks, within the region.
 * - `sameShape`: every placement left in a neighbouring region would touch an identical tetromino.
 * - `square`: the placement would complete a shaded 2×2 block, alone with decided cells or with
 *   whatever is left in a neighbouring region.
 * - `neighbour`: everything left in a neighbouring region would break one of those two rules.
 * - `lookAhead`: with the placement, the decided cells could no longer all connect (this includes
 *   a placement cut off from them).
 * - `assumption`: none of those applies, but trying the placement leads to a contradiction.
 */
export const TECHNIQUES = [
	'region',
	'sameShape',
	'square',
	'neighbour',
	'lookAhead',
	'assumption'
] as const;
export type Technique = (typeof TECHNIQUES)[number];

export type TetroidHint =
	/** Marks that disagree with the solution. */
	| { kind: 'mistake'; cells: number[] }
	/**
	 * Cells of one region that follow from the marks, and the hardest deduction needed there.
	 * `context`: cells of the neighbouring regions whose options ruled out placements here.
	 * `assumed`: for an assumption, the placement that leads to a contradiction.
	 */
	| {
			kind: 'step';
			technique: Technique;
			mark: 'shade' | 'cross';
			region: number;
			cells: number[];
			context: number[];
			assumed?: number[];
	  }
	/** No deduction applies: case analysis is needed. `cells` is the region with fewest options. */
	| { kind: 'stuck'; region: number; cells: number[] };

type Step = Extract<TetroidHint, { kind: 'step' }>;

const models = new WeakMap<TetroidPuzzle, TetroidModel>();
const solutions = new WeakMap<TetroidPuzzle, Uint8Array | null>();

function modelOf(p: TetroidPuzzle): TetroidModel {
	let m = models.get(p);
	if (!m) models.set(p, (m = new TetroidModel(p)));
	return m;
}

function solutionOf(p: TetroidPuzzle): Uint8Array | null {
	if (!solutions.has(p)) {
		const res = new TetroidSolver(modelOf(p)).solve({ limit: 1, maxNodes: 2_000_000 });
		solutions.set(p, res.solutions[0] ?? null);
	}
	return solutions.get(p)!;
}

/** The next step from the player's marks: a mistake, the cells that follow, or none (stuck). */
export function tetroidHint(p: TetroidPuzzle, state: TetroidState): TetroidHint | null {
	const { marks } = state;
	if (isSolvedMarks(p, (i) => marks[i] === SHADED)) return null;
	const solution = solutionOf(p);
	if (solution) {
		const wrong = marks.flatMap((mk, i) =>
			(mk === SHADED && !solution[i]) || (mk === CROSS && solution[i]) ? [i] : []
		);
		if (wrong.length) return { kind: 'mistake', cells: wrong };
	}
	return new Deduction(modelOf(p), marks).next();
}

/** A placement ruled out by a rule within its region, not by a particular neighbour. */
const OWN = -1;

/** Trials of placements per hint at a dead end, to keep the hint quick on big boards. */
const MAX_TRIALS = 400;

class Deduction {
	private readonly alive: Uint8Array;
	/** Neighbouring regions whose options ruled out placements, per region. */
	private readonly cause: Set<number>[];
	private readonly size: Int32Array;
	/** Hardest technique that ruled out a placement, per region. */
	private readonly level: Int32Array;
	/** Alive placements of the cell's region that cover it. */
	private readonly cover: Int32Array;

	constructor(
		private readonly m: TetroidModel,
		private readonly marks: readonly number[]
	) {
		const { placements, byRegion } = m;
		this.alive = new Uint8Array(placements.length).fill(1);
		this.size = Int32Array.from(byRegion.map((l) => l.length));
		this.level = new Int32Array(byRegion.length);
		this.cover = new Int32Array(m.n);
		this.cause = byRegion.map(() => new Set<number>());
		const regions = m.p.regions;
		const shaded = byRegion.map(() => [] as number[]);
		marks.forEach((mk, i) => mk === SHADED && shaded[regions[i]].push(i));
		placements.forEach((pl, k) => {
			const fits =
				pl.cells.every((i) => marks[i] !== CROSS) &&
				shaded[pl.region].every((i) => pl.cells.includes(i));
			if (!fits) this.kill(k, 0);
		});
	}

	/**
	 * Cells to shade first: they are what solves the puzzle, while crosses only help and are not
	 * needed for the next deduction (it starts over from the marks anyway). So deduce on past
	 * cells that only stay empty, and name them only when no cell to shade follows, not even
	 * from an assumption.
	 */
	next(): TetroidHint {
		let cross: Step | null = null;
		for (;;) {
			const step = this.decided();
			if (step?.mark === 'shade') return step;
			cross ??= step;
			if (!this.sweep()) break;
		}
		// A dead end: an assumption that leads to cells to shade, else cells that stay empty.
		const tried = this.assume();
		if (tried?.mark === 'shade') return tried;
		return cross ?? tried ?? this.stuck();
	}

	private kill(k: number, technique: number, by = OWN) {
		const r = this.m.placements[k].region;
		this.alive[k] = 0;
		this.size[r]--;
		this.level[r] = Math.max(this.level[r], technique);
		if (by !== OWN) this.cause[r].add(by);
	}

	/**
	 * Rule out placements with the simplest technique that rules out any. Each test returns null
	 * when the placement stays, else the neighbouring region that rules it out (or `OWN`).
	 */
	private sweep(): boolean {
		this.count();
		const tests = [
			(k: number) => this.touchesSameShape(k),
			(k: number) => this.makesSquare(k),
			(k: number) => this.clashes(k),
			(k: number) => (this.disconnects(k) ? OWN : null)
		];
		for (let t = 0; t < tests.length; t++) {
			const dead = this.m.placements.flatMap((pl, k) => {
				if (!this.alive[k] || this.size[pl.region] <= 1) return [];
				const by = tests[t](k);
				return by === null ? [] : [[k, by]];
			});
			for (const [k, by] of dead) this.kill(k, t + 1, by);
			if (dead.length) return true;
		}
		return false;
	}

	private count() {
		this.cover.fill(0);
		this.m.placements.forEach((pl, k) => {
			if (this.alive[k]) for (const i of pl.cells) this.cover[i]++;
		});
	}

	/** Shaded in every solution left: all placements of its region cover it. */
	private must(i: number): boolean {
		return this.cover[i] > 0 && this.cover[i] === this.size[this.m.p.regions[i]];
	}

	/**
	 * The undecided cells that are now decided, in the region with the simplest reason; cells to
	 * shade before cells that stay empty. Leaves out the rest of a region that the player's own
	 * shaded cells already settle: such crosses tell nothing new.
	 */
	private decided(): Step | null {
		this.count();
		const { regions } = this.m.p;
		const rank = (s: Step) =>
			TECHNIQUES.indexOf(s.technique) + (s.mark === 'cross' ? TECHNIQUES.length : 0);
		let best: Step | null = null;
		for (let r = 0; r < this.size.length; r++) {
			if (best && rank(best) <= this.level[r]) continue;
			const open = regions.flatMap((reg, i) => (reg === r && this.marks[i] === EMPTY ? [i] : []));
			const shade = open.filter((i) => this.must(i));
			const tidyUp =
				this.level[r] === 0 && regions.some((reg, i) => reg === r && this.marks[i] === SHADED);
			const cross = tidyUp ? [] : open.filter((i) => this.cover[i] === 0);
			if (!shade.length && !cross.length) continue;
			const step: Step = {
				kind: 'step',
				technique: TECHNIQUES[this.level[r]],
				mark: shade.length ? 'shade' : 'cross',
				region: r,
				cells: shade.length ? shade : cross,
				context: regions.flatMap((reg, i) => (this.cause[r].has(reg) ? [i] : []))
			};
			if (!best || rank(step) < rank(best)) best = step;
		}
		return best;
	}

	/**
	 * No rule decides a cell: try the placements of the regions with the fewest options. A
	 * placement that leads to a contradiction is ruled out; named is the first one that then
	 * decides cells to shade in its region, else the first that decides any cell.
	 */
	private assume(): Step | null {
		const { byRegion, placements, p } = this.m;
		const trials = byRegion
			.map((_, r) => r)
			.filter((r) => this.size[r] > 1)
			.sort((a, b) => this.size[a] - this.size[b])
			.flatMap((r) => byRegion[r].filter((k) => this.alive[k]).map((k) => [r, k]))
			.slice(0, MAX_TRIALS);
		const solver = new TetroidSolver(this.m);
		let cross: Step | null = null;
		for (const [r, k] of trials) {
			const open = p.regions.flatMap((reg, i) => (reg === r && this.marks[i] === EMPTY ? [i] : []));
			const rest = byRegion[r].filter((q) => q !== k && this.alive[q]);
			const covered = (i: number) => rest.filter((q) => placements[q].cells.includes(i)).length;
			const shade = open.filter((i) => covered(i) === rest.length);
			const empty = open.filter((i) => covered(i) === 0);
			if (!shade.length && (!empty.length || cross)) continue;
			const dom = { alive: this.alive.slice(), size: this.size.slice() };
			for (const q of rest) dom.alive[q] = 0;
			dom.size[r] = 1;
			if (solver.consistent(dom)) continue;
			const step: Step = {
				kind: 'step',
				technique: 'assumption',
				mark: shade.length ? 'shade' : 'cross',
				region: r,
				cells: shade.length ? shade : empty,
				context: [],
				assumed: placements[k].cells
			};
			if (shade.length) return step;
			cross = step;
		}
		return cross;
	}

	/** Not even an assumption helps: the region with the fewest options, to start case analysis. */
	private stuck(): TetroidHint {
		let region = -1;
		for (let r = 0; r < this.size.length; r++) {
			if (this.size[r] > 1 && (region < 0 || this.size[r] < this.size[region])) region = r;
		}
		const cells = this.m.p.regions.flatMap((reg, i) => (reg === region ? [i] : []));
		return { kind: 'stuck', region, cells };
	}

	/** The regions next to placement `k`, each with its alive placements. */
	private neighbourOptions(k: number): [number, number[]][] {
		const { placements, byRegion, regionNeighbours } = this.m;
		return regionNeighbours[placements[k].region].map((r) => [
			r,
			byRegion[r].filter((q) => this.alive[q])
		]);
	}

	/** The first neighbouring region whose every option `rules` out placement `k`, or null. */
	private blockingNeighbour(k: number, rules: (q: number) => boolean): number | null {
		for (const [r, options] of this.neighbourOptions(k)) if (options.every(rules)) return r;
		return null;
	}

	private touches(a: number[], b: number[]): boolean {
		return a.some((i) => this.m.nb[i].some((j) => b.includes(j)));
	}

	private sameShape(k: number, q: number): boolean {
		const [a, b] = [this.m.placements[k], this.m.placements[q]];
		return a.type === b.type && this.touches(a.cells, b.cells);
	}

	private touchesSameShape(k: number): number | null {
		return this.blockingNeighbour(k, (q) => this.sameShape(k, q));
	}

	/** Whether shading `cells` (and the decided cells) completes a 2×2 block. */
	private square(cells: number[]): boolean {
		const w = this.m.p.width;
		const on = (i: number) => cells.includes(i) || this.must(i);
		return cells.some((i) =>
			[...this.m.squares[i]].some((t) => on(t) && on(t + 1) && on(t + w) && on(t + w + 1))
		);
	}

	private makesSquare(k: number): number | null {
		const own = this.m.placements[k].cells;
		if (this.square(own)) return OWN;
		return this.blockingNeighbour(k, (q) => this.square([...own, ...this.m.placements[q].cells]));
	}

	private clashes(k: number): number | null {
		const own = this.m.placements[k].cells;
		return this.blockingNeighbour(
			k,
			(q) => this.sameShape(k, q) || this.square([...own, ...this.m.placements[q].cells])
		);
	}

	/**
	 * Components of the cells that can still be shaded, where the cells of `region` count only if
	 * in `own`. Returns whether all decided cells (and `own`) lie in one of them.
	 */
	private connected(region: number, own: number[]): boolean {
		const { nb, n } = this.m;
		const regions = this.m.p.regions;
		const possible = (i: number) => (regions[i] === region ? own.includes(i) : this.cover[i] > 0);
		const needed = (i: number) => (regions[i] === region ? own.includes(i) : this.must(i));
		const start = own[0];
		const seen = new Uint8Array(n);
		seen[start] = 1;
		const stack = [start];
		while (stack.length) {
			for (const j of nb[stack.pop()!]) {
				if (!seen[j] && possible(j)) {
					seen[j] = 1;
					stack.push(j);
				}
			}
		}
		for (let i = 0; i < n; i++) if (needed(i) && !seen[i]) return false;
		return true;
	}

	/** With the placement, the decided cells could no longer all connect. */
	private disconnects(k: number): boolean {
		const pl = this.m.placements[k];
		return !this.connected(pl.region, pl.cells);
	}
}
