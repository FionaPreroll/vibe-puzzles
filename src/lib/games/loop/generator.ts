import { neighbours } from '../../core/grid';
import { Rng } from '../../core/rng';
import type { Difficulty } from '../../core/variants';
import { emptyLoopState, hIndex, LINE, vIndex, type LoopPuzzle, type LoopState } from './rules';
import { LoopLevel, rateLoop } from './solver';

export interface GeneratedLoop {
	puzzle: LoopPuzzle;
	/** The loop as lines on the board. */
	solution: LoopState;
}

/** Attempts per puzzle: a new random loop each, with the same `Rng`. */
const ATTEMPTS = 40;

/**
 * Boards from this many cells on (10×10) get a loop that spreads over the whole board
 * (`spreadLoop`). Smaller ones keep the plain loop of `randomLoop`, so their puzzle IDs keep
 * their puzzles.
 */
const SPREAD_FROM = 100;
/** A spread loop leaves no square of more than this side untouched (`emptySquare`). */
const MAX_EMPTY = 3;
/** Loops tried for that; the one with the smallest untouched square wins if none gets there. */
const SPREAD_TRIES = 30;
/** How far around a cell `randomLoop` looks to see whether it reaches into an empty part. */
const REACH = 3;

/**
 * A random loop, as the cells inside it. Grows a region from one cell, adding neighbouring cells
 * only while the region's border stays one simple loop: the cells outside stay connected to the
 * edge of the grid (no holes), and no dot has inside cells on one diagonal and outside cells on
 * the other (where the loop would touch itself).
 *
 * With `spread`, cells that reach into a part of the board with few inside cells come up more
 * often, so the region sends arms across the board instead of growing as one lump.
 */
export function randomLoop(w: number, h: number, rng: Rng, spread = false): boolean[] {
	const n = w * h;
	const inside = new Array<boolean>(n).fill(false);
	const at = (r: number, c: number) => r >= 0 && c >= 0 && r < h && c < w && inside[r * w + c];
	const touchesItself = (r: number, c: number) => {
		// The four dots around cell (r, c), each with the cells above-left .. below-right of it.
		for (const [i, j] of [
			[r, c],
			[r, c + 1],
			[r + 1, c],
			[r + 1, c + 1]
		]) {
			const [a, b, x, d] = [at(i - 1, j - 1), at(i - 1, j), at(i, j - 1), at(i, j)];
			if (a === d && b === x && a !== b) return true;
		}
		return false;
	};
	const outsideConnected = () => {
		const seen = new Uint8Array(n);
		const stack: number[] = [];
		for (let i = 0; i < n; i++) {
			const r = Math.floor(i / w);
			const c = i % w;
			if (!inside[i] && (r === 0 || c === 0 || r === h - 1 || c === w - 1)) {
				seen[i] = 1;
				stack.push(i);
			}
		}
		while (stack.length) {
			for (const j of neighbours(stack.pop()!, w, h)) {
				if (!inside[j] && !seen[j]) {
					seen[j] = 1;
					stack.push(j);
				}
			}
		}
		return inside.every((x, i) => x || seen[i]);
	};

	inside[rng.int(n)] = true;
	let size = 1;
	const target = Math.round(n * (0.4 + 0.2 * rng.next()));
	const blocked = new Set<number>();
	while (size < target) {
		const frontier: number[] = [];
		const weights: number[] = [];
		const around = spread ? insideAround(w, h, inside) : null;
		for (let i = 0; i < n; i++) {
			if (inside[i] || blocked.has(i)) continue;
			// Cells with one inside neighbour come up more often: the loop gets more turns.
			const touching = neighbours(i, w, h).filter((j) => inside[j]).length;
			if (touching === 0) continue;
			if (around) {
				frontier.push(i);
				weights.push((touching === 1 ? 3 : 1) * (1 + 20 * (1 - around(i)) ** 3));
			} else frontier.push(...(touching === 1 ? [i, i, i] : [i]));
		}
		if (frontier.length === 0) break;
		const i = around ? pickWeighted(rng, frontier, weights) : rng.pick(frontier);
		inside[i] = true;
		if (touchesItself(Math.floor(i / w), i % w) || !outsideConnected()) {
			inside[i] = false;
			blocked.add(i);
			continue;
		}
		size++;
		// A cell blocked before may fit now that the region changed.
		blocked.clear();
	}
	return inside;
}

/**
 * The share of inside cells among the cells up to `REACH` rows and columns away from each cell
 * (within the board), from running sums over the board.
 */
function insideAround(w: number, h: number, inside: boolean[]): (i: number) => number {
	const sum = new Int32Array((w + 1) * (h + 1));
	for (let r = 0; r < h; r++) {
		for (let c = 0; c < w; c++) {
			sum[(r + 1) * (w + 1) + c + 1] =
				(inside[r * w + c] ? 1 : 0) +
				sum[r * (w + 1) + c + 1] +
				sum[(r + 1) * (w + 1) + c] -
				sum[r * (w + 1) + c];
		}
	}
	return (i) => {
		const r = Math.floor(i / w);
		const c = i % w;
		const [r0, r1] = [Math.max(0, r - REACH), Math.min(h, r + REACH + 1)];
		const [c0, c1] = [Math.max(0, c - REACH), Math.min(w, c + REACH + 1)];
		const count =
			sum[r1 * (w + 1) + c1] -
			sum[r0 * (w + 1) + c1] -
			sum[r1 * (w + 1) + c0] +
			sum[r0 * (w + 1) + c0];
		return count / ((r1 - r0) * (c1 - c0));
	};
}

function pickWeighted(rng: Rng, items: number[], weights: number[]): number {
	let r = rng.next() * weights.reduce((a, b) => a + b, 0);
	for (let k = 0; k < items.length - 1; k++) {
		if (r < weights[k]) return items[k];
		r -= weights[k];
	}
	return items[items.length - 1];
}

/**
 * The side of the largest square of cells that the loop around the inside cells does not touch:
 * an empty patch where the puzzle has nothing to work out.
 */
export function emptySquare(w: number, h: number, inside: boolean[]): number {
	const at = (r: number, c: number) => r >= 0 && c >= 0 && r < h && c < w && inside[r * w + c];
	const size = new Int32Array(w * h);
	let best = 0;
	for (let r = 0; r < h; r++) {
		for (let c = 0; c < w; c++) {
			const me = at(r, c);
			if (at(r - 1, c) !== me || at(r + 1, c) !== me || at(r, c - 1) !== me) continue;
			if (at(r, c + 1) !== me) continue;
			const i = r * w + c;
			size[i] = r && c ? 1 + Math.min(size[i - w], size[i - 1], size[i - w - 1]) : 1;
			best = Math.max(best, size[i]);
		}
	}
	return best;
}

/**
 * A loop that runs across the whole board: grown with `spread`, and tried again (up to
 * `SPREAD_TRIES` times) while it leaves a square of more than `MAX_EMPTY` cells untouched.
 * A single grown region leaves big empty patches on big boards: up to 12×12 cells on 25×30.
 */
export function spreadLoop(w: number, h: number, rng: Rng): boolean[] {
	let best: boolean[] = [];
	let bestEmpty = Infinity;
	for (let t = 0; t < SPREAD_TRIES && bestEmpty > MAX_EMPTY; t++) {
		const inside = randomLoop(w, h, rng, true);
		const empty = emptySquare(w, h, inside);
		if (empty < bestEmpty) [best, bestEmpty] = [inside, empty];
	}
	return best;
}

/** The loop around the inside cells, and the clue of every cell. */
function loopOf(w: number, h: number, inside: boolean[]): { clues: number[]; lines: LoopState } {
	const p: LoopPuzzle = { width: w, height: h, clues: '' };
	const lines = emptyLoopState(p);
	const at = (r: number, c: number) => r >= 0 && c >= 0 && r < h && c < w && inside[r * w + c];
	for (let i = 0; i <= h; i++) {
		for (let j = 0; j < w; j++) if (at(i - 1, j) !== at(i, j)) lines.h[hIndex(p, i, j)] = LINE;
	}
	for (let i = 0; i < h; i++) {
		for (let j = 0; j <= w; j++) if (at(i, j - 1) !== at(i, j)) lines.v[vIndex(p, i, j)] = LINE;
	}
	const clues = Array.from({ length: w * h }, (_, k) => {
		const r = Math.floor(k / w);
		const c = k % w;
		return (
			lines.h[hIndex(p, r, c)] +
			lines.h[hIndex(p, r + 1, c)] +
			lines.v[vIndex(p, r, c)] +
			lines.v[vIndex(p, r, c + 1)]
		);
	});
	return { clues, lines };
}

const puzzleOf = (w: number, h: number, clues: number[]): LoopPuzzle => ({
	width: w,
	height: h,
	clues: clues.map((x) => (x < 0 ? '.' : String(x))).join('')
});

/** The techniques each difficulty may use. */
const LEVEL: Record<string, LoopLevel> = { normal: LoopLevel.Basic, hard: LoopLevel.Advanced };

/** Solvable with the techniques up to `level`, which also proves the solution unique. */
const solves = (p: LoopPuzzle, level: LoopLevel) => rateLoop(p, level).solved;

/**
 * Whether a puzzle is what `difficulty` asks for: solvable with its techniques (hard: and not with
 * the basic ones alone), and with as few clues as they allow, so that removing any clue would
 * leave them stuck.
 */
export function fitsLoopDifficulty(p: LoopPuzzle, difficulty: Difficulty): boolean {
	const level = LEVEL[difficulty];
	if (!solves(p, level)) return false;
	if (level > LoopLevel.Basic && solves(p, LoopLevel.Basic)) return false;
	for (let c = 0; c < p.clues.length; c++) {
		if (p.clues[c] === '.') continue;
		const fewer = { ...p, clues: `${p.clues.slice(0, c)}.${p.clues.slice(c + 1)}` };
		if (solves(fewer, level)) return false;
	}
	return true;
}

/**
 * A puzzle of the given size: a random loop (spread over the board from 10×10 on) with every
 * clue shown, then clues removed in random order while the techniques of the difficulty still
 * solve the puzzle, which proves it unique.
 * Hard puzzles count when the basic techniques alone no longer solve them.
 */
export function generateLoop(
	w: number,
	h: number,
	difficulty: Difficulty,
	seed: number
): GeneratedLoop {
	const rng = new Rng(seed);
	const level = LEVEL[difficulty];
	let fallback: GeneratedLoop | null = null;
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const inside = w * h >= SPREAD_FROM ? spreadLoop(w, h, rng) : randomLoop(w, h, rng);
		const { clues, lines } = loopOf(w, h, inside);
		if (!solves(puzzleOf(w, h, clues), level)) continue;
		for (const c of rng.shuffle(Array.from({ length: w * h }, (_, k) => k))) {
			const clue = clues[c];
			clues[c] = -1;
			if (!solves(puzzleOf(w, h, clues), level)) clues[c] = clue;
		}
		const result = { puzzle: puzzleOf(w, h, clues), solution: lines };
		if (level === LoopLevel.Basic || !solves(result.puzzle, LoopLevel.Basic)) return result;
		fallback ??= result;
	}
	if (fallback) return fallback;
	throw new Error('generation failed');
}
