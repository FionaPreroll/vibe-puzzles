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
 * A random loop, as the cells inside it. Grows a region from one cell, adding neighbouring cells
 * only while the region's border stays one simple loop: the cells outside stay connected to the
 * edge of the grid (no holes), and no dot has inside cells on one diagonal and outside cells on
 * the other (where the loop would touch itself).
 */
export function randomLoop(w: number, h: number, rng: Rng): boolean[] {
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
		for (let i = 0; i < n; i++) {
			if (inside[i] || blocked.has(i)) continue;
			// Cells with one inside neighbour come up more often: the loop gets more turns.
			const touching = neighbours(i, w, h).filter((j) => inside[j]).length;
			if (touching > 0) frontier.push(...(touching === 1 ? [i, i, i] : [i]));
		}
		if (frontier.length === 0) break;
		const i = rng.pick(frontier);
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
 * A puzzle of the given size: a random loop with every clue shown, then clues removed in random
 * order while the techniques of the difficulty still solve the puzzle, which proves it unique.
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
		const { clues, lines } = loopOf(w, h, randomLoop(w, h, rng));
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
