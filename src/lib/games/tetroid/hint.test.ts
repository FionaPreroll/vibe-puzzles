import { describe, expect, it } from 'vitest';
import de from '../../i18n/de';
import en from '../../i18n/en';
import { generateTetroid } from './generator';
import { TECHNIQUES, tetroidHint, type TetroidHint } from './hint';
import { tetroid } from './index';
import { CROSS, EMPTY, SHADED, type TetroidPuzzle, type TetroidState } from './rules';
import { solveTetroid } from './solver';

// Worked example of the spec (section 2), as in tetroid.test.ts.
const REGIONS = ['AAABBB', 'ACCDBB', 'ACDDBE', 'ACDDBE', 'ACDBBE', 'ACDDDE'];
const SOLUTION = ['LL.LLL', 'L..T.L', 'LITT.I', '.I.T.I', '.I...I', '.I...I'];
const example: TetroidPuzzle = {
	width: 6,
	height: 6,
	regions: REGIONS.join('')
		.split('')
		.map((ch) => ch.charCodeAt(0) - 65)
};
const solution = SOLUTION.join('')
	.split('')
	.map((ch) => (ch === '.' ? 0 : 1));

const empty = (p: TetroidPuzzle): TetroidState => ({
	marks: new Array(p.regions.length).fill(EMPTY),
	auto: new Array(p.regions.length).fill(0)
});

/** Follows hints from `state` until there is none or one that is not a step; returns the last. */
function follow(p: TetroidPuzzle, state: TetroidState, check: (h: TetroidHint) => void) {
	for (;;) {
		const hint = tetroidHint(p, state);
		if (!hint || hint.kind !== 'step') return hint;
		check(hint);
		for (const i of hint.cells) state.marks[i] = hint.mark === 'shade' ? SHADED : CROSS;
	}
}

describe('tetroid hints', () => {
	it('lead from the empty board to the solution, every step right', () => {
		const techniques = new Set<string>();
		const last = follow(example, empty(example), (h) => {
			if (h.kind !== 'step') return;
			techniques.add(h.technique);
			// The neighbouring regions a step rests on are other regions.
			for (const i of h.context) expect(example.regions[i]).not.toBe(h.region);
			if (h.technique === 'sameShape') expect(h.context.length).toBeGreaterThan(0);
			expect(h.cells.length).toBeGreaterThan(0);
			for (const i of h.cells) {
				expect(example.regions[i]).toBe(h.region);
				expect(solution[i]).toBe(h.mark === 'shade' ? 1 : 0);
			}
		});
		expect(last).toBeNull();
		expect([...techniques].sort()).toEqual(['region', 'sameShape', 'square']);
	});

	it('start with what the regions alone decide', () => {
		// Every tetromino in region C (a column of five plus one cell) covers its middle cells.
		expect(tetroidHint(example, empty(example))).toEqual({
			kind: 'step',
			technique: 'region',
			mark: 'shade',
			region: 2,
			cells: [13, 19],
			context: []
		});
	});

	it('point at wrong marks instead of a step', () => {
		const state = empty(example);
		state.marks[2] = SHADED; // empty in the solution
		state.marks[0] = SHADED; // right
		state.marks[13] = CROSS; // shaded in the solution
		expect(tetroidHint(example, state)).toEqual({ kind: 'mistake', cells: [2, 13] });
	});

	it('still give steps on a puzzle without a solution, with no mistakes to point at', () => {
		// Two I tetrominoes that would touch: no solution, but each region decides its cells.
		const broken: TetroidPuzzle = { width: 4, height: 2, regions: [0, 0, 0, 0, 1, 1, 1, 1] };
		expect(tetroidHint(broken, empty(broken))).toMatchObject({
			kind: 'step',
			mark: 'shade',
			cells: [0, 1, 2, 3]
		});
	});

	it('give nothing once the puzzle is solved', () => {
		const state = empty(example);
		state.marks = solution.map((s) => (s ? SHADED : EMPTY));
		expect(tetroidHint(example, state)).toBeNull();
	});

	it('solve normal puzzles by deduction alone', () => {
		for (const [size, seed] of [
			[6, 1],
			[6, 2],
			[8, 1],
			[10, 1],
			[10, 5]
		]) {
			const { puzzle } = generateTetroid(size, size, 'normal', seed);
			const answer = solveTetroid(puzzle).solutions[0];
			const last = follow(puzzle, empty(puzzle), (h) => {
				if (h.kind !== 'step') return;
				// Something to shade always follows, so no hint asks for crosses along the way.
				expect(h.mark).toBe('shade');
				for (const i of h.cells) expect(answer[i]).toBe(1);
			});
			expect(last, `${size}×${size} seed ${seed}`).toBeNull();
		}
	});

	it('shade before they cross, and leave out the rest of a region the player has shaded', () => {
		// Regions A and C shaded as in the solution, nothing crossed: their other cells stay empty,
		// but that tells nothing new, so the hint goes on with cells to shade elsewhere.
		const state = empty(example);
		example.regions.forEach((r, i) => {
			if ((r === 0 || r === 2) && solution[i]) state.marks[i] = SHADED;
		});
		const hint = tetroidHint(example, state);
		expect(hint).toMatchObject({ kind: 'step', mark: 'shade' });
		if (hint?.kind !== 'step') return;
		expect(hint.region).not.toBe(0);
		expect(hint.region).not.toBe(2);
	});

	it('lead through hard puzzles with assumptions that fail, and never cross for nothing', () => {
		const { puzzle } = generateTetroid(6, 6, 'hard', 1);
		const answer = solveTetroid(puzzle).solutions[0];
		const state = empty(puzzle);
		let assumptions = 0;
		const last = follow(puzzle, state, (h) => {
			if (h.kind !== 'step') return;
			for (const i of h.cells) expect(answer[i]).toBe(h.mark === 'shade' ? 1 : 0);
			if (h.technique === 'assumption') {
				assumptions++;
				// The tried placement is not the one of the solution, and lies in the region.
				expect(h.assumed!.every((i) => answer[i])).toBe(false);
				expect(h.assumed!.every((i) => puzzle.regions[i] === h.region)).toBe(true);
			}
			if (h.mark !== 'cross') return;
			// Crosses come only from a deduction, never just from the player's own shaded cells.
			const shadedThere = state.marks.some(
				(m, i) => m === SHADED && puzzle.regions[i] === h.region
			);
			expect(h.technique === 'region' && shadedThere).toBe(false);
		});
		expect(last).toBeNull();
		expect(assumptions).toBeGreaterThan(0);
	});

	it('name the region with the fewest options when not even an assumption helps', () => {
		// One region of 3×2 cells: several tetrominoes fit, none covers every cell or rules out
		// another, so case analysis would find two solutions.
		const open: TetroidPuzzle = { width: 3, height: 2, regions: [0, 0, 0, 0, 0, 0] };
		expect(tetroidHint(open, empty(open))).toEqual({
			kind: 'stuck',
			region: 0,
			cells: [0, 1, 2, 3, 4, 5]
		});
	});

	it('come with texts in every language', () => {
		const lookup = (dict: unknown, key: string) =>
			key.split('.').reduce((node, part) => (node as Record<string, unknown>)?.[part], dict);
		const open: TetroidPuzzle = { width: 3, height: 2, regions: [0, 0, 0, 0, 0, 0] };
		const wrong = empty(example);
		wrong.marks[2] = SHADED;
		const hints = [
			tetroid.hint!(example, empty(example)),
			tetroid.hint!(example, wrong),
			tetroid.hint!(open, empty(open))
		];
		expect(hints.map((h) => h?.kind)).toEqual(['step', 'mistake', 'stuck']);
		expect(hints[0]?.spotlight).toEqual(['13', '19']);
		// A step first tints its region and names the rule; the cells come with the next press.
		expect(hints[0]?.teaser).toEqual(hints[0]?.text.slice(0, 1));
		expect(hints[0]?.area).toEqual(expect.arrayContaining(['13', '19']));
		const keys = [
			...hints.flatMap((h) => h!.text),
			...TECHNIQUES.map((t) => `games.tetroid.hints.${t}`)
		];
		for (const key of keys) {
			expect(typeof lookup(en, key), key).toBe('string');
			expect(typeof lookup(de, key), key).toBe('string');
		}
		const solved = empty(example);
		solved.marks = solution.map((s) => (s ? SHADED : EMPTY));
		expect(tetroid.hint!(example, solved)).toBeNull();
	});
});
