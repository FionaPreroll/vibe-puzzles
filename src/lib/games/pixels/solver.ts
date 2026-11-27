import * as rules from './rules';
import { lineCells, lineCount, type PixelsPuzzle } from './rules';

/**
 * The deduction for Pixels. What is known of each cell uses the board's marks: `UNKNOWN` (not
 * decided yet), `FILLED`, or `CROSS` for a cell that stays empty. So the player's position is
 * what they know, as it is.
 *
 * Its techniques, weakest first (`PixelsLevel`):
 *
 * - `Line`: one row or column at a time, every way to place its blocks that fits what is known
 *   of its cells (`LineSolver`). A cell that all of them fill is filled, one that none fills
 *   stays empty. Each new cell is news for the line across it, until no line has any.
 * - `Probe`: where the lines get stuck, a cell is tried filled and tried empty, and the lines
 *   follow from it; where they run into a line whose blocks no longer fit, the cell is the
 *   other way.
 */
export const PixelsLevel = { Line: 1, Probe: 2 } as const;
export type PixelsLevel = (typeof PixelsLevel)[keyof typeof PixelsLevel];

/**
 * A cell not decided yet: the board's mark for a cell the player has not marked. The marks are
 * copied into constants of this module, which the hot loops read faster than imported ones.
 */
export const UNKNOWN: number = rules.EMPTY;
const FILLED: number = rules.FILLED;
const CROSS: number = rules.CROSS;

/** What is known of every cell, row by row: `UNKNOWN`, `FILLED` or `CROSS`. */
export type Known = Uint8Array;

/**
 * Every way to place a line's blocks that fits what is known of its cells, at once: two passes
 * of dynamic programming over (blocks placed, cells used), `O(cells × blocks)`. The buffers are
 * kept between lines.
 */
export class LineSolver {
	#fwd = new Uint8Array(0);
	#bwd = new Uint8Array(0);
	#filledBefore = new Int32Array(0);
	#crossBefore = new Int32Array(0);
	#cover = new Int32Array(0);
	/** After `solve`: the first and the last cell where each block can start. */
	first = new Int32Array(0);
	last = new Int32Array(0);

	/**
	 * What every way to place `clue`'s blocks in `line` (what is known of its cells) agrees on,
	 * into `out`: `FILLED` where all of them fill a cell, `CROSS` where none does, `UNKNOWN`
	 * elsewhere. False when no way fits; `out` is then left as it is.
	 */
	solve(clue: readonly number[], line: ArrayLike<number>, out: Uint8Array): boolean {
		const n = line.length;
		const k = clue.length;
		const width = n + 1;
		if (this.#fwd.length < (k + 1) * width) {
			this.#fwd = new Uint8Array((k + 1) * width * 2);
			this.#bwd = new Uint8Array((k + 1) * width * 2);
		}
		if (this.#filledBefore.length < width) {
			this.#filledBefore = new Int32Array(width * 2);
			this.#crossBefore = new Int32Array(width * 2);
			this.#cover = new Int32Array(width * 2);
		}
		if (this.first.length < k) {
			this.first = new Int32Array(k * 2);
			this.last = new Int32Array(k * 2);
		}
		const fwd = this.#fwd;
		const bwd = this.#bwd;
		const fb = this.#filledBefore;
		const cb = this.#crossBefore;
		for (let i = 0; i < n; i++) {
			fb[i + 1] = fb[i] + (line[i] === FILLED ? 1 : 0);
			cb[i + 1] = cb[i] + (line[i] === CROSS ? 1 : 0);
		}
		// A line with every cell decided only has to show its blocks.
		if (fb[n] + cb[n] === n) {
			if (!showsBlocks(clue, line)) return false;
			for (let x = 0; x < n; x++) out[x] = line[x];
			return true;
		}
		// fwd[j * width + i]: the first j blocks fit into the first i cells.
		for (let i = 0; i <= n; i++) fwd[i] = fb[i] === 0 ? 1 : 0;
		for (let j = 1; j <= k; j++) {
			const len = clue[j - 1];
			const row = j * width;
			const before = (j - 1) * width;
			fwd[row] = 0;
			for (let i = 1; i <= n; i++) {
				let fits = line[i - 1] !== FILLED && fwd[row + i - 1] === 1;
				const s = i - len;
				if (!fits && s >= 0 && cb[i] === cb[s]) {
					fits =
						j === 1 ? fwd[s] === 1 : s >= 1 && line[s - 1] !== FILLED && fwd[before + s - 1] === 1;
				}
				fwd[row + i] = fits ? 1 : 0;
			}
		}
		if (fwd[k * width + n] !== 1) return false;
		// bwd[j * width + i]: the blocks from j on fit into the cells from i on.
		for (let i = 0; i <= n; i++) bwd[k * width + i] = fb[n] === fb[i] ? 1 : 0;
		for (let j = k - 1; j >= 0; j--) {
			const len = clue[j];
			const row = j * width;
			const after = (j + 1) * width;
			bwd[row + n] = 0;
			for (let i = n - 1; i >= 0; i--) {
				let fits = line[i] !== FILLED && bwd[row + i + 1] === 1;
				const e = i + len;
				if (!fits && e <= n && cb[e] === cb[i]) {
					fits =
						j === k - 1
							? bwd[after + e] === 1
							: e < n && line[e] !== FILLED && bwd[after + e + 1] === 1;
				}
				bwd[row + i] = fits ? 1 : 0;
			}
		}
		// Where each block can lie: after the blocks before it, before the blocks after it.
		const cover = this.#cover;
		cover.fill(0, 0, width);
		for (let j = 0; j < k; j++) {
			const len = clue[j];
			this.first[j] = n;
			this.last[j] = -1;
			for (let s = 0; s + len <= n; s++) {
				const e = s + len;
				if (cb[e] !== cb[s]) continue;
				const left =
					j === 0 ? fwd[s] === 1 : s >= 1 && line[s - 1] !== FILLED && fwd[j * width + s - 1] === 1;
				if (!left) continue;
				const right =
					j === k - 1
						? bwd[k * width + e] === 1
						: e < n && line[e] !== FILLED && bwd[(j + 1) * width + e + 1] === 1;
				if (!right) continue;
				cover[s]++;
				cover[e]--;
				if (s < this.first[j]) this.first[j] = s;
				this.last[j] = s;
			}
		}
		let covered = 0;
		for (let x = 0; x < n; x++) {
			covered += cover[x];
			let free = false;
			if (line[x] !== FILLED) {
				for (let j = 0; j <= k && !free; j++) {
					free = fwd[j * width + x] === 1 && bwd[j * width + x + 1] === 1;
				}
			}
			out[x] = covered > 0 ? (free ? UNKNOWN : FILLED) : CROSS;
		}
		return true;
	}
}

/** Whether the filled cells of a decided line are its blocks, in order. */
function showsBlocks(clue: readonly number[], line: ArrayLike<number>): boolean {
	let block = 0;
	let run = 0;
	for (let i = 0; i <= line.length; i++) {
		if (i < line.length && line[i] === FILLED) {
			run++;
			continue;
		}
		if (!run) continue;
		if (run !== clue[block++]) return false;
		run = 0;
	}
	return block === clue.length;
}

export interface SolveResult {
	/** What each solution fills, at most `limit`: `FILLED` or `CROSS` per cell. */
	solutions: Known[];
	/** False if the node budget ran out before the search was complete. */
	finished: boolean;
	nodes: number;
}

/** A cell the probe decided: tried the other way, the lines broke `line`. */
export interface ProbeStep {
	cell: number;
	value: number;
	/** The line whose blocks no longer fitted when the cell was tried the other way. */
	line: number;
	/** Lines solved after the trial until one broke. */
	steps: number;
}

export class PixelsSolver {
	readonly width: number;
	readonly height: number;
	readonly cells: number;
	readonly lines: number;
	/** The cells of each line, in order. */
	readonly lineCells: Int32Array[];
	readonly clues: number[][];
	readonly #line = new LineSolver();
	readonly #buf: Uint8Array;
	readonly #out: Uint8Array;
	readonly #queue: Int32Array;
	readonly #queued: Uint8Array;
	/** The line that broke in the last `propagate` that failed, and lines solved in it. */
	broken = -1;
	solved = 0;

	constructor(readonly puzzle: PixelsPuzzle) {
		this.width = puzzle.width;
		this.height = puzzle.height;
		this.cells = this.width * this.height;
		this.lines = lineCount(puzzle);
		this.lineCells = Array.from({ length: this.lines }, (_, l) =>
			Int32Array.from(lineCells(puzzle, l))
		);
		this.clues = [...puzzle.rows, ...puzzle.cols];
		const longest = Math.max(this.width, this.height);
		this.#buf = new Uint8Array(longest);
		this.#out = new Uint8Array(longest);
		this.#queue = new Int32Array(this.lines);
		this.#queued = new Uint8Array(this.lines);
	}

	/** Nothing known yet. */
	start(): Known {
		return new Uint8Array(this.cells);
	}

	/** The row and the column of a cell, as lines. */
	linesOf(cell: number): [number, number] {
		return [Math.floor(cell / this.width), this.height + (cell % this.width)];
	}

	/**
	 * What the line solver decides in line `line` given `known`, into `out` (one value per cell
	 * of the line): false when its blocks no longer fit.
	 */
	solveLine(known: Known, line: number, out: Uint8Array): boolean {
		const cells = this.lineCells[line];
		const buf = this.#buf.subarray(0, cells.length);
		for (let i = 0; i < cells.length; i++) buf[i] = known[cells[i]];
		return this.#line.solve(this.clues[line], buf, out);
	}

	/** The `LineSolver` of the last `solveLine`, for where its blocks can lie. */
	get lineSolver(): LineSolver {
		return this.#line;
	}

	/**
	 * `Line` until nothing changes, starting from the lines in `from` (every line if none): each
	 * line that gains a cell queues the line across it. False on a line whose blocks cannot fit
	 * (`broken` names it).
	 */
	propagate(known: Known, from?: readonly number[]): boolean {
		const queue = this.#queue;
		const queued = this.#queued;
		const lines = this.lines;
		let head = 0;
		let size = 0;
		queued.fill(0);
		const push = (l: number) => {
			if (queued[l]) return;
			queued[l] = 1;
			queue[(head + size) % lines] = l;
			size++;
		};
		if (from) for (const l of from) push(l);
		else for (let l = 0; l < lines; l++) push(l);
		this.broken = -1;
		this.solved = 0;
		const out = this.#out;
		while (size) {
			const l = queue[head];
			head = (head + 1) % lines;
			size--;
			queued[l] = 0;
			this.solved++;
			if (!this.solveLine(known, l, out)) {
				this.broken = l;
				return false;
			}
			const cells = this.lineCells[l];
			for (let i = 0; i < cells.length; i++) {
				const c = cells[i];
				if (out[i] === UNKNOWN || known[c] === out[i]) continue;
				known[c] = out[i];
				const [row, col] = this.linesOf(c);
				push(l === row ? col : row);
			}
		}
		return true;
	}

	/**
	 * Tries cell `cell` as `value` on a copy of `known` (into `scratch`) and lets the lines
	 * follow: false when that breaks a line, so the cell is the other way.
	 */
	tryCell(known: Known, cell: number, value: number, scratch: Known): boolean {
		scratch.set(known);
		scratch[cell] = value;
		return this.propagate(scratch, this.linesOf(cell));
	}

	/**
	 * `Line`, then `Probe` until nothing changes: every cell still open is tried both ways, in
	 * reading order, and the lines follow each one that breaks. False on a contradiction. `onStep`
	 * hears each cell a probe decides.
	 *
	 * A trial that breaks nothing is not repeated for what follows from it, until something new
	 * is known: a cell that it decides could only break where the trial itself would have.
	 */
	probe(known: Known, onStep?: (step: ProbeStep) => void): boolean {
		if (!this.propagate(known)) return false;
		const scratch = new Uint8Array(this.cells);
		// Per cell and value (`2 * cell + value - 1`): a trial that cannot break anything now.
		const safe = new Uint8Array(2 * this.cells);
		for (let changed = true; changed;) {
			changed = false;
			for (let c = 0; c < this.cells; c++) {
				if (known[c] !== UNKNOWN) continue;
				for (const value of [FILLED, CROSS]) {
					if (safe[2 * c + value - 1]) continue;
					if (this.tryCell(known, c, value, scratch)) {
						for (let d = 0; d < this.cells; d++) {
							if (scratch[d] !== known[d]) safe[2 * d + scratch[d] - 1] = 1;
						}
						continue;
					}
					const other = value === FILLED ? CROSS : FILLED;
					onStep?.({ cell: c, value: other, line: this.broken, steps: this.solved });
					known[c] = other;
					if (!this.propagate(known, this.linesOf(c))) return false;
					safe.fill(0);
					changed = true;
					break;
				}
			}
		}
		return true;
	}

	/** Whether every cell is decided. */
	static done(known: Known): boolean {
		return known.every((v) => v !== UNKNOWN);
	}

	/** Cells still open. */
	static open(known: Known): number {
		let n = 0;
		for (let c = 0; c < known.length; c++) if (known[c] === UNKNOWN) n++;
		return n;
	}

	/**
	 * Every solution, up to `limit`: `Line` and `Probe` at every node, then a branch on an open
	 * cell, filled first. `maxNodes` bounds the search; `finished` says whether it ran to the end.
	 */
	solve(limit = 2, maxNodes = 200_000, known = this.start()): SolveResult {
		const solutions: Known[] = [];
		let nodes = 0;
		let finished = true;
		const visit = (k: Known, from?: readonly number[]): void => {
			if (solutions.length >= limit || !finished) return;
			if (++nodes > maxNodes) {
				finished = false;
				return;
			}
			if (!this.propagate(k, from) || !this.probe(k)) return;
			const cell = this.branchCell(k);
			if (cell < 0) {
				solutions.push(k);
				return;
			}
			for (const value of [FILLED, CROSS]) {
				const next = k.slice();
				next[cell] = value;
				visit(next, this.linesOf(cell));
			}
		};
		visit(known.slice());
		return { solutions, finished, nodes };
	}

	/** The open cell to branch on: one in the line with the fewest open cells, or -1. */
	branchCell(known: Known): number {
		let best = -1;
		let fewest = Infinity;
		for (let l = 0; l < this.lines; l++) {
			const cells = this.lineCells[l];
			let open = 0;
			let first = -1;
			for (let i = 0; i < cells.length; i++) {
				if (known[cells[i]] !== UNKNOWN) continue;
				if (first < 0) first = cells[i];
				open++;
			}
			if (open && open < fewest) {
				fewest = open;
				best = first;
			}
		}
		return best;
	}
}

/** How far the techniques up to `level` get on a puzzle: what they leave known. */
export function deduce(p: PixelsPuzzle, level: PixelsLevel): Known | null {
	const solver = new PixelsSolver(p);
	const known = solver.start();
	const ok = level === PixelsLevel.Line ? solver.propagate(known) : solver.probe(known);
	return ok ? known : null;
}

/**
 * The weakest level whose techniques decide every cell (which proves the solution unique), or
 * null when even `Probe` leaves cells open.
 */
export function ratePixels(p: PixelsPuzzle): PixelsLevel | null {
	const solver = new PixelsSolver(p);
	const known = solver.start();
	if (!solver.propagate(known)) return null;
	if (PixelsSolver.done(known)) return PixelsLevel.Line;
	return solver.probe(known) && PixelsSolver.done(known) ? PixelsLevel.Probe : null;
}

/** Solutions of a puzzle, up to `limit`, for `countSolutions`. */
export function solvePixels(p: PixelsPuzzle, limit = 2, maxNodes = 200_000): SolveResult {
	return new PixelsSolver(p).solve(limit, maxNodes);
}
