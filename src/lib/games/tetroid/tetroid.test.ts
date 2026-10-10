import { describe, expect, it } from 'vitest';
import { generateTetroid } from './generator';
import {
	analyze,
	applyAutoCrosses,
	CROSS,
	EMPTY,
	isSolvedMarks,
	SHADED,
	type TetroidPuzzle
} from './rules';
import { classify, SHAPES } from './shapes';
import { solveTetroid, TetroidSolver } from './solver';

// Worked example of the spec (section 2).
const REGIONS = ['AAABBB', 'ACCDBB', 'ACDDBE', 'ACDDBE', 'ACDBBE', 'ACDDDE'];
const SOLUTION = ['LL.LLL', 'L..T.L', 'LITT.I', '.I.T.I', '.I...I', '.I...I'];
const example: TetroidPuzzle = {
	width: 6,
	height: 6,
	regions: REGIONS.join('')
		.split('')
		.map((ch) => ch.charCodeAt(0) - 65)
};
const solved = SOLUTION.join('')
	.split('')
	.map((ch) => (ch === '.' ? EMPTY : SHADED));
const cell = (r: number, c: number) => r * 6 + c;
const marksWith = (cells: number[], mark = SHADED) => {
	const marks = new Array(36).fill(EMPTY);
	for (const i of cells) marks[i] = mark;
	return marks;
};

describe('shapes', () => {
	it('has the 18 fixed placements of L, I, T and S', () => {
		expect(SHAPES).toHaveLength(18);
		const count = (t: string) => SHAPES.filter((s) => s.type === t).length;
		expect([count('I'), count('L'), count('T'), count('S')]).toEqual([2, 8, 4, 4]);
	});

	it('classifies shapes and rejects O and disconnected cells', () => {
		expect(classify([0, 6, 12, 13], 6)).toBe('L');
		expect(classify([0, 1, 2, 3], 6)).toBe('I');
		expect(classify([1, 2, 6, 7], 6)).toBe('S');
		expect(classify([0, 1, 6, 7], 6)).toBeNull();
		expect(classify([0, 2, 4, 6], 6)).toBeNull();
	});
});

describe('rules', () => {
	it('accepts the example solution, crosses on other cells included', () => {
		expect(isSolvedMarks(example, (i) => solved[i] === SHADED)).toBe(true);
		const withCrosses = solved.map((m) => (m === EMPTY ? CROSS : m));
		expect(isSolvedMarks(example, (i) => withCrosses[i] === SHADED)).toBe(true);
	});

	it('shows no errors on a fresh board', () => {
		expect(analyze(example, new Array(36).fill(EMPTY)).errors.some(Boolean)).toBe(false);
	});

	it('marks a region with five shaded cells', () => {
		const a = [0, 1, 2, 6, 12].map((i) => i);
		const { errors } = analyze(example, marksWith(a));
		expect(a.every((i) => errors[i])).toBe(true);
	});

	it('marks a region that cannot reach four shaded cells', () => {
		const marks = marksWith([cell(2, 5), cell(3, 5), cell(4, 5)]);
		marks[cell(5, 5)] = CROSS;
		const { errors } = analyze(example, marks);
		expect([2, 3, 4, 5].every((r) => errors[cell(r, 5)])).toBe(true);
	});

	it('marks a shaded 2×2 square', () => {
		const sq = [cell(2, 2), cell(2, 3), cell(3, 2), cell(3, 3)];
		const { errors } = analyze(example, marksWith(sq));
		expect(sq.every((i) => errors[i])).toBe(true);
	});

	it('marks touching equal tetrominoes and colours complete regions', () => {
		// C as an I in column 1, E as an I in column 5 do not touch; put an I into D touching C.
		const cIs = [1, 2, 3, 4].map((r) => cell(r + 1, 1));
		const dIs = [2, 3, 4, 5].map((r) => cell(r, 2));
		const a = analyze(example, marksWith([...cIs, ...dIs]));
		expect(a.regionType[2]).toBe('I');
		expect(a.regionType[3]).toBe('I');
		expect([...cIs, ...dIs].every((i) => a.errors[i])).toBe(true);
	});

	it('marks a group fenced off by crosses', () => {
		const marks = marksWith([cell(0, 0), cell(5, 5), cell(4, 5)]);
		for (const i of [cell(0, 1), cell(1, 0)]) marks[i] = CROSS;
		const { errors } = analyze(example, marks);
		expect(errors[cell(0, 0)]).toBe(true);
		expect(errors[cell(5, 5)]).toBe(false);
	});

	it('places and removes auto crosses on 2×2 corners, keeping player crosses', () => {
		const marks = marksWith([cell(0, 3), cell(0, 4), cell(1, 3)]);
		marks[cell(5, 0)] = CROSS;
		const s1 = applyAutoCrosses(example, { marks, auto: new Array(36).fill(0) }, true, false);
		expect(s1.marks[cell(1, 4)]).toBe(CROSS);
		expect(s1.auto[cell(1, 4)]).toBe(1);
		const m2 = s1.marks.slice();
		m2[cell(0, 3)] = EMPTY;
		const s2 = applyAutoCrosses(example, { marks: m2, auto: s1.auto }, true, false);
		expect(s2.marks[cell(1, 4)]).toBe(EMPTY);
		expect(s2.marks[cell(5, 0)]).toBe(CROSS);
	});

	it('crosses the rest of a completed region', () => {
		const e = [2, 3, 4, 5].map((r) => cell(r, 5));
		const s = applyAutoCrosses(
			example,
			{ marks: marksWith(e), auto: new Array(36).fill(0) },
			false,
			true
		);
		expect(s.marks.filter((m) => m === CROSS)).toHaveLength(0); // E has exactly four cells
		const c = [1, 2, 3, 4].map((r) => cell(r + 1, 1));
		const s2 = applyAutoCrosses(
			example,
			{ marks: marksWith(c), auto: new Array(36).fill(0) },
			false,
			true
		);
		expect(s2.marks[cell(1, 1)]).toBe(CROSS);
		expect(s2.marks[cell(1, 2)]).toBe(CROSS);
		expect(s2.auto[cell(1, 2)]).toBe(1);
	});
});

describe('solver', () => {
	it('finds exactly the example solution', () => {
		const res = solveTetroid(example, { limit: 2 });
		expect(res.solutions).toHaveLength(1);
		expect(Array.from(res.solutions[0])).toEqual(solved);
	});

	it('tells what propagation leaves, or null on a contradiction', () => {
		const dom = new TetroidSolver(example).propagated()!;
		expect(Array.from(dom.size)).toEqual([1, 1, 1, 1, 1]);
		expect(dom.alive.reduce((a, b) => a + b, 0)).toBe(5);
		// A region of three cells holds no tetromino.
		expect(new TetroidSolver({ width: 3, height: 1, regions: [0, 0, 0] }).propagated()).toBeNull();
	});
});

describe('generator', () => {
	it.each([
		[6, 'normal'],
		[6, 'hard'],
		[8, 'normal'],
		[10, 'hard']
	] as const)('generates unique %ix%i %s puzzles deterministically', (size, difficulty) => {
		for (const seed of [11, 12]) {
			const a = generateTetroid(size, size, difficulty, seed);
			const b = generateTetroid(size, size, difficulty, seed);
			expect(a.puzzle).toEqual(b.puzzle);
			const res = solveTetroid(a.puzzle, { limit: 2 });
			expect(res.finished).toBe(true);
			expect(res.solutions).toHaveLength(1);
			expect(Array.from(res.solutions[0])).toEqual(a.solution);
			const counts = new Map<number, number>();
			a.puzzle.regions.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
			expect([...counts.values()].every((c) => c >= 4)).toBe(true);
		}
	});

	// Normal puzzles must be solvable by deduction alone, hard ones must not be.
	it.each([
		[6, 'normal'],
		[6, 'hard'],
		[8, 'normal'],
		[8, 'hard'],
		[10, 'normal']
	] as const)(
		'makes %ix%i %s puzzles of their difficulty',
		(size, difficulty) => {
			for (let seed = 1; seed <= 6; seed++) {
				const { puzzle } = generateTetroid(size, size, difficulty, seed);
				const logic = solveTetroid(puzzle, { branch: false });
				expect(logic.solutions.length === 1, `seed ${seed}`).toBe(difficulty === 'normal');
			}
		},
		30_000
	);
});

describe('tutorial', () => {
	it('has a unique solution that matches the given start', async () => {
		const { TETROID_TUTORIAL, tetroidTutorialStart } = await import('./tutorial');
		const res = solveTetroid(TETROID_TUTORIAL, { limit: 2 });
		expect(res.solutions).toHaveLength(1);
		const start = tetroidTutorialStart(TETROID_TUTORIAL);
		start.marks.forEach((m, i) => {
			if (m === SHADED) expect(res.solutions[0][i]).toBe(1);
			if (m === CROSS) expect(res.solutions[0][i]).toBe(0);
		});
	});

	it('walks through every task with "Show me", and the tasks fit the solution', async () => {
		const {
			TETROID_TUTORIAL: p,
			TETROID_TUTORIAL_STEPS: steps,
			tetroidTutorialStart
		} = await import('./tutorial');
		const solution = solveTetroid(p, { limit: 2 }).solutions[0];
		let s = tetroidTutorialStart(p);
		for (const step of steps) {
			if (!step.done) continue;
			expect(step.done(p, s)).toBe(false);
			s = step.show!(p, s);
			expect(step.done(p, s)).toBe(true);
		}
		s.marks.forEach((m, i) => {
			if (m === SHADED) expect(solution[i]).toBe(1);
			if (m === CROSS) expect(solution[i]).toBe(0);
		});
		expect(isSolvedMarks(p, (i) => s.marks[i] === SHADED)).toBe(false);
	});

	it('teaches the connectivity look-ahead in steps 4 and 5 (#99)', async () => {
		const {
			TETROID_TUTORIAL: p,
			TETROID_TUTORIAL_STEPS: steps,
			tetroidTutorialStart
		} = await import('./tutorial');
		const { tetroidHint } = await import('./hint');
		// From the start of the step, follow the hints until the task's cell is decided.
		for (const [step, cell] of [
			[4, 9],
			[5, 23]
		]) {
			let s = tetroidTutorialStart(p);
			for (const before of steps.slice(0, step - 1)) if (before.show) s = before.show(p, s);
			let technique: string | undefined;
			while (!technique) {
				const h = tetroidHint(p, s);
				if (h?.kind !== 'step') throw new Error(`step ${step}: no hint`);
				if (h.cells.includes(cell)) technique = h.technique;
				const marks = s.marks.slice();
				for (const c of h.cells) marks[c] = h.mark === 'shade' ? SHADED : CROSS;
				s = { ...s, marks };
			}
			expect(technique, `step ${step}`).toBe('lookAhead');
		}
	});

	it('has a text for every step and a task for every step with a check', async () => {
		const { TETROID_TUTORIAL_STEPS: steps } = await import('./tutorial');
		const { default: en } = await import('../../i18n/en');
		const { default: de } = await import('../../i18n/de');
		for (const texts of [en.games.tetroid.tutorial, de.games.tetroid.tutorial]) {
			expect(texts).toHaveLength(steps.length);
			steps.forEach((step, n) => {
				const text = texts[n] as { text: string; task?: string; done?: string };
				expect(text.text, `step ${n + 1}`).toBeTruthy();
				if (step.done) expect(text.task && text.done, `step ${n + 1}`).toBeTruthy();
			});
			expect((texts.at(-1) as { task?: string }).task).toBeTruthy();
		}
	});
});
