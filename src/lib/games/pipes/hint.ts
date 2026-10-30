import { JOIN, markKey, markList, turn, type PipesPuzzle, type PipesState } from './rules';
import { count, PipesLevel, PipesSolver } from './solver';

/**
 * What decides the tile a hint points at, given the locked tiles: the edge of the board alone
 * (`edge`), the locked tiles next to it (`fit`), a loop it would close (`loop`), a group it would
 * cut off (`closed`), or these rules over a few tiles in turn (`chain`).
 */
export type PipesTechnique = 'edge' | 'fit' | 'loop' | 'closed' | 'chain';

export type PipesHint =
	/** Locked tiles that lie wrong, and marks that the solution breaks (by `markKey`). */
	| { kind: 'mistake'; cells: number[]; marks: string[] }
	| {
			kind: 'step';
			/** The tile that can only lie one way, and that way. */
			cell: number;
			mask: number;
			/** Quarter turns clockwise from how the tile lies now to that way, 0 to 3. */
			turns: number;
			technique: PipesTechnique;
			/** Tiles the reasoning rests on: the tile, locked neighbours, groups, tiles on the way. */
			area: number[];
	  }
	| { kind: 'stuck'; cell: number };

const solvers = new WeakMap<PipesPuzzle, { solver: PipesSolver; solution: number[] | null }>();

/** The puzzle's solver and its solution, kept per puzzle. */
function solverOf(p: PipesPuzzle) {
	let entry = solvers.get(p);
	if (!entry) {
		const solver = new PipesSolver(p);
		const alone = solver.solvesAlone();
		const solution = alone ? Array.from(alone, maskOf) : (solver.solve(1).solutions[0] ?? null);
		solvers.set(p, (entry = { solver, solution }));
	}
	return entry;
}

/** The solution of a puzzle, or null if it has none (or the search gave up). */
export const pipesSolution = (p: PipesPuzzle) => solverOf(p).solution;

/** The single mask of a decided set. */
const maskOf = (set: number) => 31 - Math.clz32(set);

/**
 * The next step from the player's position. Locked tiles are what the player knows: a locked
 * tile that lies wrong comes first, and so does a mark on a side that the solution breaks (a pipe
 * across an "x", none across an "="). Otherwise the hint finds an unlocked tile that can only lie
 * one way given the locked ones, by the simplest reasoning that decides one, and among those
 * prefers a tile that lies wrong now. Null when every tile is locked.
 */
export function pipesHint(p: PipesPuzzle, s: PipesState): PipesHint | null {
	const { solver, solution } = solverOf(p);
	if (solution) {
		const cells = s.locks.flatMap((locked, c) => (locked && s.tiles[c] !== solution[c] ? [c] : []));
		const marks = markList(s.marks).flatMap(([c, k, mark]) =>
			!!(solution[c] & (1 << k)) !== (mark === JOIN) ? [markKey(p, c, k)] : []
		);
		if (cells.length || marks.length) return { kind: 'mistake', cells, marks };
	}
	const unlocked = s.locks.flatMap((locked, c) => (locked ? [] : [c]));
	if (!unlocked.length) return null;

	const plain = solver.start();
	const start = plain.slice();
	s.locks.forEach((locked, c) => {
		if (locked) start[c] = 1 << s.tiles[c];
	});

	/** The decided tiles of `opts` that `before` had not decided, best first. */
	const decidedNow = (opts: Uint16Array, before: Uint16Array) =>
		unlocked
			.filter((c) => count(opts[c]) === 1 && count(before[c]) > 1)
			// A tile that lies wrong first: its step changes the board.
			.sort(
				(a, b) => Number(s.tiles[a] === maskOf(opts[a])) - Number(s.tiles[b] === maskOf(opts[b]))
			);

	const step = (c: number, set: number, technique: PipesTechnique, area: number[]): PipesHint => {
		const mask = maskOf(set);
		const turns = [0, 1, 2, 3].findIndex((q) => turn(s.tiles[c], q) === mask);
		return { kind: 'step', cell: c, mask, turns, technique, area: [...new Set([c, ...area])] };
	};
	const lockedAround = (c: number) => around(solver, c).filter((m) => s.locks[m]);

	// One tile and what is next to it: the edge of the board, then the locked tiles too.
	const edge = start.slice();
	const fit = start.slice();
	for (const c of unlocked) {
		edge[c] = solver.fitting(plain, c);
		fit[c] = solver.fitting(start, c);
	}
	const [byEdge] = decidedNow(edge, start);
	if (byEdge !== undefined) return step(byEdge, edge[byEdge], 'edge', []);
	const [byFit] = decidedNow(fit, start);
	if (byFit !== undefined) return step(byFit, fit[byFit], 'fit', lockedAround(byFit));

	// Then loops and groups cut off by the pipes the locked tiles hold, round after round over
	// the tiles narrowed on the way (a chain).
	let opts = start;
	const narrowed = new Set<number>();
	for (let round = 0; round <= 4 * p.width * p.height; round++) {
		if (!solver.joinGroups(opts)) break;
		const why = new Map<number, 'loop' | 'closed'>();
		// Every unlocked tile still has several ways here (the first one decided ends the search),
		// so each is fitted again to what the last round narrowed.
		const next = opts.slice();
		for (const c of unlocked) next[c] = solver.fitting(opts, c);
		for (const c of unlocked) {
			if (count(next[c]) < 2) continue;
			for (let set = next[c]; set; set &= set - 1) {
				const mask = maskOf(set & -set);
				const broken = solver.breaks(opts, c, mask, PipesLevel.Closed);
				if (!broken) continue;
				next[c] &= ~(1 << mask);
				if (why.get(c) !== 'closed') why.set(c, broken);
			}
		}
		if (unlocked.some((c) => !next[c])) break;
		const found = decidedNow(next, opts);
		if (found.length) {
			if (round === 0) {
				// A tile `Fit` decides alone returned above, so a loop or a group cut off decided
				// these. The simpler rule first: a loop.
				const c = found.find((x) => why.get(x) === 'loop') ?? found[0];
				return step(c, next[c], why.get(c)!, [
					...lockedAround(c),
					...groupsAround(solver, opts, c)
				]);
			}
			const c = found[0];
			const near = around(solver, c).filter((m) => narrowed.has(m) || s.locks[m]);
			const groups = why.has(c) ? groupsAround(solver, opts, c) : [];
			return step(c, next[c], 'chain', [...near, ...groups]);
		}
		let changed = false;
		for (const c of unlocked) {
			if (next[c] === opts[c]) continue;
			narrowed.add(c);
			changed = true;
		}
		if (!changed) break;
		opts = next;
	}

	// Nothing decides a tile: the puzzle has no solution with these locks, or the search gave up.
	// Point at a tile that lies wrong and has the most ways left.
	const wrong = unlocked.filter((c) => !solution || s.tiles[c] !== solution[c]);
	const pool = wrong.length ? wrong : unlocked;
	// The sort keeps the order of tiles with as many ways: the first of them wins.
	const [most] = pool.sort((a, b) => count(start[b]) - count(start[a]));
	return { kind: 'stuck', cell: most };
}

/** The neighbours of a tile on the board. */
function around(solver: PipesSolver, c: number): number[] {
	const out: number[] = [];
	for (let k = 0; k < 4; k++) {
		const m = solver.nb[c * 4 + k];
		if (m >= 0 && m !== c && !out.includes(m)) out.push(m);
	}
	return out;
}

/**
 * The tiles of the groups that known pipes join (after `joinGroups`) next to a tile, its own
 * included, leaving out tiles that are groups of their own.
 */
function groupsAround(solver: PipesSolver, opts: Uint16Array, c: number): number[] {
	const roots = new Set(around(solver, c).map((m) => solver.groupOf(m)));
	roots.add(solver.groupOf(c));
	const out: number[] = [];
	for (let m = 0; m < opts.length; m++) {
		const root = solver.groupOf(m);
		if (roots.has(root) && solver.groupInfo(root).size > 1) out.push(m);
	}
	return out;
}
