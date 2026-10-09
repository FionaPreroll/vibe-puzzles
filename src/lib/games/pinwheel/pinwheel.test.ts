import { describe, expect, it } from 'vitest';
import { generatePinwheel } from './generator';
import {
	acceptByColours,
	analyze,
	emptyPinwheelState,
	hIndex,
	innerDots,
	isBlocked,
	isSolvedState,
	LINE,
	linesFromAssignment,
	vIndex,
	type PinwheelPuzzle
} from './rules';
import { solvePinwheel } from './solver';

// Worked example of the spec (section 2).
const example: PinwheelPuzzle = {
	width: 5,
	height: 5,
	centres: [
		[0, 0],
		[1, 6],
		[1, 8],
		[2, 4],
		[5, 2],
		[6, 7],
		[7, 0],
		[8, 8]
	]
};
const SOLUTION = 'ADDBC EEDBC EEDDF GEEFF GEEFH'.replace(/ /g, '');
const owner = SOLUTION.split('').map((ch) => ch.charCodeAt(0) - 65);

describe('rules', () => {
	it('accepts the solution lines', () => {
		expect(isSolvedState(example, linesFromAssignment(example, owner))).toBe(true);
	});

	it('finds the dots inside galaxies that no line touches', () => {
		const solved = linesFromAssignment(example, owner);
		// Dot (row 2, col 1) and dot (row 4, col 2) lie inside galaxy E.
		expect([...innerDots(example, solved, analyze(example, solved))].sort()).toEqual([13, 26]);
		// A stray line ending at a dot keeps it.
		const stray = { ...solved, h: solved.h.slice() };
		stray.h[hIndex(example, 2, 0)] = LINE;
		expect([...innerDots(example, stray, analyze(example, stray))]).toEqual([26]);
	});

	it('shows no errors on a fresh board', () => {
		const a = analyze(example, emptyPinwheelState(example));
		expect(a.centreError.some(Boolean) || a.cellError.some(Boolean)).toBe(false);
	});

	it('marks a cell enclosed without a centre', () => {
		const s = emptyPinwheelState(example);
		// Enclose cell (2,2): edges h(2,2), h(3,2), v(2,2), v(2,3).
		s.h[hIndex(example, 2, 2)] = LINE;
		s.h[hIndex(example, 3, 2)] = LINE;
		s.v[vIndex(example, 2, 2)] = LINE;
		s.v[vIndex(example, 2, 3)] = LINE;
		expect(analyze(example, s).cellError[12]).toBe(true);
	});

	it('marks the centre of an asymmetric region and of a region with a dangling line', () => {
		const s = emptyPinwheelState(example);
		// Cut cells (0,0),(0,1) off: A gets two cells, asymmetric around cell (0,0).
		s.h[hIndex(example, 1, 0)] = LINE;
		s.h[hIndex(example, 1, 1)] = LINE;
		s.v[vIndex(example, 0, 2)] = LINE;
		expect(analyze(example, s).centreError[0]).toBe(true);

		const t = linesFromAssignment(example, owner);
		t.h[hIndex(example, 4, 1)] = LINE; // inside E
		const a = analyze(example, t);
		expect(a.centreError[4]).toBe(true);
	});

	it('blocks edges touching a centre', () => {
		// B sits on the midpoint of h(1,3): only that edge is blocked.
		expect(isBlocked(example, 'h', 1, 3)).toBe(true);
		expect(isBlocked(example, 'v', 0, 3)).toBe(false);
		expect(isBlocked(example, 'h', 2, 0)).toBe(false);
		// A centre on dot (1,1) blocks the four edges meeting there.
		const dot: PinwheelPuzzle = { width: 3, height: 3, centres: [[1, 1]] };
		expect(isBlocked(dot, 'h', 1, 0)).toBe(true);
		expect(isBlocked(dot, 'h', 1, 1)).toBe(true);
		expect(isBlocked(dot, 'v', 0, 1)).toBe(true);
		expect(isBlocked(dot, 'v', 1, 1)).toBe(true);
		expect(isBlocked(dot, 'v', 1, 2)).toBe(false);
	});

	it('accepts a solution given by colours', () => {
		const s = emptyPinwheelState(example);
		const colours = [1, 2, 3, 4, 5, 1, 2, 3];
		s.colors = owner.map((k) => colours[k]);
		const accepted = acceptByColours(example, s);
		expect(accepted).not.toBeNull();
		expect(isSolvedState(example, accepted!)).toBe(true);
	});
});

describe('solver', () => {
	it('finds exactly the example solution', () => {
		const res = solvePinwheel(example, { limit: 2 });
		expect(res.solutions).toHaveLength(1);
		expect(Array.from(res.solutions[0])).toEqual(owner);
	});
});

describe('generator', () => {
	it.each([
		[5, 'normal'],
		[7, 'hard'],
		[10, 'normal'],
		[15, 'hard']
	] as const)('generates unique %ix%i %s puzzles deterministically', (size, difficulty) => {
		for (const seed of [3, 4]) {
			const a = generatePinwheel(size, size, difficulty, seed);
			expect(generatePinwheel(size, size, difficulty, seed).puzzle).toEqual(a.puzzle);
			const res = solvePinwheel(a.puzzle, { limit: 2 });
			expect(res.solutions).toHaveLength(1);
			expect(Array.from(res.solutions[0])).toEqual(a.solution);
			expect(isSolvedState(a.puzzle, linesFromAssignment(a.puzzle, a.solution))).toBe(true);
		}
	});
});

describe('tutorial', () => {
	it('has a unique solution, found without guessing', async () => {
		const { PINWHEEL_TUTORIAL, PINWHEEL_TUTORIAL_SOLUTION } = await import('./tutorial');
		const res = solvePinwheel(PINWHEEL_TUTORIAL, { limit: 2 });
		expect(res.solutions).toHaveLength(1);
		expect(Array.from(res.solutions[0])).toEqual(PINWHEEL_TUTORIAL_SOLUTION);
	});

	it('walks through every task with "Show me" to the solved board', async () => {
		const { PINWHEEL_TUTORIAL: p, PINWHEEL_TUTORIAL_STEPS: steps } = await import('./tutorial');
		let s = emptyPinwheelState(p);
		for (const step of steps) {
			if (!step.done) continue;
			expect(step.done(p, s)).toBe(false);
			s = step.show!(p, s);
			expect(step.done(p, s)).toBe(true);
		}
		// Earlier tasks stay done.
		for (const step of steps) if (step.done) expect(step.done(p, s)).toBe(true);
		expect(isSolvedState(p, s)).toBe(false);
	});

	it('only accepts the region of the solution, not any symmetric one', async () => {
		const { PINWHEEL_TUTORIAL: p, regionDone, showRegion } = await import('./tutorial');
		// The zigzag's circle sits between cells (1,2) and (2,2): those two alone are symmetric too.
		const s = emptyPinwheelState(p);
		for (const [i, j] of [
			[1, 2],
			[3, 2]
		])
			s.h[hIndex(p, i, j)] = LINE;
		for (const [i, j] of [
			[1, 2],
			[1, 3],
			[2, 2],
			[2, 3]
		])
			s.v[vIndex(p, i, j)] = LINE;
		const a = analyze(p, s);
		expect(a.complete[a.centreRegion[3]]).toBe(true);
		expect(regionDone(p, s, 3)).toBe(false);
		// "Show me" repairs it, clearing the line inside the zigzag.
		expect(regionDone(p, showRegion(p, s, 3), 3)).toBe(true);
	});

	it('has a text for every step and a task for every step with a check', async () => {
		const { PINWHEEL_TUTORIAL_STEPS: steps } = await import('./tutorial');
		const { default: en } = await import('../../i18n/en');
		const { default: de } = await import('../../i18n/de');
		for (const texts of [en.games.pinwheel.tutorial, de.games.pinwheel.tutorial]) {
			expect(texts).toHaveLength(steps.length);
			steps.forEach((step, n) => {
				const text = texts[n] as { text: string; task?: string; done?: string };
				expect(text.text, `step ${n + 1}`).toBeTruthy();
				if (step.done) expect(text.task && text.done, `step ${n + 1}`).toBeTruthy();
			});
			// The last step is a task too: solving the board ends the tutorial.
			expect((texts.at(-1) as { task?: string }).task).toBeTruthy();
		}
	});
});
