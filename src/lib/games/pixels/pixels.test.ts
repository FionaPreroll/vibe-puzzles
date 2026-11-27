import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { isPlayable } from '../../core/variants';
import { i18n } from '../../i18n/index.svelte';
import { boardCells, clueSpace, pictureRegions, rowSlot } from './draw';
import {
	fitsPixelsDifficulty,
	generatePixels,
	harden,
	makeDecided,
	plainLines,
	randomPicture,
	rate
} from './generator';
import { pixels } from './index';
import { applyStroke, startStroke, strokeLine } from './input';
import { PIXELS_VARIANTS, pixelsLogic } from './logic';
import {
	analyze,
	blocksOf,
	cellKey,
	clueOf,
	CROSS,
	EMPTY,
	FILLED,
	isSolvedState,
	lineCells,
	lineCount,
	lineFits,
	lineKey,
	puzzleOf,
	type PixelsPuzzle
} from './rules';
import {
	deduce,
	LineSolver,
	PixelsLevel,
	PixelsSolver,
	ratePixels,
	solvePixels,
	UNKNOWN
} from './solver';

/** A picture from its rows, `#` for a filled cell. */
const picture = (...rows: string[]) => Array.from(rows.join(''), (ch) => (ch === '#' ? 1 : 0));
/** The puzzle a picture makes. */
const board = (...rows: string[]): PixelsPuzzle =>
	puzzleOf(rows[0].length, rows.length, picture(...rows));

/** Two filled cells on a diagonal: the other diagonal fits the numbers too. */
const DIAGONAL = board('#.', '.#');
/** Rows and columns that each fit, but not together: no picture has them all. */
const NO_PICTURE: PixelsPuzzle = {
	width: 4,
	height: 4,
	rows: [[1, 1], [1], [1, 1], [2]],
	cols: [[1, 1], [1, 1], [1], [2]]
};

/** A line as the solver reads it: `#` filled, `x` crossed, `.` open. */
const line = (text: string) =>
	Uint8Array.from(text, (ch) => (ch === '#' ? FILLED : ch === 'x' ? CROSS : UNKNOWN));
const shown = (out: Uint8Array) =>
	Array.from(out, (v) => (v === FILLED ? '#' : v === CROSS ? 'x' : '.')).join('');

function solveLine(clue: number[], text: string): string | null {
	const out = new Uint8Array(text.length);
	return new LineSolver().solve(clue, line(text), out) ? shown(out) : null;
}

describe('pixels rules', () => {
	it('reads the blocks of a line and the numbers of a picture', () => {
		expect(blocksOf(7, (i) => [1, 1, 0, 1, 0, 0, 1][i] === 1)).toEqual([2, 1, 1]);
		expect(blocksOf(3, () => false)).toEqual([]);
		const p = board('##.', '...', '#.#');
		expect(p.rows).toEqual([[2], [], [1, 1]]);
		expect(p.cols).toEqual([[1, 1], [1], [1]]);
		expect(lineCount(p)).toBe(6);
		expect(lineCells(p, 2)).toEqual([6, 7, 8]);
		expect(lineCells(p, 4)).toEqual([1, 4, 7]);
		expect(clueOf(p, 3)).toEqual([1, 1]);
		expect([lineKey(p, 0), lineKey(p, 5)]).toEqual(['r:0', 'c:2']);
		expect(cellKey(4)).toBe('4');
	});

	it('takes a position whose filled cells show every row and column', () => {
		const p = board('##.', '...', '#.#');
		const cells = picture('##.', '...', '#.#');
		expect(isSolvedState(p, { cells })).toBe(true);
		// Crosses count as empty.
		expect(isSolvedState(p, { cells: cells.map((m) => m || CROSS) })).toBe(true);
		expect(isSolvedState(p, { cells: picture('##.', '...', '##.') })).toBe(false);
		expect(isSolvedState(p, { cells: picture('#..', '...', '#.#') })).toBe(false);
	});

	it('tells whether the marks of a line leave room for its blocks', () => {
		const marks = (text: string) =>
			Array.from(text, (ch) => (ch === '#' ? FILLED : ch === 'x' ? CROSS : EMPTY));
		expect(lineFits([2, 1], marks('....'))).toBe(true);
		expect(lineFits([2, 1], marks('.x..'))).toBe(false);
		expect(lineFits([2], marks('#.#.'))).toBe(false);
		expect(lineFits([], marks('x..'))).toBe(true);
		expect(lineFits([], marks('.#.'))).toBe(false);
		expect(lineFits([1, 1], marks('#x#'))).toBe(true);
		expect(lineFits([3], marks('##'))).toBe(false);
	});

	it('greys out the blocks in place and marks lines that break', () => {
		const p: PixelsPuzzle = {
			width: 6,
			height: 1,
			rows: [[1, 2]],
			cols: [[1], [], [], [1], [1], []]
		};
		const analyse = (text: string) =>
			analyze(p, {
				cells: Array.from(text, (ch) => (ch === '#' ? FILLED : ch === 'x' ? CROSS : EMPTY))
			});
		// Closed off by the edge and a cross: the 1 is done; the 2 is still open.
		expect(analyse('#x.#..').done[0]).toEqual([true, false]);
		// From the right: the 2, closed off by a cross, or by the edge.
		expect(analyse('..x##x').done[0]).toEqual([false, true]);
		expect(analyse('...x##').done[0]).toEqual([false, true]);
		// The filled cells make all the blocks: everything is done, crosses or not.
		expect(analyse('#..##.').done[0]).toEqual([true, true]);
		// A run not closed off yet, or shorter than its block, stops the walk.
		expect(analyse('#.....').done[0]).toEqual([false, false]);
		expect(analyse('.....#').done[0]).toEqual([false, false]);
		// Too many filled cells: the row is wrong, nothing is done.
		expect(analyse('#x###.').error[0]).toBe(true);
		expect(analyse('#x###.').done[0]).toEqual([false, false]);
		// A column without blocks is done from the start; a filled cell there is wrong.
		expect(analyse('......').done[2]).toEqual([]);
		expect(analyse('.#....').error[2]).toBe(true);
	});
});

describe('pixels line solver', () => {
	it('fills what every way to place the blocks covers', () => {
		expect(solveLine([3], '.....')).toBe('..#..');
		expect(solveLine([4], '.....')).toBe('.###.');
		expect(solveLine([1, 1], '...')).toBe('#x#');
		expect(solveLine([2, 2], '......')).toBe('.#..#.');
		expect(solveLine([5], '.....')).toBe('#####');
	});

	it('crosses what no way reaches', () => {
		expect(solveLine([], '...')).toBe('xxx');
		expect(solveLine([2], '.#..')).toBe('.#.x');
		expect(solveLine([1], '.x')).toBe('#x');
		expect(solveLine([3], '..x.....')).toBe('xxx..#..');
		expect(solveLine([1, 3], '#.......')).toBe('#x......');
	});

	it('keeps where each block can start', () => {
		const solver = new LineSolver();
		const out = new Uint8Array(7);
		expect(solver.solve([2, 1], line('.......'), out)).toBe(true);
		expect([solver.first[0], solver.last[0]]).toEqual([0, 3]);
		expect([solver.first[1], solver.last[1]]).toEqual([3, 6]);
		// Bigger lines and more blocks than before reuse grown buffers.
		const long = new Uint8Array(30);
		expect(solver.solve([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], line('.'.repeat(30)), long)).toBe(true);
	});

	it('says when no way fits', () => {
		expect(solveLine([2], '#x.')).toBeNull();
		expect(solveLine([3], '.x.x.')).toBeNull();
		expect(solveLine([2, 1], '.x..')).toBeNull();
		expect(solveLine([], '.#.')).toBeNull();
	});

	it('checks a line with every cell decided against its blocks', () => {
		expect(solveLine([2, 1], '##x#x')).toBe('##x#x');
		expect(solveLine([], 'xxx')).toBe('xxx');
		expect(solveLine([2, 1], '##x##')).toBeNull();
		expect(solveLine([2, 1], '##xxx')).toBeNull();
		expect(solveLine([2], '##x#x')).toBeNull();
		expect(solveLine([1], 'xxx')).toBeNull();
	});
});

describe('pixels solver', () => {
	it('lets the lines decide what they can, line by line', () => {
		const p = board('###', '#..', '#.#');
		const solver = new PixelsSolver(p);
		const known = solver.start();
		expect(solver.propagate(known)).toBe(true);
		expect(PixelsSolver.done(known)).toBe(true);
		expect(Array.from(known)).toEqual(
			picture('###', '#..', '#.#').map((v) => (v ? FILLED : CROSS))
		);
		expect(solver.linesOf(5)).toEqual([1, 5]);
		expect(ratePixels(p)).toBe(PixelsLevel.Line);
	});

	it('names the line that breaks', () => {
		const solver = new PixelsSolver(board('#.', '..'));
		const known = solver.start();
		known[3] = FILLED;
		expect(solver.propagate(known, [1])).toBe(false);
		expect(solver.broken).toBe(1);
		expect(solver.solved).toBe(1);
	});

	it('tries cells where the lines get stuck', () => {
		const { puzzle } = generatePixels(5, 5, 'hard', 1);
		const lines = deduce(puzzle, PixelsLevel.Line)!;
		expect(PixelsSolver.open(lines)).toBeGreaterThan(0);
		const steps: number[] = [];
		const solver = new PixelsSolver(puzzle);
		const known = solver.start();
		expect(solver.probe(known, (step) => steps.push(step.cell))).toBe(true);
		expect(PixelsSolver.done(known)).toBe(true);
		expect(steps.length).toBeGreaterThan(0);
		expect(ratePixels(puzzle)).toBe(PixelsLevel.Probe);
		expect(deduce(puzzle, PixelsLevel.Probe)).toEqual(known);
	});

	it('leaves cells open where two pictures fit, and finds both', () => {
		expect(ratePixels(DIAGONAL)).toBeNull();
		expect(PixelsSolver.open(deduce(DIAGONAL, PixelsLevel.Probe)!)).toBe(4);
		const res = solvePixels(DIAGONAL, 5);
		expect(res).toMatchObject({ finished: true });
		expect(res.solutions.map((s) => Array.from(s))).toEqual([
			[FILLED, CROSS, CROSS, FILLED],
			[CROSS, FILLED, FILLED, CROSS]
		]);
		expect(solvePixels(DIAGONAL, 1).solutions).toHaveLength(1);
		// Out of nodes: the search did not finish.
		expect(solvePixels(DIAGONAL, 5, 1)).toMatchObject({ finished: false, solutions: [] });
	});

	it('finds nothing where the rows and columns do not go together', () => {
		// Each line fits on its own, and the lines alone see no contradiction.
		expect(deduce(NO_PICTURE, PixelsLevel.Line)).not.toBeNull();
		expect(deduce(NO_PICTURE, PixelsLevel.Probe)).toBeNull();
		expect(ratePixels(NO_PICTURE)).toBeNull();
		expect(solvePixels(NO_PICTURE).solutions).toEqual([]);
		// A puzzle whose lines contradict each other at once.
		const clash: PixelsPuzzle = { width: 2, height: 1, rows: [[2]], cols: [[1], []] };
		expect(deduce(clash, PixelsLevel.Line)).toBeNull();
		expect(deduce(clash, PixelsLevel.Probe)).toBeNull();
		expect(ratePixels(clash)).toBeNull();
		expect(fitsPixelsDifficulty(clash, 'normal')).toBe(false);
		expect(solvePixels(clash).solutions).toEqual([]);
	});

	it('branches on a cell of the line with the fewest open cells', () => {
		const solver = new PixelsSolver(DIAGONAL);
		const known = solver.start();
		expect(solver.branchCell(known)).toBe(0);
		known.fill(FILLED);
		expect(solver.branchCell(known)).toBe(-1);
	});
});

describe('pixels generator', () => {
	it('makes the same puzzle for a seed, with one solution, at its level', () => {
		for (const [size, difficulty, seeds] of [
			[5, 'normal', [1, 2, 3, 4]],
			[5, 'hard', [1, 2, 3]],
			[10, 'normal', [1, 2, 3]],
			[10, 'hard', [1, 2]],
			[15, 'hard', [1]]
		] as const) {
			for (const seed of seeds) {
				const { puzzle, solution } = generatePixels(size, size, difficulty, seed);
				expect(generatePixels(size, size, difficulty, seed).puzzle).toEqual(puzzle);
				expect(puzzle).toEqual(puzzleOf(size, size, solution));
				expect(plainLines(size, size, Uint8Array.from(solution))).toBe(0);
				const res = solvePixels(puzzle, 2);
				expect(res.solutions, `${size} ${difficulty} ${seed}`).toHaveLength(1);
				expect(Array.from(res.solutions[0], (v) => (v === FILLED ? 1 : 0))).toEqual(solution);
				expect(fitsPixelsDifficulty(puzzle, difficulty)).toBe(true);
				expect(fitsPixelsDifficulty(puzzle, difficulty === 'hard' ? 'normal' : 'hard')).toBe(false);
			}
		}
	});

	it('leaves a fair share of a hard puzzle to the probe', () => {
		for (const seed of [1, 2, 3]) {
			const { solution } = generatePixels(10, 10, 'hard', seed);
			const { lineOpen } = rate(10, 10, Uint8Array.from(solution), PixelsLevel.Line);
			expect(lineOpen / 100).toBeGreaterThanOrEqual(0.1);
			expect(lineOpen / 100).toBeLessThanOrEqual(0.35);
		}
	});

	it('draws pictures in blobs', () => {
		const rng = new Rng(1);
		expect(Array.from(randomPicture(4, 3, rng, { density: 0, smooth: 1 }))).toEqual(
			new Array(12).fill(0)
		);
		expect(Array.from(randomPicture(4, 3, rng, { density: 1, smooth: 2 }))).toEqual(
			new Array(12).fill(1)
		);
		// A tie keeps a cell as it is: on two cells, one filled and one empty stay so.
		for (let seed = 1; seed <= 6; seed++) {
			const before = randomPicture(2, 1, new Rng(seed), { density: 0.5, smooth: 0 });
			expect(randomPicture(2, 1, new Rng(seed), { density: 0.5, smooth: 1 })).toEqual(before);
		}
		const noise = randomPicture(20, 20, new Rng(2), { density: 0.5, smooth: 0 });
		const blobs = randomPicture(20, 20, new Rng(2), { density: 0.5, smooth: 1 });
		const edges = (p: Uint8Array) =>
			p.reduce((n, v, c) => n + (c % 20 < 19 && v !== p[c + 1] ? 1 : 0), 0);
		expect(edges(blobs)).toBeLessThan(edges(noise) * 0.7);
	});

	it('counts the lines that are empty or full', () => {
		expect(plainLines(3, 2, Uint8Array.from(picture('###', '#..')))).toBe(2);
		expect(plainLines(3, 2, Uint8Array.from(picture('.#.', '#.#')))).toBe(0);
		expect(plainLines(2, 2, Uint8Array.from(picture('..', '..')))).toBe(4);
	});

	it('changes cells until no line is empty or full and the techniques decide all', () => {
		const blank = new Uint8Array(25);
		expect(makeDecided(5, 5, blank, PixelsLevel.Line, new Rng(1))).toBe(true);
		expect(plainLines(5, 5, blank)).toBe(0);
		expect(rate(5, 5, blank, PixelsLevel.Line).open).toBe(0);
		// On 2×2 only the two diagonals leave no line empty or full, and they share their numbers.
		const p = Uint8Array.from(picture('##', '..'));
		expect(makeDecided(2, 2, p, PixelsLevel.Probe, new Rng(1))).toBe(false);
		expect(plainLines(2, 2, p)).toBe(0);
		expect(rate(2, 2, p, PixelsLevel.Probe).open).toBe(4);
		// The probe is left out where `probeIf` says so.
		const q = Uint8Array.from(picture('#.', '.#'));
		expect(rate(2, 2, q, PixelsLevel.Probe, () => false)).toMatchObject({ lineOpen: 4, open: 4 });
	});

	it('hardens a picture up to the share the lines may leave open', () => {
		const p = Uint8Array.from(generatePixels(10, 10, 'hard', 1).solution);
		const before = rate(10, 10, p, PixelsLevel.Line).lineOpen;
		const share = harden(10, 10, p, new Rng(5));
		expect(share).toBeGreaterThanOrEqual(before / 100);
		expect(share).toBeLessThanOrEqual(0.35);
		expect(rate(10, 10, p, PixelsLevel.Line).lineOpen).toBe(share * 100);
		expect(rate(10, 10, p, PixelsLevel.Probe).open).toBe(0);
		expect(plainLines(10, 10, p)).toBe(0);
	});

	it('gives up on a board too small for a hard puzzle', () => {
		expect(() => generatePixels(1, 1, 'hard', 1)).toThrow('generation failed for 1x1 hard #1');
	});
});

describe('pixels logic', () => {
	const v = PIXELS_VARIANTS.find((x) => x.key === '5n')!;
	const { puzzle, solution } = generatePixels(5, 5, 'normal', 7);
	const solved = solution.map((x) => (x ? FILLED : EMPTY));

	it('lists every type as playable, specials last', () => {
		expect(PIXELS_VARIANTS.every(isPlayable)).toBe(true);
		expect(PIXELS_VARIANTS.filter((x) => x.special).map((x) => x.key)).toEqual([
			'daily',
			'weekly',
			'monthly'
		]);
		expect(pixelsLogic.generate(v, 7)).toEqual(puzzle);
	});

	it('counts solutions and rates difficulty', () => {
		expect(pixelsLogic.countSolutions(puzzle, 2)).toEqual({ count: 1, finished: true });
		expect(pixelsLogic.countSolutions(DIAGONAL, 2)).toEqual({ count: 2, finished: true });
		expect(pixelsLogic.fitsDifficulty(puzzle, v)).toBe(true);
	});

	it('checks puzzles from elsewhere', () => {
		expect(pixelsLogic.isValidPuzzle(puzzle, v)).toBe(true);
		const bad = (q: unknown) => expect(pixelsLogic.isValidPuzzle(q, v)).toBe(false);
		bad(null);
		bad('puzzle');
		bad({ ...puzzle, width: 4 });
		bad({ ...puzzle, rows: puzzle.rows.slice(1) });
		bad({ ...puzzle, rows: 'x' });
		bad({ ...puzzle, cols: puzzle.cols.slice(1) });
		bad({ ...puzzle, cols: 'xxxxx' });
		bad({ ...puzzle, rows: [[6], ...puzzle.rows.slice(1)] });
		bad({ ...puzzle, rows: [[3, 2], ...puzzle.rows.slice(1)] });
		bad({ ...puzzle, rows: [[0], ...puzzle.rows.slice(1)] });
		bad({ ...puzzle, rows: [[1.5], ...puzzle.rows.slice(1)] });
		bad({ ...puzzle, rows: ['1', ...puzzle.rows.slice(1)] });
		bad({ ...puzzle, rows: [[1, 1, 1, 1, 1, 1], ...puzzle.rows.slice(1)] });
		bad({ ...puzzle, cols: [[2, 2, 1], ...puzzle.cols.slice(1)] });
		// Rows and columns that fill different numbers of cells.
		const sum = (c: number[][]) => c.flat().reduce((a, b) => a + b, 0);
		const rows = sum(puzzle.rows) < 25 ? [[5], [5], [5], [5], [5]] : [[], [], [], [], []];
		bad({ ...puzzle, rows });
	});

	it('answers, checks answers and keeps states', () => {
		const state = { cells: solved };
		expect(pixelsLogic.isSolved(puzzle, state)).toBe(true);
		const answer = pixelsLogic.answer(puzzle, { cells: solved.map((m) => m || CROSS) });
		expect(answer).toBe(solution.join(''));
		expect(pixelsLogic.verifyAnswer(puzzle, answer)).toBe(true);
		expect(pixelsLogic.verifyAnswer(puzzle, answer.slice(1))).toBe(false);
		expect(pixelsLogic.verifyAnswer(puzzle, answer.replace(/.$/, '2'))).toBe(false);
		expect(pixelsLogic.verifyAnswer(puzzle, '0'.repeat(25))).toBe(false);
		const marked = { cells: solved.map((m, c) => (m ? m : c % 2 ? CROSS : EMPTY)) };
		expect(pixelsLogic.decodeState(puzzle, pixelsLogic.encodeState(marked))).toEqual(marked);
		expect(
			pixelsLogic.decodeState(puzzle, pixelsLogic.encodeState({ cells: new Array(25).fill(3) }))
		).toBeNull();
		expect(pixelsLogic.decodeState(puzzle, '%%%')).toBeNull();
		expect(pixelsLogic.emptyState(puzzle)).toEqual({ cells: new Array(25).fill(EMPTY) });
		expect(pixelsLogic.isValidState(puzzle, marked)).toBe(true);
		expect(pixelsLogic.isValidState(puzzle, null)).toBe(false);
		expect(pixelsLogic.isValidState(puzzle, { cells: 'x' })).toBe(false);
		expect(pixelsLogic.isValidState(puzzle, { cells: [1] })).toBe(false);
		expect(pixelsLogic.isValidState(puzzle, { cells: new Array(25).fill(-1) })).toBe(false);
		expect(pixelsLogic.isValidState(puzzle, { cells: new Array(25).fill(0.5) })).toBe(false);
	});
});

describe('pixels board', () => {
	it('moves along the row or the column it started in', () => {
		const empty = new Array(12).fill(EMPTY);
		const s = startStroke(empty, 'black', 5, false);
		expect(s).toEqual({ start: 5, end: 5, from: EMPTY, to: FILLED });
		// 4 wide, 3 high: from (1, 1) to (2, 3) runs along the row, to (0, 1) up the column.
		expect(strokeLine({ ...s, end: 11 }, 4)).toEqual([5, 6, 7]);
		expect(strokeLine({ ...s, end: 1 }, 4)).toEqual([5, 1]);
		expect(strokeLine({ ...s, end: 4 }, 4)).toEqual([5, 4]);
		expect(strokeLine(s, 4)).toEqual([5]);
		expect(startStroke(empty, 'black', 0, true).to).toBe(CROSS);
		expect(startStroke(empty, 'cross', 0, false).to).toBe(CROSS);
	});

	it('changes only the cells that look like the first one', () => {
		const cells = [EMPTY, CROSS, EMPTY, FILLED];
		const fill = applyStroke({ cells }, { start: 0, end: 3, from: EMPTY, to: FILLED }, 4);
		expect(fill).toEqual({ state: { cells: [FILLED, CROSS, FILLED, FILLED] }, changed: [0, 2] });
		const clear = applyStroke({ cells }, { start: 3, end: 0, from: FILLED, to: EMPTY }, 4);
		expect(clear).toEqual({ state: { cells: [EMPTY, CROSS, EMPTY, EMPTY] }, changed: [3] });
		const state = { cells };
		expect(applyStroke(state, { start: 1, end: 1, from: CROSS, to: CROSS }, 4)).toEqual({
			state,
			changed: []
		});
	});

	it('makes room for the numbers beside and above the grid', () => {
		const p = board('#.#.#', '.....', '#####');
		expect(clueSpace(p)).toEqual({ left: 3 * 0.62 + 0.3, top: 2 * 0.62 + 0.3 });
		const { left, top } = clueSpace(p);
		expect(boardCells(p)).toEqual({ width: 5 + left, height: 3 + top });
		expect(pixels.boardSize!(p)).toEqual(boardCells(p));
		// Numbers of two digits take more room; an empty board still shows its 0s.
		const wide: PixelsPuzzle = {
			width: 10,
			height: 1,
			rows: [[10]],
			cols: new Array(10).fill([1])
		};
		expect(rowSlot(wide)).toBe(0.95);
		expect(clueSpace(board('..', '..'))).toEqual({ left: 0.62 + 0.3, top: 0.62 + 0.3 });
	});

	it('colours each group of filled cells on its own when solved', () => {
		const p = board('#.#', '#..', '..#');
		const regions = pictureRegions(p, picture('#.#', '#..', '..#'));
		expect(regions).toEqual([0, 1, 2, 0, 1, 1, 1, 1, 3]);
	});

	it('names the changed cells and the game in the language', () => {
		const p = board('#.', '..');
		expect(pixels.changes(p, { cells: [0, 0, 0, 0] }, { cells: [1, 0, 2, 0] })).toEqual(['0', '2']);
		expect(pixels.defaultTool(true)).toBe('rotate');
		expect(pixels.defaultTool(false)).toBe('black');
		expect(pixels.name).toBe('Pixels');
		i18n.locale = 'de';
		expect(pixels.name).toBe('Pixelbild');
		i18n.locale = 'en';
	});
});
