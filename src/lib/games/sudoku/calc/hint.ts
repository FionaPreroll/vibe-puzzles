import { allMask, bit, popcount, type SudokuState } from '../rules';
import { isSolvedCalc, type CalcPuzzle } from './rules';
import { filterCage, model, solveCalc, type Model } from './solver';

export type Line = 'row' | 'column';

/**
 * Eliminations a hint can need before a single shows up, from the simplest to the hardest; the
 * techniques `rateCalc` grades puzzles by.
 *
 * - `cage`: only the digits that make a cage's target with its operation (and differ within a
 *   row or column) stay in its cells.
 * - `nakedPair`: two cells of a row or column with the same two candidates take those digits.
 */
export const ELIMINATIONS = ['cage', 'nakedPair'] as const;
export type Elimination = (typeof ELIMINATIONS)[number];

export type CalcHint =
	/** Digits that differ from the solution, and notes that leave out the right digit. */
	| { kind: 'mistake'; cells: number[] }
	/**
	 * A digit that follows: the only one left for its cell (`unit` null), or the only place left
	 * for it in `unit`. `elimination` is the hardest one needed to get there, if any, and
	 * `pattern` the cells of the last one (the cages, the pair). `cage`: the one cage that decides
	 * the digit by itself, if the last elimination was such a cage.
	 */
	| {
			kind: 'step';
			cell: number;
			digit: number;
			unit: Line | null;
			elimination: Elimination | null;
			pattern: number[];
			cage: number | null;
	  }
	/** None of the techniques finds a digit: the cell with the fewest candidates. */
	| { kind: 'stuck'; cell: number };

const solutions = new WeakMap<CalcPuzzle, number[] | null>();

function solutionOf(p: CalcPuzzle): number[] | null {
	if (!solutions.has(p)) {
		const res = solveCalc(p, { limit: 1, maxNodes: 200_000 });
		solutions.set(p, res.solutions[0] ?? null);
	}
	return solutions.get(p)!;
}

/** The next step in a Calcudoku from the player's digits (`state.values`) and notes. */
export function calcHint(p: CalcPuzzle, state: SudokuState): CalcHint | null {
	const n = p.width;
	const grid = state.values;
	if (isSolvedCalc(p, grid)) return null;
	const solution = solutionOf(p);
	if (solution) {
		const wrong = grid.flatMap((d, i) => {
			const note = state.notes[i];
			const bad = d ? d !== solution[i] : note !== 0 && !(note & bit(solution[i]));
			return bad ? [i] : [];
		});
		if (wrong.length) return { kind: 'mistake', cells: wrong };
	}
	const m = model(p);
	// What can still go where: digits rule out their row and column; notes narrow it down.
	const dom = Int32Array.from(grid, (d, i) => {
		if (d) return bit(d);
		let mask = state.notes[i] || allMask(n);
		for (const line of linesOf(m, i)) for (const j of line) if (grid[j]) mask &= ~bit(grid[j]);
		return mask;
	});
	const eliminate = [() => cages(m, grid, dom), () => nakedPair(m, grid, dom)];
	let hardest = -1;
	let pattern: number[] = [];
	let cage: number | null = null;
	for (;;) {
		const single = findSingle(m, grid, dom);
		if (single) {
			const elimination = ELIMINATIONS[hardest] ?? null;
			return { kind: 'step', ...single, elimination, pattern, cage };
		}
		let used = -1;
		for (let e = 0; e < eliminate.length && used < 0; e++) {
			const found = eliminate[e]();
			if (found) [used, pattern, cage] = [e, found.cells, found.cage ?? null];
		}
		if (used < 0) break;
		hardest = Math.max(hardest, used);
	}
	let cell = -1;
	for (let i = 0; i < grid.length; i++) {
		if (!grid[i] && (cell < 0 || popcount(dom[i]) < popcount(dom[cell]))) cell = i;
	}
	return { kind: 'stuck', cell };
}

/** The row and the column of cell `i`. */
const linesOf = (m: Model, i: number) => [m.lines[Math.floor(i / m.n)], m.lines[m.n + (i % m.n)]];

/** A hidden single in a row or column, else a naked single. */
function findSingle(m: Model, grid: readonly number[], dom: Int32Array) {
	for (let l = 0; l < m.lines.length; l++) {
		const line = m.lines[l];
		for (let d = 1; d <= m.n; d++) {
			if (line.some((i) => grid[i] === d)) continue;
			const spots = line.filter((i) => !grid[i] && dom[i] & bit(d));
			if (spots.length === 1) {
				return { cell: spots[0], digit: d, unit: (l < m.n ? 'row' : 'column') as Line };
			}
		}
	}
	const cell = grid.findIndex((d, i) => !d && popcount(dom[i]) === 1);
	if (cell < 0) return null;
	return { cell, digit: Math.log2(dom[cell]) + 1, unit: null };
}

/** What an elimination used: the cells of its pattern, and the cage if it was one alone. */
type Found = { cells: number[]; cage?: number } | null;

/**
 * Only the digits that make each cage's target stay. A cage that leads to a single by itself
 * comes first, to be named; else one cage after the other until a single shows up.
 */
function cages(m: Model, grid: readonly number[], dom: Int32Array): Found {
	for (let k = 0; k < m.cages.length; k++) {
		const trial = dom.slice();
		if (filterCage(m, k, trial) !== 'changed' || !findSingle(m, grid, trial)) continue;
		dom.set(trial);
		return { cells: m.cages[k].cells, cage: k };
	}
	const cells = [];
	for (let k = 0; k < m.cages.length; k++) {
		if (filterCage(m, k, dom) !== 'changed') continue;
		cells.push(...m.cages[k].cells);
		if (findSingle(m, grid, dom)) break;
	}
	return cells.length ? { cells } : null;
}

function nakedPair(m: Model, grid: readonly number[], dom: Int32Array): Found {
	for (const line of m.lines) {
		const open = line.filter((i) => !grid[i]);
		for (const a of open) {
			if (popcount(dom[a]) !== 2) continue;
			const b = open.find((j) => j !== a && dom[j] === dom[a]);
			if (b === undefined) continue;
			let changed = false;
			for (const j of open) {
				if (j !== a && j !== b && dom[j] & dom[a]) {
					dom[j] &= ~dom[a];
					changed = true;
				}
			}
			if (changed) return { cells: [a, b] };
		}
	}
	return null;
}
