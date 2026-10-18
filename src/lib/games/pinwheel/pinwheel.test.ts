import { describe, expect, it } from 'vitest';
import { generatePinwheel } from './generator';
import {
	acceptByColours,
	analyze,
	coveredCells,
	emptyPinwheelState,
	hIndex,
	innerDots,
	isBlocked,
	isSolvedState,
	LINE,
	linesFromAssignment,
	mirrorCell,
	vIndex,
	type PinwheelPuzzle
} from './rules';
import { PinwheelSolver, solvePinwheel, type PinwheelTraceEvent } from './solver';

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

	// Normal puzzles must be solvable by propagation alone, hard ones must need case analysis,
	// also on small boards where such puzzles are rare.
	it.each([
		[5, 'normal'],
		[5, 'hard'],
		[7, 'hard'],
		[10, 'hard']
	] as const)(
		'makes %ix%i %s puzzles of their difficulty',
		(size, difficulty) => {
			for (let seed = 1; seed <= 6; seed++) {
				const { puzzle } = generatePinwheel(size, size, difficulty, seed);
				const logic = solvePinwheel(puzzle, { branch: false });
				expect(logic.solutions.length === 1, `seed ${seed}`).toBe(difficulty === 'normal');
			}
		},
		30_000
	);
});

describe('trace', () => {
	const record = () => {
		const events: PinwheelTraceEvent[] = [];
		return { events, trace: (e: PinwheelTraceEvent) => void events.push(e) };
	};
	const key = ([r, c]: [number, number]) => `${r},${c}`;

	it('changes no puzzle', () => {
		for (const [size, difficulty] of [
			[5, 'normal'],
			[7, 'hard'],
			[10, 'normal']
		] as const) {
			for (const seed of [1, 2, 35]) {
				const { trace } = record();
				expect(generatePinwheel(size, size, difficulty, seed, trace)).toEqual(
					generatePinwheel(size, size, difficulty, seed)
				);
			}
		}
	});

	it('replays the last attempt to the generated partition', () => {
		// 7×7 hard 35: the first attempt is too easy; the second needs a cut.
		const { events, trace } = record();
		const { puzzle, solution } = generatePinwheel(7, 7, 'hard', 35, trace);
		expect(events.filter((e) => e.kind === 'attempt')).toEqual([
			{ kind: 'attempt', n: 0 },
			{ kind: 'attempt', n: 1 }
		]);
		expect(events.filter((e) => e.kind === 'rated')).toEqual([
			{ kind: 'rated', easy: true },
			{ kind: 'rated', easy: false }
		]);
		const last = events.slice(events.map((e) => e.kind).lastIndexOf('attempt'));
		const owner = new Array<string | null>(49).fill(null);
		const order: string[] = [];
		const prune = () => order.splice(0, order.length, ...order.filter((k) => owner.includes(k)));
		for (const e of last) {
			if (e.kind === 'centre') {
				order.push(key(e.centre));
				for (const i of e.cells) owner[i] = key(e.centre);
				expect(e.cells).toEqual(coveredCells(puzzle, e.centre));
			} else if (e.kind === 'grow' || e.kind === 'absorb') {
				// Always a cell and its mirror image through the galaxy's centre.
				expect(mirrorCell(puzzle, e.cells[0], e.centre)).toBe(e.cells[1]);
				for (const i of e.cells) owner[i] = key(e.centre);
				prune();
			} else if (e.kind === 'second') {
				// The generator's galaxies, in its order, and a solution that differs somewhere.
				expect(e.centres.map(key)).toEqual(order);
				expect(e.owner.map((k) => order[k])).toEqual(owner);
				expect(e.other.some((k, i) => k !== e.owner[i])).toBe(true);
			} else if (e.kind === 'split') {
				expect(e.galaxies).toHaveLength(2);
				for (const g of e.galaxies) {
					order.push(key(g.centre));
					for (const i of g.cells) owner[i] = key(g.centre);
				}
			}
		}
		expect(last.filter((e) => e.kind === 'split')).toHaveLength(1);
		expect(last.at(-2)).toEqual({ kind: 'unique' });
		const centres = puzzle.centres.map(key);
		expect(owner).toEqual(solution.map((k) => centres[k]));
	});

	it('reports each round of propagation, settling more cells each time', () => {
		const { puzzle } = generatePinwheel(7, 7, 'hard', 35);
		const { events, trace } = record();
		const result = new PinwheelSolver(puzzle).solve({ branch: false, trace });
		expect(result.solutions).toHaveLength(0);
		const rounds = events.map((e) => (e.kind === 'round' ? e.owner : []));
		// At first, the cells under the centres.
		const covered = puzzle.centres.flatMap((c) => coveredCells(puzzle, c));
		expect(rounds[0].flatMap((k, i) => (k >= 0 ? [i] : [])).sort((a, b) => a - b)).toEqual(
			covered.sort((a, b) => a - b)
		);
		for (let n = 1; n < rounds.length; n++) {
			const before = rounds[n - 1].filter((k) => k >= 0).length;
			expect(rounds[n].filter((k) => k >= 0).length).toBeGreaterThan(before);
			// A settled cell stays settled.
			rounds[n - 1].forEach((k, i) => {
				if (k >= 0) expect(rounds[n][i]).toBe(k);
			});
		}
		// Hard: propagation leaves cells open. Normal: it settles them all.
		expect(rounds.at(-1)!.some((k) => k < 0)).toBe(true);
		const normal = generatePinwheel(7, 7, 'normal', 1);
		const solved = record();
		new PinwheelSolver(normal.puzzle).solve({ branch: false, trace: solved.trace });
		const end = solved.events.at(-1)!;
		expect(end.kind === 'round' && end.owner).toEqual(normal.solution);
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
