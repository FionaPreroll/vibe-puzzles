import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import de from '../../i18n/de';
import en from '../../i18n/en';
import { generatePipes, randomTree } from './generator';
import { pipesHint, pipesSolution, type PipesHint, type PipesTechnique } from './hint';
import { pipes } from './index';
import {
	emptyPipesState,
	isSolvedTiles,
	neighbourTable,
	turn,
	type PipesPuzzle,
	type PipesState
} from './rules';
import { PipesSolver, solvePipes } from './solver';

/** `s` with tile `cell` turned to `mask` and locked, as a hint asks. */
const apply = (s: PipesState, cell: number, mask: number): PipesState => ({
	tiles: s.tiles.map((t, c) => (c === cell ? mask : t)),
	locks: s.locks.map((l, c) => (c === cell ? 1 : l))
});

/** Follows the hints from `s` while they give steps; every hint on the way goes to `seen`. */
function follow(p: PipesPuzzle, s: PipesState, seen: (h: PipesHint, s: PipesState) => void) {
	for (let k = 0; k <= p.width * p.height; k++) {
		const h = pipesHint(p, s);
		if (!h) break;
		seen(h, s);
		if (h.kind !== 'step') break;
		s = apply(s, h.cell, h.mask);
	}
	return s;
}

/**
 * A network with wrap, dealt at random, that the techniques do not settle: it has more than one
 * solution.
 */
function ambiguous(): PipesPuzzle {
	const nb = neighbourTable({ width: 5, height: 5, wrap: true });
	const rng = new Rng(1);
	for (let k = 0; k < 50; k++) {
		const tree = randomTree(5, 5, nb, rng);
		if (!tree) continue;
		const tiles = tree.map((t) => turn(t, rng.int(4)).toString(16)).join('');
		const p: PipesPuzzle = { width: 5, height: 5, wrap: true, tiles };
		if (solvePipes(p, 2).solutions.length > 1) return p;
	}
	throw new Error('no ambiguous network');
}

describe('pipes hints', () => {
	it('lead from the dealt tiles to the solution, each step right, with every technique', () => {
		const used = new Set<PipesTechnique>();
		for (const [size, wrap, seed] of [
			[5, false, 7],
			[5, true, 8],
			[7, false, 3],
			[7, true, 4],
			[10, false, 5]
		] as const) {
			const { puzzle, solution } = generatePipes(size, size, wrap, seed);
			const end = follow(puzzle, emptyPipesState(puzzle), (h, s) => {
				expect(h.kind).toBe('step');
				if (h.kind !== 'step') return;
				expect(h.mask, `${size}${wrap ? 'w' : 'n'} #${seed}`).toBe(solution[h.cell]);
				expect(turn(s.tiles[h.cell], h.turns)).toBe(h.mask);
				expect(s.locks[h.cell]).toBe(0);
				expect(h.area).toContain(h.cell);
				// The edge alone decides nothing on a board with wrap.
				if (wrap) expect(h.technique).not.toBe('edge');
				used.add(h.technique);
			});
			expect(end.locks.every((l) => l === 1)).toBe(true);
			expect(isSolvedTiles(puzzle, end.tiles)).toBe(true);
			expect(pipesHint(puzzle, end)).toBeNull();
		}
		expect([...used].sort()).toEqual(['chain', 'closed', 'edge', 'fit', 'loop']);
	});

	it('start at the edge of the board, then build on the locked tiles', () => {
		const { puzzle } = generatePipes(7, 7, false, 3);
		const first = pipesHint(puzzle, emptyPipesState(puzzle));
		expect(first).toMatchObject({ kind: 'step', technique: 'edge' });
		if (first?.kind !== 'step') return;
		expect(first.area).toEqual([first.cell]);
		// With every tile the edge decides locked, the next steps rest on locked neighbours.
		let s = emptyPipesState(puzzle);
		let h = pipesHint(puzzle, s);
		while (h?.kind === 'step' && h.technique === 'edge') {
			s = apply(s, h.cell, h.mask);
			h = pipesHint(puzzle, s);
		}
		expect(h).toMatchObject({ kind: 'step', technique: 'fit' });
		if (h?.kind !== 'step') return;
		const lockedNext = h.area.filter((c) => c !== h.cell);
		expect(lockedNext.length).toBeGreaterThan(0);
		for (const c of lockedNext) expect(s.locks[c]).toBe(1);
	});

	it('take a tile that lies wrong before one that only needs locking', () => {
		const { puzzle, solution } = generatePipes(7, 7, false, 3);
		// Every tile in place but one, nothing locked.
		const s: PipesState = { tiles: solution.slice(), locks: solution.map(() => 0) };
		const first = pipesHint(puzzle, emptyPipesState(puzzle));
		if (first?.kind !== 'step') throw new Error('no step');
		s.tiles[first.cell] = emptyPipesState(puzzle).tiles[first.cell];
		expect(pipesHint(puzzle, s)).toMatchObject({ kind: 'step', cell: first.cell });
		// All in place: lock them, one by one.
		const right = { tiles: solution.slice(), locks: solution.map(() => 0) };
		expect(pipesHint(puzzle, right)).toMatchObject({ kind: 'step', turns: 0 });
	});

	it('point at locked tiles that lie wrong first', () => {
		const { puzzle, solution } = generatePipes(7, 7, true, 4);
		const s = emptyPipesState(puzzle);
		const wrong = s.tiles.findIndex((t, c) => t !== solution[c]);
		s.locks[wrong] = 1;
		expect(pipesHint(puzzle, s)).toEqual({ kind: 'mistake', cells: [wrong] });
		// Locked the right way, the tile is known.
		s.tiles[wrong] = solution[wrong];
		expect(pipesHint(puzzle, s)?.kind).toBe('step');
	});

	it('say so when no rule decides a tile', () => {
		const p = ambiguous();
		expect(new PipesSolver(p).solvesAlone()).toBeNull();
		const solution = pipesSolution(p)!;
		expect(isSolvedTiles(p, solution)).toBe(true);
		const last: PipesHint[] = [];
		const s = follow(p, emptyPipesState(p), (h) => last.push(h));
		const stuck = last.at(-1)!;
		expect(stuck.kind).toBe('stuck');
		if (stuck.kind !== 'stuck') return;
		// An unlocked tile, one that lies wrong if there is one.
		expect(s.locks[stuck.cell]).toBe(0);
		const wrong = s.tiles.flatMap((t, c) => (!s.locks[c] && t !== solution[c] ? [c] : []));
		if (wrong.length) expect(wrong).toContain(stuck.cell);
	});

	it('come with texts in every language, first where to look, then the turn', () => {
		const lookup = (dict: object, key: string) =>
			key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], dict);
		const keys = new Set<string>();
		const kinds = new Set<string>();
		const collect = (p: PipesPuzzle, s: PipesState) => {
			follow(p, s, (_, at) => {
				const hint = pipes.hint!(p, at)!;
				kinds.add(hint.kind);
				for (const key of [...hint.text, ...(hint.teaser ?? [])]) keys.add(key);
				if (hint.kind !== 'step') return;
				expect(hint.teaser).toEqual([hint.text[0]]);
				expect(hint.text[2]).toMatch(/^games\.pipes\.hints\.turn[0-3]$/);
				expect(hint.area).toContain(hint.spotlight[0]);
			});
		};
		for (const [size, wrap, seed] of [
			[10, false, 5],
			[5, true, 8]
		] as const) {
			const { puzzle } = generatePipes(size, size, wrap, seed);
			collect(puzzle, emptyPipesState(puzzle));
			collect(puzzle, { ...emptyPipesState(puzzle), locks: emptyPipesState(puzzle).locks.fill(1) });
		}
		collect(ambiguous(), emptyPipesState(ambiguous()));
		expect([...kinds].sort()).toEqual(['mistake', 'step', 'stuck']);
		for (const q of [0, 1, 2, 3]) keys.add(`games.pipes.hints.turn${q}`);
		for (const key of keys) {
			expect(lookup(en, key), key).toBeTypeOf('string');
			expect(lookup(de, key), key).toBeTypeOf('string');
		}
	});
});
