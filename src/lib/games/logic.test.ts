import { describe, expect, it } from 'vitest';
import { neighbours } from '../core/grid';
import { regularCounterpart, type Variant } from '../core/variants';
import { pinwheelLogic, PINWHEEL_VARIANTS } from './pinwheel/logic';
import { generatePinwheel } from './pinwheel/generator';
import {
	analyze,
	CROSS as PCROSS,
	emptyPinwheelState,
	frozenEdges,
	linesFromAssignment,
	type PinwheelPuzzle
} from './pinwheel/rules';
import { tetroidLogic, TETROID_VARIANTS } from './tetroid/logic';
import { generateTetroid } from './tetroid/generator';
import { CROSS, EMPTY, SHADED, type TetroidPuzzle, type TetroidState } from './tetroid/rules';
import { GAME_LOGIC } from './logic';

const variant = (variants: Variant[], key: string) => variants.find((v) => v.key === key)!;

describe('variant lists', () => {
	it.each(Object.values(GAME_LOGIC).map((logic) => [logic.id, logic.variants] as const))(
		'%s has unique keys, fits the puzzle ID slots and has one of each special',
		(_, variants) => {
			expect(new Set(variants.map((v) => v.key)).size).toBe(variants.length);
			expect(variants.length).toBeLessThanOrEqual(16);
			for (const kind of ['daily', 'weekly', 'monthly']) {
				expect(variants.filter((v) => v.special === kind)).toHaveLength(1);
			}
			for (const v of variants) expect(v.width * v.height).toBeGreaterThan(0);
		}
	);

	// A puzzle ID holds the variant's position in its list. Moving or inserting a variant changes
	// the meaning of every ID (saves, links, leaderboards, the puzzle collection): only append.
	it('keeps every variant at its position', () => {
		const order = Object.fromEntries(
			Object.values(GAME_LOGIC).map((logic) => [logic.id, logic.variants.map((v) => v.key)])
		);
		expect(order).toEqual({
			tetroid: [
				...['6n', '6h', '8n', '8h', '10n', '10h', '15n', '15h', '20n', '20h'],
				...['daily', 'weekly', 'monthly']
			],
			pinwheel: [
				...['5n', '5h', '7n', '7h', '10n', '10h', '15n', '15h'],
				...['daily', 'weekly', 'monthly']
			],
			sudoku: [
				...['9e', '9n', '9h', 'daily', 'weekly', 'monthly'],
				...['c5e', 'c5n', 'c5h', 'c7e', 'c7n', 'c7h', 'c9e', 'c9n', 'c9h']
			]
		});
	});

	// "New puzzle" on a special type continues with this regular one.
	it('pairs every special with the regular type nearest in difficulty and size', () => {
		const pairs = Object.fromEntries(
			Object.values(GAME_LOGIC).map((logic) => [
				logic.id,
				logic.variants
					.filter((v) => v.special)
					.map((v) => regularCounterpart(logic.variants, v)?.key)
			])
		);
		expect(pairs).toEqual({
			tetroid: ['10n', '15h', '20h'],
			pinwheel: ['10h', '15h', '15h'],
			sudoku: ['9n', '9h', '9h']
		});
	});
});

describe('tetroid logic', () => {
	const v = variant(TETROID_VARIANTS, '6n');
	const { puzzle, solution } = generateTetroid(6, 6, 'normal', 77);
	const solvedState = (): TetroidState => ({
		marks: solution.map((x) => (String(x) === '1' ? SHADED : EMPTY)),
		auto: new Array(36).fill(0)
	});

	it('generates the same puzzle as the generator for a seed', () => {
		expect(tetroidLogic.generate(v, 77)).toEqual(puzzle);
	});

	it('counts exactly one solution for a generated puzzle', () => {
		expect(tetroidLogic.countSolutions(puzzle, 2)).toEqual({ count: 1, finished: true });
	});

	it('accepts generated puzzles and rejects malformed ones', () => {
		expect(tetroidLogic.isValidPuzzle(puzzle, v)).toBe(true);
		const bad: unknown[] = [
			null,
			'puzzle',
			{ ...puzzle, width: 7 },
			{ ...puzzle, regions: puzzle.regions.slice(1) },
			{ ...puzzle, regions: 'x'.repeat(36) },
			{ ...puzzle, regions: puzzle.regions.map((r, i) => (i === 0 ? -1 : r)) },
			{ ...puzzle, regions: puzzle.regions.map((r, i) => (i === 0 ? 1.5 : r)) }
		];
		for (const p of bad) expect(tetroidLogic.isValidPuzzle(p, v)).toBe(false);
	});

	it('rejects regions that are too small or split in two', () => {
		// Region 1 is a single cell.
		const tiny: TetroidPuzzle = { width: 6, height: 6, regions: new Array(36).fill(0) };
		tiny.regions[35] = 1;
		expect(tetroidLogic.isValidPuzzle(tiny, v)).toBe(false);
		// Region 1 is the top and bottom row, which do not touch.
		const split: TetroidPuzzle = {
			width: 6,
			height: 6,
			regions: Array.from({ length: 36 }, (_, i) => (i < 6 || i >= 30 ? 1 : 0))
		};
		expect(tetroidLogic.isValidPuzzle(split, v)).toBe(false);
	});

	it('verifies the solution as an answer and rejects others', () => {
		const answer = tetroidLogic.answer(puzzle, solvedState());
		expect(answer).toBe(solution.join(''));
		expect(tetroidLogic.isSolved(puzzle, solvedState())).toBe(true);
		expect(tetroidLogic.verifyAnswer(puzzle, answer)).toBe(true);
		expect(tetroidLogic.verifyAnswer(puzzle, '0'.repeat(36))).toBe(false);
		expect(tetroidLogic.verifyAnswer(puzzle, answer.slice(1))).toBe(false);
		expect(tetroidLogic.verifyAnswer(puzzle, answer.replace(/1/, '2'))).toBe(false);
	});

	it('round-trips encoded states and drops auto marks', () => {
		const s = tetroidLogic.emptyState(puzzle);
		s.marks[0] = SHADED;
		s.marks[1] = CROSS;
		s.auto[2] = 1;
		const decoded = tetroidLogic.decodeState(puzzle, tetroidLogic.encodeState(s));
		expect(decoded).toEqual({ marks: s.marks, auto: new Array(36).fill(0) });
		expect(tetroidLogic.isValidState(puzzle, decoded)).toBe(true);
	});

	it('rejects corrupt saved states', () => {
		expect(tetroidLogic.decodeState(puzzle, '!!!')).toBeNull();
		const tooHigh = { marks: new Array(36).fill(CROSS + 1), auto: [] };
		expect(tetroidLogic.decodeState(puzzle, tetroidLogic.encodeState(tooHigh))).toBeNull();
		expect(tetroidLogic.isValidState(puzzle, null)).toBe(false);
		expect(tetroidLogic.isValidState(puzzle, { marks: [], auto: [] })).toBe(false);
		const s = tetroidLogic.emptyState(puzzle);
		expect(tetroidLogic.isValidState(puzzle, { ...s, auto: s.auto.map(() => 2) })).toBe(false);
	});

	it('adds auto crosses only when the settings ask for them, and takes them back', () => {
		const s = solvedState();
		const off = tetroidLogic.afterMove!(puzzle, s, {});
		expect(off.marks.filter((m) => m === CROSS)).toHaveLength(0);
		// Every region holds its tetromino, so all other cells get crossed.
		const on = tetroidLogic.afterMove!(puzzle, s, { autoCrossRegions: true });
		expect(on.marks.every((m) => m !== EMPTY)).toBe(true);
		expect(on.auto.filter((x) => x === 1)).toHaveLength(36 - 4 * (Math.max(...puzzle.regions) + 1));
		// Unshading every cell removes the automatic crosses again.
		const cleared = tetroidLogic.afterMove!(
			puzzle,
			{ marks: on.marks.map((m) => (m === SHADED ? EMPTY : m)), auto: on.auto },
			{ autoCrossRegions: true }
		);
		expect(cleared.marks.every((m) => m === EMPTY)).toBe(true);
	});
});

describe('pinwheel logic', () => {
	const v = variant(PINWHEEL_VARIANTS, '5n');
	const { puzzle, solution } = generatePinwheel(5, 5, 'normal', 31);
	const solvedState = () => linesFromAssignment(puzzle, solution);

	it('generates the same puzzle as the generator for a seed', () => {
		expect(pinwheelLogic.generate(v, 31)).toEqual(puzzle);
	});

	it('counts exactly one solution for a generated puzzle', () => {
		expect(pinwheelLogic.countSolutions(puzzle, 2)).toEqual({ count: 1, finished: true });
	});

	it('accepts generated puzzles and rejects malformed ones', () => {
		expect(pinwheelLogic.isValidPuzzle(puzzle, v)).toBe(true);
		const c = puzzle.centres;
		const bad: unknown[] = [
			null,
			7,
			{ ...puzzle, height: 6 },
			{ ...puzzle, centres: 'none' },
			{ ...puzzle, centres: [] },
			{ ...puzzle, centres: [[0, 0, 0]] },
			{ ...puzzle, centres: [[0.5, 0]] },
			{ ...puzzle, centres: [[-1, 0]] },
			{ ...puzzle, centres: [[0, 9]] },
			// Two centres on the same cell.
			{ ...puzzle, centres: [...c, c[0]] }
		];
		for (const p of bad) expect(pinwheelLogic.isValidPuzzle(p, v)).toBe(false);
	});

	it('verifies the solution as an answer and rejects others', () => {
		const answer = pinwheelLogic.answer(puzzle, solvedState());
		expect(pinwheelLogic.isSolved(puzzle, solvedState())).toBe(true);
		expect(pinwheelLogic.verifyAnswer(puzzle, answer)).toBe(true);
		expect(pinwheelLogic.verifyAnswer(puzzle, '0'.repeat(answer.length))).toBe(false);
		expect(pinwheelLogic.verifyAnswer(puzzle, answer + '0')).toBe(false);
		expect(pinwheelLogic.verifyAnswer(puzzle, 'x'.repeat(answer.length))).toBe(false);
	});

	it('round-trips encoded states', () => {
		const s = solvedState();
		s.colors[0] = 9;
		s.locks[0] = 1;
		s.h[0] = PCROSS;
		const decoded = pinwheelLogic.decodeState(puzzle, pinwheelLogic.encodeState(s));
		expect(decoded).toEqual(s);
	});

	it('rejects corrupt saved states', () => {
		expect(pinwheelLogic.decodeState(puzzle, 'only.three.parts')).toBeNull();
		expect(pinwheelLogic.decodeState(puzzle, '!.!.!.!')).toBeNull();
		const s = emptyPinwheelState(puzzle);
		s.locks[0] = 2;
		expect(pinwheelLogic.decodeState(puzzle, pinwheelLogic.encodeState(s))).toBeNull();
		expect(pinwheelLogic.isValidState(puzzle, undefined)).toBe(false);
		expect(pinwheelLogic.isValidState(puzzle, { ...emptyPinwheelState(puzzle), h: [] })).toBe(
			false
		);
	});

	it('accepts a board coloured by galaxy only when auto submit is on', () => {
		// Greedy colouring: neighbouring galaxies get different colours (1..9).
		const colourOf = new Map<number, number>();
		for (let k = 0; k < puzzle.centres.length; k++) {
			const taken = new Set<number>();
			solution.forEach((g, i) => {
				if (g !== k) return;
				for (const j of neighbours(i, puzzle.width, puzzle.height)) {
					const c = colourOf.get(solution[j]);
					if (c) taken.add(c);
				}
			});
			let c = 1;
			while (taken.has(c)) c++;
			colourOf.set(k, c);
		}
		const s = emptyPinwheelState(puzzle);
		s.colors = solution.map((k) => colourOf.get(k)!);
		expect(Math.max(...s.colors)).toBeLessThanOrEqual(9);
		expect(pinwheelLogic.acceptAlternative!(puzzle, s, { autoSubmit: false })).toBeNull();
		const accepted = pinwheelLogic.acceptAlternative!(puzzle, s, { autoSubmit: true });
		expect(accepted && pinwheelLogic.isSolved(puzzle, accepted)).toBe(true);
		// An uncoloured board adds no lines, so it is not accepted.
		expect(
			pinwheelLogic.acceptAlternative!(puzzle, emptyPinwheelState(puzzle), { autoSubmit: true })
		).toBeNull();
	});

	it('freezes every edge around the region of a locked centre', () => {
		const example: PinwheelPuzzle = { width: 2, height: 1, centres: [[0, 1]] };
		const s = linesFromAssignment(example, [0, 0]);
		expect(frozenEdges(example, s, analyze(example, s)).size).toBe(0);
		s.locks[0] = 1;
		expect([...frozenEdges(example, s, analyze(example, s))].sort()).toEqual(
			['h:0:0', 'h:1:0', 'v:0:0', 'v:0:1', 'h:0:1', 'h:1:1', 'v:0:2'].sort()
		);
	});
});
