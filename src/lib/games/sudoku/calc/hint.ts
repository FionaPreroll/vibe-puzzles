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
	 * for it in `unit`. `elimination` is the hardest one needed to get there, if any.
	 */
	| {
			kind: 'step';
			cell: number;
			digit: number;
			unit: Line | null;
			elimination: Elimination | null;
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
	const eliminate = [() => cages(m, dom), () => nakedPair(m, grid, dom)];
	let hardest = -1;
	for (;;) {
		const single = findSingle(m, grid, dom);
		if (single) return { kind: 'step', ...single, elimination: ELIMINATIONS[hardest] ?? null };
		const used = eliminate.findIndex((step) => step());
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

function cages(m: Model, dom: Int32Array): boolean {
	let changed = false;
	for (let k = 0; k < m.cages.length; k++) if (filterCage(m, k, dom) === 'changed') changed = true;
	return changed;
}

function nakedPair(m: Model, grid: readonly number[], dom: Int32Array): boolean {
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
			if (changed) return true;
		}
	}
	return false;
}
