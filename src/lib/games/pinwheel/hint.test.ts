import { describe, expect, it } from 'vitest';
import de from '../../i18n/de';
import en from '../../i18n/en';
import { generatePinwheel } from './generator';
import { pinwheelHint, TECHNIQUES, type PinwheelHint } from './hint';
import { pinwheel } from './index';
import {
	CROSS,
	emptyPinwheelState,
	hIndex,
	LINE,
	linesFromAssignment,
	vIndex,
	type EdgeRef,
	type PinwheelPuzzle,
	type PinwheelState
} from './rules';
import { solvePinwheel } from './solver';

// Worked example of the spec (section 2), as in pinwheel.test.ts.
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
const owner = 'ADDBC EEDBC EEDDF GEEFF GEEFH'
	.replace(/ /g, '')
	.split('')
	.map((ch) => ch.charCodeAt(0) - 65);

/** The two cells on either side of an edge. */
function sides(p: PinwheelPuzzle, e: EdgeRef): [number, number] {
	const w = p.width;
	return e.kind === 'h' ? [(e.i - 1) * w + e.j, e.i * w + e.j] : [e.i * w + e.j - 1, e.i * w + e.j];
}

function mark(p: PinwheelPuzzle, s: PinwheelState, e: EdgeRef, value: number) {
	if (e.kind === 'h') s.h[hIndex(p, e.i, e.j)] = value;
	else s.v[vIndex(p, e.i, e.j)] = value;
}

/** Follows hints, marking their edges, until there is none or one that is no step. */
function follow(p: PinwheelPuzzle, state: PinwheelState, check: (h: PinwheelHint) => void) {
	for (;;) {
		const hint = pinwheelHint(p, state);
		if (!hint || hint.kind !== 'step') return hint;
		check(hint);
		for (const e of hint.edges) mark(p, state, e, hint.mark === 'line' ? LINE : CROSS);
	}
}

describe('pinwheel hints', () => {
	it('lead from the empty board to the solution, every edge right', () => {
		const techniques = new Set<string>();
		const puzzles = [
			{ puzzle: example, solution: owner },
			...[
				[7, 2],
				[10, 1]
			].map(([size, seed]) => {
				const { puzzle } = generatePinwheel(size, size, 'normal', seed);
				return { puzzle, solution: Array.from(solvePinwheel(puzzle).solutions[0]) };
			})
		];
		for (const { puzzle, solution } of puzzles) {
			const last = follow(puzzle, emptyPinwheelState(puzzle), (h) => {
				if (h.kind !== 'step') return;
				techniques.add(h.technique);
				for (const e of h.edges) {
					const [a, b] = sides(puzzle, e);
					expect(solution[a] === solution[b]).toBe(h.mark === 'cross');
				}
			});
			expect(last).toBeNull();
		}
		expect([...techniques].sort()).toEqual([...TECHNIQUES].sort());
	});

	it('start with lines the centres alone decide', () => {
		expect(pinwheelHint(example, emptyPinwheelState(example))).toMatchObject({
			kind: 'step',
			technique: 'centre',
			mark: 'line'
		});
	});

	it('point at lines inside a galaxy and crosses between galaxies', () => {
		const state = emptyPinwheelState(example);
		mark(example, state, { kind: 'v', i: 0, j: 2 }, LINE); // D | D
		mark(example, state, { kind: 'v', i: 0, j: 1 }, CROSS); // A | D
		mark(example, state, { kind: 'h', i: 1, j: 0 }, LINE); // A | E, right
		expect(pinwheelHint(example, state)).toEqual({
			kind: 'mistake',
			edges: [
				{ kind: 'v', i: 0, j: 1 },
				{ kind: 'v', i: 0, j: 2 }
			]
		});
	});

	it('name the cell with the fewest options when hard puzzles need case analysis', () => {
		const { puzzle } = generatePinwheel(10, 10, 'hard', 1);
		const last = follow(puzzle, emptyPinwheelState(puzzle), () => {});
		expect(last?.kind).toBe('stuck');
		if (last?.kind === 'stuck') expect(last.cell).toBeGreaterThanOrEqual(0);
	});

	it('still help on a puzzle without a solution', () => {
		// The right cell has no mirror through the only centre.
		const broken: PinwheelPuzzle = { width: 2, height: 1, centres: [[0, 0]] };
		expect(pinwheelHint(broken, emptyPinwheelState(broken))).toEqual({
			kind: 'step',
			technique: 'centre',
			mark: 'line',
			edges: [{ kind: 'v', i: 0, j: 1 }]
		});
	});

	it('give nothing once the puzzle is solved', () => {
		expect(pinwheelHint(example, linesFromAssignment(example, owner))).toBeNull();
	});

	it('come with texts in every language', () => {
		const lookup = (dict: unknown, key: string) =>
			key.split('.').reduce((node, part) => (node as Record<string, unknown>)?.[part], dict);
		const { puzzle: hard } = generatePinwheel(10, 10, 'hard', 1);
		const stuck = emptyPinwheelState(hard);
		follow(hard, stuck, () => {});
		const wrong = emptyPinwheelState(example);
		mark(example, wrong, { kind: 'v', i: 0, j: 2 }, LINE);
		const hints = [
			pinwheel.hint!(example, emptyPinwheelState(example))!,
			pinwheel.hint!(example, wrong)!,
			pinwheel.hint!(hard, stuck)!
		];
		expect(hints.map((h) => h.kind)).toEqual(['step', 'mistake', 'stuck']);
		expect(hints[1].spotlight).toEqual(['v:0:2']);
		expect(hints[2].spotlight[0]).toMatch(/^c:\d+$/);
		const keys = [
			...hints.flatMap((h) => h.text),
			...[...TECHNIQUES, 'line', 'cross', 'stuck'].map((k) => `games.pinwheel.hints.${k}`)
		];
		for (const key of keys) {
			expect(typeof lookup(en, key), key).toBe('string');
			expect(typeof lookup(de, key), key).toBe('string');
		}
		expect(pinwheel.hint!(example, linesFromAssignment(example, owner))).toBeNull();
	});
});
