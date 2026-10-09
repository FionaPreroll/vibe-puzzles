import { Rng } from '../../../core/rng';
import type { Difficulty } from '../../../core/variants';
import { evaluate, type CalcPuzzle, type Cage, type Op } from './rules';
import { CalcLevel, randomLatinSquare, rateCalc, solveCalc } from './solver';

export interface GeneratedCalc {
	puzzle: CalcPuzzle;
	solution: number[];
}

interface Profile {
	/** Weights of cage sizes 1, 2, 3, 4, … */
	sizes: number[];
	/** Hardest technique the puzzle may need. */
	maxLevel: CalcLevel;
	/** Whether it has to need more than the basic technique. */
	needsAdvanced: boolean;
	/** Two-cell cages prefer − and ÷ (easier to read off) with this probability. */
	diffDivShare: number;
}

const PROFILES: Record<Difficulty, Profile> = {
	easy: { sizes: [1, 6, 3], maxLevel: CalcLevel.Basic, needsAdvanced: false, diffDivShare: 0.7 },
	normal: {
		sizes: [0.3, 5, 4, 1],
		maxLevel: CalcLevel.Advanced,
		needsAdvanced: false,
		diffDivShare: 0.5
	},
	hard: {
		sizes: [0, 4, 4, 2],
		maxLevel: CalcLevel.Advanced,
		needsAdvanced: true,
		diffDivShare: 0.3
	}
};

/** Attempts (each a new cage layout) before settling for the best puzzle found. */
const ATTEMPTS = 40;

function weighted(rng: Rng, weights: number[]): number {
	const total = weights.reduce((a, b) => a + b, 0);
	let x = rng.next() * total;
	for (let k = 0; k < weights.length; k++) {
		x -= weights[k];
		if (x < 0) return k;
	}
	return weights.length - 1;
}

function neighbours(i: number, n: number): number[] {
	const r = Math.floor(i / n);
	const c = i % n;
	const out: number[] = [];
	if (r > 0) out.push(i - n);
	if (r < n - 1) out.push(i + n);
	if (c > 0) out.push(i - 1);
	if (c < n - 1) out.push(i + 1);
	return out;
}

/** Split the grid into connected groups of random sizes. */
function partition(n: number, profile: Profile, rng: Rng): number[][] {
	const owner = new Array(n * n).fill(-1);
	const groups: number[][] = [];
	for (const start of rng.shuffle([...Array(n * n).keys()])) {
		if (owner[start] >= 0) continue;
		const want = weighted(rng, profile.sizes) + 1;
		const group = [start];
		owner[start] = groups.length;
		while (group.length < want) {
			const frontier = group.flatMap((i) => neighbours(i, n)).filter((j) => owner[j] < 0);
			if (!frontier.length) break;
			const j = rng.pick(frontier);
			owner[j] = groups.length;
			group.push(j);
		}
		groups.push(group.sort((a, b) => a - b));
	}
	// A lone leftover cell joins a neighbouring group when singles are unwanted.
	if (profile.sizes[0] === 0) {
		for (const g of groups) {
			if (g.length !== 1) continue;
			const nb = neighbours(g[0], n).map((j) => groups[owner[j]]);
			const target = nb.filter((h) => h !== g && h.length > 0 && h.length < 4)[0];
			if (!target) continue;
			target.push(g[0]);
			target.sort((a, b) => a - b);
			owner[g[0]] = groups.indexOf(target);
			g.length = 0;
		}
	}
	return groups.filter((g) => g.length > 0);
}

/** Pick an operation that fits the digits, and its target. */
function makeCage(cells: number[], grid: number[], profile: Profile, rng: Rng): Cage {
	const digits = cells.map((i) => grid[i]);
	let op: Op;
	if (cells.length === 1) op = '=';
	else if (cells.length === 2) {
		const hi = Math.max(...digits);
		const lo = Math.min(...digits);
		const options: Op[] = [];
		if (rng.next() < profile.diffDivShare) {
			if (hi % lo === 0 && hi / lo > 1) options.push('/');
			options.push('-');
		} else options.push('+', '*');
		op = rng.pick(options);
	} else {
		op = rng.next() < 0.6 ? '+' : '*';
	}
	return { cells, op, target: evaluate(op, digits) };
}

/**
 * Turn a layout into a uniquely solvable puzzle: while there are several solutions, a cell where
 * two of them differ becomes its own cage, which shows its digit.
 */
function makeUnique(
	groups: number[][],
	grid: number[],
	n: number,
	profile: Profile,
	rng: Rng
): CalcPuzzle | null {
	const cages = groups.map((g) => makeCage(g, grid, profile, rng));
	for (let round = 0; round < n * n; round++) {
		const puzzle = { width: n, height: n, cages };
		// A puzzle that logic alone solves has one solution; that is much cheaper than a search.
		if (rateCalc(puzzle, CalcLevel.Advanced).solved) return puzzle;
		const res = solveCalc(puzzle, { limit: 2, maxNodes: 2_000 });
		if (!res.finished) return null;
		if (res.solutions.length === 1) return puzzle;
		const [a, b] = res.solutions;
		const cell = a.findIndex((d, i) => d !== b[i]);
		const k = cages.findIndex((c) => c.cells.includes(cell));
		const rest = cages[k].cells.filter((i) => i !== cell);
		const parts = [[cell], ...splitConnected(rest, n)];
		cages.splice(k, 1, ...parts.map((g) => makeCage(g, grid, profile, rng)));
	}
	return null;
}

/** Connected pieces of a set of cells. */
function splitConnected(cells: number[], n: number): number[][] {
	const left = new Set(cells);
	const out: number[][] = [];
	for (const start of cells) {
		if (!left.has(start)) continue;
		const piece = [start];
		left.delete(start);
		for (let k = 0; k < piece.length; k++) {
			for (const j of neighbours(piece[k], n)) {
				if (left.has(j)) {
					left.delete(j);
					piece.push(j);
				}
			}
		}
		out.push(piece.sort((a, b) => a - b));
	}
	return out;
}

const singles = (p: CalcPuzzle) => p.cages.filter((c) => c.cells.length === 1).length;

/**
 * A Calcudoku with exactly one solution, solvable without guessing. Easy needs only cage
 * arithmetic and row/column eliminations; hard needs hidden singles or pairs too. Deterministic
 * per seed.
 */
export function generateCalc(n: number, difficulty: Difficulty, seed: number): GeneratedCalc {
	const rng = new Rng(seed);
	const profile = PROFILES[difficulty];
	let best: GeneratedCalc | null = null;
	let bestScore = -Infinity;
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const grid = randomLatinSquare(n, rng);
		const puzzle = makeUnique(partition(n, profile, rng), grid, n, profile, rng);
		if (!puzzle) continue;
		const fits = rateCalc(puzzle, profile.maxLevel).solved;
		const advanced = !rateCalc(puzzle, CalcLevel.Basic).solved;
		const ok = fits && (!profile.needsAdvanced || advanced);
		const score = (ok ? 1000 : 0) + (fits ? 500 : 0) - singles(puzzle);
		if (score > bestScore) {
			best = { puzzle, solution: grid };
			bestScore = score;
		}
		if (ok && singles(puzzle) <= (difficulty === 'easy' ? n : Math.floor(n / 3))) break;
	}
	if (!best) throw new Error('generation failed');
	return best;
}
