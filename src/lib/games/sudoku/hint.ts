import {
	allMask,
	bit,
	candidates,
	currentGrid,
	geometry,
	isSolvedGrid,
	popcount,
	type SudokuPuzzle,
	type SudokuState
} from './rules';
import { lockedPairs, solveSudoku, subsets } from './solver';

export type Unit = 'row' | 'column' | 'box';

/**
 * Eliminations a hint can need before a single shows up, from the simplest to the hardest; the
 * same ones the generator grades hard puzzles by (see `ratePuzzle`).
 *
 * - `lockedCandidates`: a digit that a box can only hold in one row (or column) leaves the rest of
 *   that line, and the other way round.
 * - `nakedSubset`: two or three cells of a unit with only two or three digits between them; those
 *   digits leave the unit's other cells.
 * - `hiddenSubset`: two or three digits that a unit can only hold in the same two or three cells;
 *   those cells hold no other digit.
 */
export const ELIMINATIONS = ['lockedCandidates', 'nakedSubset', 'hiddenSubset'] as const;
export type Elimination = (typeof ELIMINATIONS)[number];

export type SudokuHint =
	/** Digits that differ from the solution, and notes that leave out the right digit. */
	| { kind: 'mistake'; cells: number[] }
	/**
	 * A digit that follows: the only one left for its cell (`unit` null), or the only place left
	 * for it in `unit`. `elimination` is the hardest one needed to get there, if any, and
	 * `pattern` the cells of the last one (the box-line intersection, the subset).
	 */
	| {
			kind: 'step';
			cell: number;
			digit: number;
			unit: Unit | null;
			elimination: Elimination | null;
			pattern: number[];
	  }
	/** None of the techniques finds a digit: the cell with the fewest candidates. */
	| { kind: 'stuck'; cell: number };

const solutions = new WeakMap<SudokuPuzzle, number[] | null>();

function solutionOf(p: SudokuPuzzle): number[] | null {
	if (!solutions.has(p)) {
		const res = solveSudoku(p.givens, p.width, { limit: 1, maxNodes: 2_000_000 });
		solutions.set(p, res.solutions[0] ?? null);
	}
	return solutions.get(p)!;
}

/** The next step in a classic Sudoku from the player's digits and notes. Not for Calcudoku. */
export function sudokuHint(p: SudokuPuzzle, state: SudokuState): SudokuHint | null {
	const size = p.width;
	const grid = currentGrid(p, state);
	if (isSolvedGrid(size, grid)) return null;
	const solution = solutionOf(p);
	if (solution) {
		const wrong = grid.flatMap((d, i) => {
			const note = state.notes[i];
			const bad = d ? d !== solution[i] : note !== 0 && !(note & bit(solution[i]));
			return bad ? [i] : [];
		});
		if (wrong.length) return { kind: 'mistake', cells: wrong };
	}
	// What can still go where: the digits on the board rule out their peers; notes narrow it down.
	const cand = grid.map((d, i) =>
		d ? 0 : candidates(size, grid, i) & (state.notes[i] || allMask(size))
	);
	const eliminate = [
		() => lockedCandidates(size, grid, cand),
		() => nakedSubset(size, grid, cand),
		() => hiddenSubset(size, grid, cand)
	];
	let hardest = -1;
	let pattern: number[] = [];
	for (;;) {
		const single = findSingle(size, grid, cand);
		if (single) {
			return { kind: 'step', ...single, elimination: ELIMINATIONS[hardest] ?? null, pattern };
		}
		let used = -1;
		for (let e = 0; e < eliminate.length && used < 0; e++) {
			const cells = eliminate[e]();
			if (cells) [used, pattern] = [e, cells];
		}
		if (used < 0) break;
		hardest = Math.max(hardest, used);
	}
	let cell = -1;
	for (let i = 0; i < grid.length; i++) {
		if (!grid[i] && (cell < 0 || popcount(cand[i]) < popcount(cand[cell]))) cell = i;
	}
	return { kind: 'stuck', cell };
}

const UNITS: Unit[] = ['row', 'column', 'box'];

/** The cells of the row, column or box of `cell` (rows and columns only for a grid without boxes). */
export function unitCells(size: number, cell: number, unit: Unit): number[] {
	if (unit === 'box') {
		const { units, unitsOf } = geometry(size);
		return units[unitsOf[cell][2]];
	}
	const [r, c] = [Math.floor(cell / size), cell % size];
	return Array.from({ length: size }, (_, k) => (unit === 'row' ? r * size + k : k * size + c));
}

/** A hidden single (boxes first, then rows and columns), else a naked single. */
function findSingle(size: number, grid: readonly number[], cand: readonly number[]) {
	const { units } = geometry(size);
	for (const kind of [2, 0, 1]) {
		for (let u = kind * size; u < (kind + 1) * size; u++) {
			for (let d = 1; d <= size; d++) {
				if (units[u].some((i) => grid[i] === d)) continue;
				const spots = units[u].filter((i) => cand[i] & bit(d));
				if (spots.length === 1) return { cell: spots[0], digit: d, unit: UNITS[kind] };
			}
		}
	}
	const cell = cand.findIndex((m, i) => !grid[i] && popcount(m) === 1);
	if (cell < 0) return null;
	return { cell, digit: Math.log2(cand[cell]) + 1, unit: null };
}

/** Clears `mask` from `cells`; whether anything changed. */
function remove(cand: number[], cells: Iterable<number>, mask: number): boolean {
	let changed = false;
	for (const i of cells) {
		if (cand[i] & mask) {
			cand[i] &= ~mask;
			changed = true;
		}
	}
	return changed;
}

/** Each elimination returns the cells of the pattern it used, or null if it changed nothing. */
function lockedCandidates(size: number, grid: readonly number[], cand: number[]): number[] | null {
	for (const { shared, within, clear } of lockedPairs(size)) {
		// Digits the unit can only hold inside the intersection.
		let outside = 0;
		for (const i of within) outside |= cand[i] | (grid[i] ? bit(grid[i]) : 0);
		if (remove(cand, clear, allMask(size) & ~outside)) return shared;
	}
	return null;
}

function nakedSubset(size: number, grid: readonly number[], cand: number[]): number[] | null {
	for (const unit of geometry(size).units) {
		const open = unit.filter((i) => !grid[i]);
		for (let k = 2; k <= 3 && k < open.length; k++) {
			for (const group of subsets(open, k)) {
				const mask = group.reduce((m, i) => m | cand[i], 0);
				if (popcount(mask) !== k) continue;
				if (
					remove(
						cand,
						open.filter((i) => !group.includes(i)),
						mask
					)
				)
					return group;
			}
		}
	}
	return null;
}

function hiddenSubset(size: number, grid: readonly number[], cand: number[]): number[] | null {
	for (const unit of geometry(size).units) {
		const open = unit.filter((i) => !grid[i]);
		const missing = [];
		for (let d = 1; d <= size; d++) if (open.some((i) => cand[i] & bit(d))) missing.push(d);
		for (let k = 2; k <= 3 && k < open.length; k++) {
			for (const digits of subsets(missing, k)) {
				const mask = digits.reduce((m, d) => m | bit(d), 0);
				const spots = open.filter((i) => cand[i] & mask);
				if (spots.length !== k) continue;
				if (remove(cand, spots, allMask(size) & ~mask)) return spots;
			}
		}
	}
	return null;
}
