import { describe, expect, it } from 'vitest';
import de from '../../i18n/de';
import en from '../../i18n/en';
import { generateLoop } from './generator';
import { loopHint, TECHNIQUES, type LoopHint, type Technique } from './hint';
import { loop } from './index';
import {
	CROSS,
	edgeKey,
	edgeValues,
	emptyLoopState,
	hIndex,
	isSolvedState,
	LINE,
	stateFromEdges,
	vIndex,
	type LoopPuzzle,
	type LoopState
} from './rules';
import { loopLayout } from './solver';

/** A state with lines and crosses on the given edges, as `h:i:j` / `v:i:j` keys. */
function marks(p: LoopPuzzle, lines: string[], crosses: string[] = []): LoopState {
	const s = emptyLoopState(p);
	for (const [keys, value] of [
		[lines, LINE],
		[crosses, CROSS]
	] as const) {
		for (const key of keys) {
			const [kind, i, j] = key.split(':');
			if (kind === 'h') s.h[hIndex(p, Number(i), Number(j))] = value;
			else s.v[vIndex(p, Number(i), Number(j))] = value;
		}
	}
	return s;
}

const keys = (p: LoopPuzzle, edges: number[]) => edges.map((e) => edgeKey(p, e)).sort();

type Step = Extract<LoopHint, { kind: 'step' }>;

/** Follows hints from an empty board, marking their edges, and checks each against the solution. */
function follow(p: LoopPuzzle, solution: LoopState): Step[] {
	const right = edgeValues(solution);
	let state = emptyLoopState(p);
	const steps: Step[] = [];
	for (let k = 0; k < 500; k++) {
		const hint = loopHint(p, state);
		if (!hint) break;
		expect(hint.kind).toBe('step');
		const step = hint as Step;
		const value = step.mark === 'line' ? LINE : CROSS;
		const v = edgeValues(state);
		for (const e of step.edges) {
			expect(right[e] === LINE ? LINE : CROSS, `${step.reason} at ${edgeKey(p, e)}`).toBe(value);
			v[e] = value;
		}
		steps.push(step);
		state = stateFromEdges(p, v);
	}
	expect(isSolvedState(p, state)).toBe(true);
	return steps;
}

describe('loop hints', () => {
	it('crosses the sides of a 0 first', () => {
		const p: LoopPuzzle = { width: 3, height: 3, clues: '....0....' };
		const hint = loopHint(p, emptyLoopState(p)) as Step;
		expect(hint).toMatchObject({
			technique: 'clue',
			reason: 'clueZero',
			mark: 'cross',
			cells: [4]
		});
		expect(keys(p, hint.edges)).toEqual(['h:1:1', 'h:2:1', 'v:1:1', 'v:1:2']);
	});

	it('names a number that has its lines, and one with just enough free sides', () => {
		const p: LoopPuzzle = { width: 3, height: 3, clues: '....2....' };
		const full = loopHint(p, marks(p, ['h:1:1', 'v:1:1'])) as Step;
		expect(full).toMatchObject({ reason: 'clueFull', mark: 'cross', clue: 2 });
		expect(keys(p, full.edges)).toEqual(['h:2:1', 'v:1:2']);
		const fill = loopHint(p, marks(p, [], ['h:1:1', 'v:1:1'])) as Step;
		expect(fill).toMatchObject({ reason: 'clueFill', mark: 'line' });
		expect(keys(p, fill.edges)).toEqual(['h:2:1', 'v:1:2']);
	});

	it('lets a line go on through a dot, and closes off dots', () => {
		const p: LoopPuzzle = { width: 3, height: 3, clues: '.........' };
		// The line ends at the top left dot of the middle cell, whose other edges are crossed but one.
		const on = loopHint(p, marks(p, ['h:1:0'], ['v:0:1', 'h:1:1'])) as Step;
		expect(on).toMatchObject({ technique: 'dot', reason: 'dotOn', mark: 'line', dots: [5] });
		expect(keys(p, on.edges)).toEqual(['v:1:1']);
		const full = loopHint(p, marks(p, ['h:1:0', 'h:1:1'])) as Step;
		expect(full).toMatchObject({ reason: 'dotFull', mark: 'cross' });
		expect(keys(p, full.edges)).toEqual(['v:0:1', 'v:1:1']);
		// The corner dot of the grid has two edges: crossing one leaves the other a dead end.
		const end = loopHint(p, marks(p, [], ['h:0:0'])) as Step;
		expect(end).toMatchObject({ reason: 'dotEnd', mark: 'cross', dots: [0] });
		expect(keys(p, end.edges)).toEqual(['v:0:0']);
	});

	it('crosses the edge that would close a small loop', () => {
		const p: LoopPuzzle = { width: 3, height: 1, clues: '..1' };
		const hint = loopHint(p, marks(p, ['h:0:0', 'v:0:0', 'h:1:0'])) as Step;
		expect(hint).toMatchObject({ technique: 'loop', reason: 'loop', mark: 'cross' });
		expect(keys(p, hint.edges)).toEqual(['v:0:1']);
		expect(keys(p, hint.path)).toEqual(['h:0:0', 'h:1:0', 'v:0:0']);
	});

	it('draws the outer edges of a 3 in the corner of the grid', () => {
		const p: LoopPuzzle = { width: 3, height: 3, clues: '3........' };
		const hint = loopHint(p, emptyLoopState(p)) as Step;
		expect(hint).toMatchObject({ technique: 'corner', reason: 'cornerLine', cells: [0], clue: 3 });
		expect(keys(p, hint.edges)).toEqual(['h:0:0', 'v:0:0']);
		expect(hint.dots).toContain(0);
	});

	it('draws the far sides of two 3s on a diagonal', () => {
		const p: LoopPuzzle = { width: 4, height: 4, clues: '.....3....3.....' };
		const hint = loopHint(p, emptyLoopState(p)) as Step;
		expect(hint).toMatchObject({
			technique: 'pair',
			reason: 'pairLine',
			cells: [5, 10],
			dots: [12]
		});
		expect(keys(p, hint.edges)).toEqual(['h:1:1', 'h:3:2', 'v:1:1', 'v:2:3']);
	});

	it('walks from cell to cell for inside and outside', () => {
		const { puzzle, solution } = generateLoop(7, 7, 'hard', 1);
		const sides = follow(puzzle, solution).filter((step) => step.technique === 'sides');
		expect(sides.length).toBeGreaterThan(0);
		for (const step of sides) {
			expect(step.edges).toHaveLength(1);
			expect(step.reason).toBe(step.mark === 'line' ? 'sidesOther' : 'sidesSame');
			// The walk starts and ends by the edge; beyond the grid counts as one more cell.
			const { edgeSide } = loopLayout(7, 7);
			const ends = [edgeSide[2 * step.edges[0]], edgeSide[2 * step.edges[0] + 1]];
			const inGrid = ends.filter((x) => x < 49);
			for (const x of inGrid) expect([step.cells[0], step.cells.at(-1)]).toContain(x);
			const border = (x: number) => x < 7 || x >= 42 || x % 7 === 0 || x % 7 === 6;
			for (let k = 1; k < step.cells.length; k++) {
				const [a, b] = [step.cells[k - 1], step.cells[k]];
				const near =
					Math.abs(a - b) === 7 ||
					(Math.abs(a - b) === 1 && Math.floor(a / 7) === Math.floor(b / 7));
				expect(near || (border(a) && border(b))).toBe(true);
			}
		}
	});

	it('points at wrong marks before anything else', () => {
		const { puzzle, solution } = generateLoop(5, 5, 'normal', 1);
		const v = edgeValues(solution).map((x): number => (x === LINE ? LINE : 0));
		const wrongLine = v.indexOf(0);
		const wrongCross = v.indexOf(LINE);
		v[wrongLine] = LINE;
		v[wrongCross] = CROSS;
		expect(loopHint(puzzle, stateFromEdges(puzzle, v))).toEqual({
			kind: 'mistake',
			edges: [wrongLine, wrongCross].sort((a, b) => a - b)
		});
		expect(loopHint(puzzle, solution)).toBeNull();
	});

	it('names what breaks when an edge is tried', () => {
		// Rated hard puzzles that the local rules alone do not finish.
		const seen = new Set<string>();
		for (const seed of [3, 5, 13, 15, 19]) {
			const { puzzle, solution } = generateLoop(5, 5, 'hard', seed);
			for (const step of follow(puzzle, solution)) {
				if (step.technique !== 'assumption') continue;
				seen.add(step.breaks!);
				expect(step.cells.length).toBeGreaterThan(0);
				expect(step.reason).toBe(step.mark === 'line' ? 'assumeCross' : 'assumeLine');
			}
		}
		expect(seen.size).toBeGreaterThan(0);
	});

	// Following the hints solves every puzzle. Assumptions stay rare: only where no rule on a
	// number, a pair or a 2×2 block decides an edge.
	it.each([
		[5, 'normal'],
		[5, 'hard'],
		[7, 'normal'],
		[7, 'hard']
	] as const)('solves %i×%i… %s puzzles by following the hints', (size, difficulty) => {
		const used = new Set<Technique>();
		let steps = 0;
		let assumptions = 0;
		for (let seed = 1; seed <= 6; seed++) {
			const { puzzle, solution } = generateLoop(size, size, difficulty, seed);
			for (const step of follow(puzzle, solution)) {
				used.add(step.technique);
				steps++;
				if (step.technique === 'assumption') assumptions++;
			}
		}
		expect(assumptions / steps).toBeLessThan(0.03);
		for (const t of ['clue', 'dot', 'loop', 'corner'] as const) expect(used).toContain(t);
		expect([...used].every((t) => TECHNIQUES.includes(t))).toBe(true);
	});
});

describe('loop hint texts', () => {
	const lookup = (dict: object, key: string) =>
		key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], dict);

	it('has an English and a German text for every hint it gives', () => {
		const texts = new Set<string>();
		for (const [size, difficulty, seed] of [
			[5, 'hard', 13],
			[7, 'hard', 8],
			[5, 'normal', 1]
		] as const) {
			const { puzzle, solution } = generateLoop(size, size, difficulty, seed);
			const right = edgeValues(solution);
			let state = emptyLoopState(puzzle);
			for (let k = 0; k < 500; k++) {
				const hint = loop.hint!(puzzle, state);
				if (!hint) break;
				expect(hint.kind).toBe('step');
				expect(hint.spotlight.length).toBeGreaterThan(0);
				expect(hint.area?.length).toBeGreaterThan(0);
				expect(hint.teaser?.length).toBeGreaterThan(0);
				for (const key of [...hint.text, ...hint.teaser!]) texts.add(key);
				const v = edgeValues(state);
				for (const key of hint.spotlight) {
					const e = v.findIndex((_, x) => edgeKey(puzzle, x) === key);
					v[e] = right[e] === LINE ? LINE : CROSS;
				}
				state = stateFromEdges(puzzle, v);
			}
		}
		for (const key of texts) {
			expect(lookup(en, key), key).toBeTypeOf('string');
			expect(lookup(de, key), key).toBeTypeOf('string');
		}
		// The number appears in the texts that name it.
		expect(lookup(en, 'games.loop.hints.clueLook')).toContain('{clue}');
	});

	it('shows a wrong mark and the stuck case', () => {
		const p: LoopPuzzle = { width: 3, height: 3, clues: '....0....' };
		// A line next to the 0 is wrong; the puzzle has no solution, so it is not called a mistake.
		const hint = loop.hint!(p, marks(p, ['h:1:1']));
		expect(hint?.text.length).toBeGreaterThan(0);
		const { puzzle, solution } = generateLoop(5, 5, 'normal', 1);
		const v = edgeValues(solution).map((x) => (x === LINE ? CROSS : 0));
		const mistake = loop.hint!(puzzle, stateFromEdges(puzzle, v))!;
		expect(mistake).toMatchObject({ kind: 'mistake', text: ['game.hintMistake'] });
		expect(loop.hint!(puzzle, solution)).toBeNull();
		// An open grid: nothing follows, and trying edges finds no contradiction either.
		const open: LoopPuzzle = { width: 2, height: 2, clues: '....' };
		expect(loop.hint!(open, emptyLoopState(open))).toMatchObject({
			kind: 'stuck',
			text: ['games.loop.hints.stuck']
		});
	});
});
