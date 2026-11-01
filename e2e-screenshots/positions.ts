import { readFileSync } from 'node:fs';
import { GAME_LOGIC } from '../src/lib/games/logic';
import { solveLoop } from '../src/lib/games/loop/solver';
import type { LoopPuzzle } from '../src/lib/games/loop/rules';
import { solvePinwheel } from '../src/lib/games/pinwheel/solver';
import type { PinwheelPuzzle } from '../src/lib/games/pinwheel/rules';
import { dealt, sourceOf, type PipesPuzzle } from '../src/lib/games/pipes/rules';
import { solvePipes } from '../src/lib/games/pipes/solver';
import type { SudokuPuzzle } from '../src/lib/games/sudoku/rules';
import { solveSudoku } from '../src/lib/games/sudoku/solver';
import { solveCalc } from '../src/lib/games/sudoku/calc/solver';
import { solveTetroid } from '../src/lib/games/tetroid/solver';
import type { TetroidPuzzle } from '../src/lib/games/tetroid/rules';

/**
 * Games half played, for the README: the first puzzle of a type in the bundled collection, with
 * part of its solution filled in. Each is an address that opens the puzzle at that position (the
 * `s` of a shared position), so the screenshots need no clicks on the board.
 */

// The marks of the edge games (Pinwheel, Loop) and Tetroid's cells: nothing, a line or a shaded
// cell, a cross.
const OPEN = 0;
const LINE = 1;
const SHADED = 1;
const CROSS = 2;

export interface Position {
	/** The page that opens the position. */
	path: string;
	width: number;
	height: number;
	/** Loop: the middles of edges the loop goes on to, in cells from the grid's top left corner. */
	next?: [number, number][];
}

/** The first puzzle of a type in the collection. */
function first<P>(game: string, type: string): { id: number; puzzle: P } {
	const file = JSON.parse(readFileSync(`static/puzzles/${game}/${type}/0000.json`, 'utf8'));
	return file.puzzles[0];
}

function position(game: string, type: string, id: number, state: unknown): string {
	const s = GAME_LOGIC[game].encodeState(state);
	return `/${game}?v=${type}&id=${id}&s=${encodeURIComponent(s)}`;
}

const row = (cell: number, width: number) => Math.floor(cell / width);
const col = (cell: number, width: number) => cell % width;

/**
 * Tetroid: the regions in the upper part of the board shaded, and crosses in some of their other
 * cells.
 */
export function tetroid(type = '8n', share = 0.55): Position {
	const { id, puzzle } = first<TetroidPuzzle>('tetroid', type);
	const [solution] = solveTetroid(puzzle, { limit: 1 }).solutions;
	const n = puzzle.width * puzzle.height;
	// A region counts as done when its first cell lies in the upper part.
	const firstCell = new Map<number, number>();
	for (let c = n - 1; c >= 0; c--) firstCell.set(puzzle.regions[c], c);
	const done = (c: number) => firstCell.get(puzzle.regions[c])! < n * share;
	const marks = Array.from({ length: n }, (_, c) =>
		!done(c) ? OPEN : solution[c] ? SHADED : c % 3 === 0 ? CROSS : OPEN
	);
	return {
		path: position('tetroid', type, id, { marks, auto: marks.map(() => 0) }),
		width: puzzle.width,
		height: puzzle.height
	};
}

/**
 * Pinwheel: the lines between the regions of the upper rows, the regions that lie wholly in them
 * outlined all round and every other one of them coloured.
 */
export function pinwheel(type = '7n', rows = 4): Position {
	const { id, puzzle } = first<PinwheelPuzzle>('pinwheel', type);
	const [owner] = solvePinwheel(puzzle, { limit: 1, branch: true }).solutions;
	const { width: w, height: h } = puzzle;
	// The regions that lie wholly in the upper rows.
	const lowest = new Map<number, number>();
	owner.forEach((o, c) => lowest.set(o, Math.max(lowest.get(o) ?? 0, row(c, w))));
	const finished = [...lowest].filter(([, r]) => r < rows).map(([o]) => o);
	const done = (c: number) => finished.includes(owner[c]);
	const edge = (a: number, b: number) =>
		owner[a] !== owner[b] && ((row(a, w) < rows && row(b, w) < rows) || done(a) || done(b))
			? LINE
			: OPEN;
	// Horizontal edge (i, j) lies between cells (i - 1, j) and (i, j); vertical (i, j) between
	// (i, j - 1) and (i, j). The border is never marked.
	const hEdges = Array.from({ length: (h + 1) * w }, (_, k) => {
		const i = Math.floor(k / w);
		const j = k % w;
		return i === 0 || i === h ? OPEN : edge((i - 1) * w + j, i * w + j);
	});
	const vEdges = Array.from({ length: h * (w + 1) }, (_, k) => {
		const i = Math.floor(k / (w + 1));
		const j = k % (w + 1);
		return j === 0 || j === w ? OPEN : edge(i * w + j - 1, i * w + j);
	});
	// Every other finished region, in the first colours.
	const colour = (o: number) => {
		const k = finished.indexOf(o);
		return k >= 0 && k % 2 === 0 ? ((k / 2) % 4) + 1 : 0;
	};
	return {
		path: position('pinwheel', type, id, {
			h: hEdges,
			v: vEdges,
			colors: Array.from(owner, colour),
			locks: new Array(puzzle.centres.length).fill(0)
		}),
		width: w,
		height: h
	};
}

/**
 * Sudoku or Calcudoku: about half the empty cells filled in, and notes in a few of the others
 * (the right digit and a wrong one).
 */
export function sudoku(type: string, share: number): Position {
	const { id, puzzle } = first<SudokuPuzzle>('sudoku', type);
	const size = puzzle.width;
	const solution = puzzle.cages
		? solveCalc({ width: size, height: size, cages: puzzle.cages }, { limit: 1 }).solutions[0]
		: Array.from(solveSudoku(puzzle.givens, size, { limit: 1 }).solutions[0]);
	const n = size * size;
	const values = new Array(n).fill(0);
	const notes = new Array(n).fill(0);
	// A fixed scatter of cells: filled, noted or left empty.
	for (let c = 0; c < n; c++) {
		if (puzzle.givens[c]) continue;
		const pick = (row(c, size) * 7 + col(c, size) * 3) % 10;
		if (pick < share * 10) values[c] = solution[c];
		else if (pick === 9) {
			const other = (solution[c] % size) + 1;
			notes[c] = (1 << (solution[c] - 1)) | (1 << (other - 1));
		}
	}
	return { path: position('sudoku', type, id, { values, notes }), width: size, height: size };
}

/** Loop: the loop drawn in the left part of the board, and crosses around its zeros. */
export function loop(type = '10n', share = 0.6): Position {
	const { id, puzzle } = first<LoopPuzzle>('loop', type);
	const [solution] = solveLoop(puzzle, { limit: 1 }).solutions;
	const { width: w, height: h } = puzzle;
	const hCount = (h + 1) * w;
	const zero = (i: number, j: number) => puzzle.clues[i * w + j] === '0';
	const value = (e: number, j: number, beside: boolean) =>
		solution[e] === LINE ? (j < w * share ? LINE : OPEN) : beside ? CROSS : OPEN;
	// The next lines: those of the following two columns.
	const following = (j: number) => j >= w * share && j < w * share + 2;
	const next: [number, number][] = [];
	for (let e = 0; e < solution.length; e++) {
		if (solution[e] !== LINE) continue;
		if (e < hCount && following(e % w)) next.push([(e % w) + 0.5, Math.floor(e / w)]);
		const k = e - hCount;
		if (k >= 0 && following(k % (w + 1))) next.push([k % (w + 1), Math.floor(k / (w + 1)) + 0.5]);
	}
	return {
		path: position('loop', type, id, {
			// h(i, j) lies between cells (i - 1, j) and (i, j); v(i, j) between (i, j - 1) and (i, j).
			h: Array.from({ length: hCount }, (_, e) => {
				const [i, j] = [Math.floor(e / w), e % w];
				return value(e, j, (i > 0 && zero(i - 1, j)) || (i < h && zero(i, j)));
			}),
			v: Array.from({ length: h * (w + 1) }, (_, k) => {
				const [i, j] = [Math.floor(k / (w + 1)), k % (w + 1)];
				return value(hCount + k, j, (j > 0 && zero(i, j - 1)) || (j < w && zero(i, j)));
			})
		}),
		width: w,
		height: h,
		next
	};
}

/** Pipes: the tiles near the source turned into place and locked, the rest as dealt. */
export function pipes(type = '7n', reach = 2): Position {
	const { id, puzzle } = first<PipesPuzzle>('pipes', type);
	const [solution] = solvePipes(puzzle, 1).solutions;
	const { width: w } = puzzle;
	const source = sourceOf(puzzle);
	const near = (c: number) =>
		Math.abs(row(c, w) - row(source, w)) + Math.abs(col(c, w) - col(source, w)) <= reach;
	const start = dealt(puzzle);
	const tiles = start.map((t, c) => (near(c) ? solution[c] : t));
	const locks = tiles.map((_, c) => (near(c) ? 1 : 0));
	return {
		path: position('pipes', type, id, { tiles, locks }),
		width: w,
		height: puzzle.height
	};
}
