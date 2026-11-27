import {
	blocksOf,
	clueOf,
	CROSS,
	FILLED,
	lineCount,
	type PixelsPuzzle,
	type PixelsState
} from './rules';
import { PixelsSolver, solvePixels, UNKNOWN, type Known } from './solver';

/**
 * How a step follows, simplest first:
 *
 * - `overlap`: slid as far as they go to one end and then to the other (keeping to the marks),
 *   a block covers the same cells both ways.
 * - `done`: the filled cells already make all of the line's blocks; the rest stays empty.
 * - `zero`: the line has no blocks at all.
 * - `reach`: no block reaches the cells, slid either way.
 * - `line`: every way to place the blocks that fits the marks fills the cells, or none does.
 * - `assumption`: the lines follow from the cell tried the other way until one breaks.
 */
export type PixelsTechnique = 'overlap' | 'done' | 'zero' | 'reach' | 'line' | 'assumption';

export type PixelsHint =
	| {
			/** Marks the solution breaks: filled cells that stay empty, crosses on filled ones. */
			kind: 'mistake' | 'stuck';
			cells: number[];
	  }
	| {
			kind: 'step';
			technique: PixelsTechnique;
			/** The line the step is in (rows first, then columns); for an assumption, the one that breaks. */
			line: number;
			/** The cells that follow, all `FILLED` or all `CROSS` (`value`). */
			cells: number[];
			value: number;
			/** `overlap`: the length of the block that covers them, if it is one block. */
			block?: number;
	  };

/** Line steps in the order the hint prefers them: fills first, the simplest reasoning first. */
const ORDER: { technique: Exclude<PixelsTechnique, 'assumption'>; value: number }[] = [
	{ technique: 'overlap', value: FILLED },
	{ technique: 'done', value: CROSS },
	{ technique: 'zero', value: CROSS },
	{ technique: 'reach', value: CROSS },
	{ technique: 'line', value: FILLED },
	{ technique: 'line', value: CROSS }
];

const solutions = new WeakMap<PixelsPuzzle, Known | null>();

/** The solution of a puzzle, kept per puzzle; null when the solver finds none in its budget. */
export function solutionOf(p: PixelsPuzzle): Known | null {
	if (!solutions.has(p)) solutions.set(p, solvePixels(p, 1, 5_000).solutions[0] ?? null);
	return solutions.get(p)!;
}

/** The cells a line step decides, by technique and value, with the overlapping blocks. */
interface LineSteps {
	cells: Map<string, number[]>;
	/** The blocks (by their place in the line's numbers) whose overlap fills cells. */
	blocks: Set<number>;
}

/**
 * What line `line` decides from `known` and why: each new cell under the simplest technique
 * that explains it. Null when the line's blocks no longer fit.
 */
export function lineSteps(solver: PixelsSolver, known: Known, line: number): LineSteps | null {
	const cells = solver.lineCells[line];
	const out = new Uint8Array(cells.length);
	if (!solver.solveLine(known, line, out)) return null;
	const clue = clueOf(solver.puzzle, line);
	const { first, last } = solver.lineSolver;
	const marks = Array.from(cells, (c) => known[c]);
	const done = blocksOf(marks.length, (i) => marks[i] === FILLED).join() === clue.join();
	const steps: LineSteps = { cells: new Map(), blocks: new Set() };
	const add = (technique: string, value: number, cell: number) => {
		const key = `${technique}:${value}`;
		steps.cells.set(key, [...(steps.cells.get(key) ?? []), cell]);
	};
	for (let i = 0; i < cells.length; i++) {
		if (marks[i] !== UNKNOWN || out[i] === UNKNOWN) continue;
		if (out[i] === CROSS) {
			const reached = clue.some((len, j) => first[j] <= i && i < last[j] + len);
			add(!clue.length ? 'zero' : done ? 'done' : reached ? 'line' : 'reach', CROSS, cells[i]);
			continue;
		}
		// Two blocks never both cover a cell every way: at most one does.
		const block = clue.findIndex((len, j) => last[j] <= i && i < first[j] + len);
		add(block >= 0 ? 'overlap' : 'line', FILLED, cells[i]);
		if (block >= 0) steps.blocks.add(block);
	}
	return steps;
}

/** The cell to try where no line decides one: the one whose trial breaks a line soonest. */
function assumption(solver: PixelsSolver, known: Known): PixelsHint | null {
	const scratch = new Uint8Array(known.length);
	let best: { cell: number; value: number; line: number; steps: number } | null = null;
	for (let c = 0; c < known.length; c++) {
		if (known[c] !== UNKNOWN) continue;
		for (const value of [FILLED, CROSS]) {
			if (solver.tryCell(known, c, value, scratch)) continue;
			if (!best || solver.solved < best.steps) {
				best = { cell: c, value, line: solver.broken, steps: solver.solved };
			}
		}
	}
	if (!best) return null;
	return {
		kind: 'step',
		technique: 'assumption',
		line: best.line,
		cells: [best.cell],
		value: best.value === FILLED ? CROSS : FILLED
	};
}

/**
 * The next step from the player's position: their marks count as what they know. Marks the
 * solution breaks come first; then the line step that the simplest reasoning gives, the one
 * with the most cells; where no line gives one, the cell whose trial breaks a line soonest.
 */
export function pixelsHint(p: PixelsPuzzle, s: PixelsState): PixelsHint | null {
	const solution = solutionOf(p);
	if (solution) {
		const wrong = s.cells.flatMap((m, c) =>
			(m === FILLED || m === CROSS) && m !== solution[c] ? [c] : []
		);
		if (wrong.length) return { kind: 'mistake', cells: wrong };
	}
	const known = Uint8Array.from(s.cells);
	if (PixelsSolver.done(known)) return null;
	const solver = new PixelsSolver(p);
	const steps = Array.from({ length: lineCount(p) }, (_, l) => lineSteps(solver, known, l));
	for (const { technique, value } of ORDER) {
		let best = -1;
		let most = 0;
		steps.forEach((step, l) => {
			const n = step?.cells.get(`${technique}:${value}`)?.length ?? 0;
			if (n > most) [best, most] = [l, n];
		});
		if (best < 0) continue;
		const step = steps[best]!;
		const blocks = [...step.blocks];
		return {
			kind: 'step',
			technique,
			line: best,
			cells: step.cells.get(`${technique}:${value}`)!,
			value,
			...(technique === 'overlap' && blocks.length === 1
				? { block: clueOf(p, best)[blocks[0]] }
				: {})
		};
	}
	// The probe finds nothing only where more than one picture fits, or none does.
	return (
		(solution && assumption(solver, known)) || { kind: 'stuck', cells: [known.indexOf(UNKNOWN)] }
	);
}
