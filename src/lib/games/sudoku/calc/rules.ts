/**
 * Calcudoku: an N×N grid without boxes. Every row and column holds the digits 1..N once, and the
 * cells of each cage combine to the cage's target with its operation. Subtraction and division
 * cages have two cells and take the larger digit first; a single cell cage just shows its digit.
 */
export type Op = '+' | '-' | '*' | '/' | '=';

export interface Cage {
	/** Cell indices, row by row. */
	cells: number[];
	op: Op;
	target: number;
}

export interface CalcPuzzle {
	width: number;
	height: number;
	cages: Cage[];
}

export const CALC_SIZES = [4, 5, 6, 7, 8, 9];

/** Result of a cage's operation on its digits, or NaN when the operation does not apply. */
export function evaluate(op: Op, digits: readonly number[]): number {
	switch (op) {
		case '=':
			return digits.length === 1 ? digits[0] : NaN;
		case '+':
			return digits.reduce((a, b) => a + b, 0);
		case '*':
			return digits.reduce((a, b) => a * b, 1);
		case '-':
			return digits.length === 2 ? Math.abs(digits[0] - digits[1]) : NaN;
		case '/': {
			if (digits.length !== 2) return NaN;
			const [hi, lo] = digits[0] > digits[1] ? digits : [digits[1], digits[0]];
			return hi % lo === 0 ? hi / lo : NaN;
		}
	}
}

export const cageHolds = (cage: Cage, grid: readonly number[]) =>
	evaluate(
		cage.op,
		cage.cells.map((i) => grid[i])
	) === cage.target;

/** Label as shown in the cage's corner: target first, then the operation ("12+", "3−"). */
export function cageLabel(cage: Cage): string {
	const sign = { '+': '+', '-': '−', '*': '×', '/': '÷', '=': '' }[cage.op];
	return `${cage.target}${sign}`;
}

/** Cage index per cell. */
export function cageIndex(p: CalcPuzzle): number[] {
	const out = new Array(p.width * p.height).fill(-1);
	p.cages.forEach((c, k) => c.cells.forEach((i) => (out[i] = k)));
	return out;
}

/** The top-left cell of a cage, where its label goes. */
export const labelCell = (cage: Cage) => Math.min(...cage.cells);

/** Cells whose digit repeats in their row or column (no boxes in Calcudoku). */
export function latinConflicts(size: number, grid: readonly number[]): boolean[] {
	return grid.map((d, i) => {
		if (!d) return false;
		const r = Math.floor(i / size);
		const c = i % size;
		for (let k = 0; k < size; k++) {
			if (k !== c && grid[r * size + k] === d) return true;
			if (k !== r && grid[k * size + c] === d) return true;
		}
		return false;
	});
}

/** Cages whose cells are all filled but miss their target. */
export function brokenCages(p: CalcPuzzle, grid: readonly number[]): boolean[] {
	return p.cages.map((c) => c.cells.every((i) => grid[i]) && !cageHolds(c, grid));
}

export function isSolvedCalc(p: CalcPuzzle, grid: readonly number[]): boolean {
	const n = p.width;
	return (
		grid.length === n * n &&
		grid.every((d) => Number.isInteger(d) && d >= 1 && d <= n) &&
		!latinConflicts(n, grid).some(Boolean) &&
		p.cages.every((c) => cageHolds(c, grid))
	);
}

/** Whether the cells form one orthogonally connected group. */
function connected(cells: readonly number[], size: number): boolean {
	const set = new Set(cells);
	const seen = new Set([cells[0]]);
	const stack = [cells[0]];
	while (stack.length) {
		const i = stack.pop()!;
		const r = Math.floor(i / size);
		const c = i % size;
		const next = [
			r > 0 && i - size,
			r < size - 1 && i + size,
			c > 0 && i - 1,
			c < size - 1 && i + 1
		];
		for (const j of next) {
			if (j !== false && set.has(j) && !seen.has(j)) {
				seen.add(j);
				stack.push(j);
			}
		}
	}
	return seen.size === cells.length;
}

/** Shape check for a puzzle from elsewhere: cages cover every cell once, connected, sane. */
export function isValidCalcPuzzle(p: unknown, size: number): p is CalcPuzzle {
	if (!p || typeof p !== 'object') return false;
	const q = p as CalcPuzzle;
	if (!CALC_SIZES.includes(size) || q.width !== size || q.height !== size) return false;
	if (!Array.isArray(q.cages) || q.cages.length === 0) return false;
	const seen = new Set<number>();
	for (const c of q.cages) {
		if (!c || !Array.isArray(c.cells) || c.cells.length === 0) return false;
		if (!['+', '-', '*', '/', '='].includes(c.op)) return false;
		if (!Number.isInteger(c.target) || c.target < 1) return false;
		const len = c.cells.length;
		if ((c.op === '=' && len !== 1) || ((c.op === '-' || c.op === '/') && len !== 2)) return false;
		for (const i of c.cells) {
			if (!Number.isInteger(i) || i < 0 || i >= size * size || seen.has(i)) return false;
			seen.add(i);
		}
		if (!connected(c.cells, size)) return false;
	}
	return seen.size === size * size;
}
