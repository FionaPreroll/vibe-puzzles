import { describe, expect, it } from 'vitest';
import { generateLoop } from '../../games/loop/generator';
import {
	analyze,
	CROSS,
	edgeValues,
	isSolvedState,
	LINE,
	OPEN,
	type LoopPuzzle
} from '../../games/loop/rules';
import { i18n } from '../../i18n/index.svelte';
import { Timeline } from '../film';
import { ti } from '../i18n';
import { LOOP_SEED, loopFilm } from './loop';

const film = loopFilm();
const [grow, numbers, solve] = film.chapters;
// The numbers chapter: every number, then digging from the frame that starts it.
const dig = { ...numbers, frames: numbers.frames.slice(keysOf(numbers).indexOf('loop.dig.start')) };
const { puzzle, solution } = generateLoop(7, 7, 'normal', LOOP_SEED);
function keysOf(chapter: (typeof film.chapters)[number]) {
	return chapter.frames.map((f) => f.caption.key);
}
const clueCount = (p: LoopPuzzle) => [...p.clues].filter((c) => c !== '.').length;

describe('the Loop film', () => {
	it('has three chapters on the Loop board, with every number in full colour', () => {
		expect(film.game).toBe('loop');
		expect(film.settings).toEqual({ dimSatisfiedClues: false });
		expect(film.chapters.map((c) => c.title)).toEqual([
			'loop.chapters.grow',
			'loop.chapters.numbers',
			'loop.chapters.solve'
		]);
	});

	it('grows a region whose border is always one loop, and turns cells away that would break it', () => {
		const grown = grow.frames.filter((f) => f.caption.key.match(/grow\.(first|grow)$/));
		grown.forEach((f, k) => {
			expect(f.area).toHaveLength(k + 1);
			expect(f.area).toContain(f.spotlight![0]);
			expect(isSolvedState(f.puzzle, f.state)).toBe(true);
		});
		const touch = grow.frames.filter((f) => f.caption.key === 'loop.grow.touch');
		const hole = grow.frames.filter((f) => f.caption.key === 'loop.grow.hole');
		expect(touch.length).toBeGreaterThan(0);
		expect(hole.length).toBeGreaterThan(0);
		for (const f of [...touch, ...hole]) {
			// The cell turned away, ringed in red, and the loop it would make, its new lines in teal.
			expect(f.mistake).toBe(true);
			expect(f.spotlight![0]).toMatch(/^c:/);
			expect(isSolvedState(f.puzzle, f.state)).toBe(false);
			expect(f.trial!.length).toBeGreaterThan(0);
		}
		// Where it would touch itself, the dot has four lines; a hole rings the cells cut off.
		for (const f of touch) {
			const dots = f.spotlight!.filter((k) => k.startsWith('d:'));
			expect(dots.length).toBeGreaterThan(0);
			for (const d of dots) expect(analyze(f.puzzle, f.state).dotError[+d.slice(2)]).toBe(true);
		}
		for (const f of hole) {
			expect(f.spotlight!.slice(1).every((k) => k.startsWith('c:'))).toBe(true);
			expect(f.spotlight!.slice(1).some((k) => f.area!.includes(k))).toBe(false);
		}
		const end = grow.frames.at(-1)!;
		expect(end.state).toEqual(solution);
		expect(end.caption.params).toEqual({ cells: end.area!.length });
	});

	it('gives every cell the number of its loop edges, then hides the loop', () => {
		const [all, ...rest] = numbers.frames.slice(0, numbers.frames.length - dig.frames.length);
		expect(all.puzzle.clues).not.toContain('.');
		expect([...all.puzzle.clues].map(Number)).toEqual(analyze(puzzle, solution).count);
		const examples = rest.filter((f) => f.caption.key === 'loop.numbers.example');
		expect(examples.map((f) => f.caption.params!.clue)).toEqual([3, 0]);
		for (const f of examples) expect(f.area).toHaveLength(Number(f.caption.params!.clue));
		const hide = rest.at(-1)!;
		expect(hide.caption.key).toBe('loop.numbers.hide');
		expect(edgeValues(hide.state).every((x) => x === OPEN)).toBe(true);
	});

	it('takes numbers out while the rules solve the puzzle, and puts back what they need', () => {
		const tries = dig.frames.filter((f) => f.caption.key === 'loop.dig.try');
		expect(tries).toHaveLength(49);
		// Numbers left so far: a stuck frame shows the puzzle without its number, which goes back.
		let left = 49;
		for (const f of dig.frames.slice(1, -1)) {
			const count = clueCount(f.puzzle);
			expect(count).toBe(left - 1);
			if (f.caption.key === 'loop.dig.try') {
				expect(f.puzzle.clues[+f.spotlight![0].slice(2)]).toBe('.');
			} else if (f.caption.key === 'loop.dig.keep') {
				expect(f.caption.params!.count).toBe(count);
				left = count;
			} else {
				// The rules decide some edges, and leave some open.
				const edges = edgeValues(f.state);
				expect(edges).toContain(OPEN);
				expect(edges.some((x) => x !== OPEN)).toBe(true);
				expect(f.mistake).toBe(true);
			}
		}
		expect(keysOf(dig)).toContain('loop.dig.stuck');
		const end = dig.frames.at(-1)!;
		expect(end.puzzle).toEqual(puzzle);
		expect(end.caption.params).toEqual({ count: clueCount(puzzle) });
	});

	it('solves the puzzle with the basic rules, a cell or a dot at a time', () => {
		const [start] = solve.frames;
		expect(start.puzzle).toEqual(puzzle);
		const captions = new Set(keysOf(solve));
		for (const kind of [
			'zero',
			'full',
			'needs',
			'clueCorner',
			'cellCorner',
			'dotFull',
			'dotOn',
			'dotEnd',
			'dotCorner',
			'loop',
			'closed'
		]) {
			expect(captions, kind).toContain(`loop.solve.${kind}`);
		}
		const right = edgeValues(solution);
		for (const f of solve.frames.slice(1, -1)) {
			const edges = edgeValues(f.state);
			expect(f.spotlight!.length).toBeGreaterThan(0);
			edges.forEach((x, e) => x && expect(x === LINE).toBe(right[e] === LINE));
			// The cell or dot whose rule it is, or the path a crossed edge would close, is tinted.
			const rule = f.detail!.key.match(/solve\.(\w+)Detail/)![1];
			const tinted = { cell: /^c:\d+$/, dot: /^d:\d+$/, loop: /^[hv]:/ }[rule]!;
			expect(f.area!.every((k) => tinted.test(k))).toBe(true);
		}
		const loop = solve.frames.find((f) => f.caption.key === 'loop.solve.loop')!;
		expect(loop.area!.length).toBeGreaterThan(0);
		// Closing the loop tints all of it.
		const closed = solve.frames.find((f) => f.caption.key === 'loop.solve.closed')!;
		expect(closed.area).toHaveLength(right.filter((x) => x === LINE).length);
		const end = solve.frames.at(-1)!;
		expect(end.caption).toEqual({
			key: 'loop.solve.done',
			params: { steps: solve.frames.length - 2 }
		});
		expect(edgeValues(end.state)).toEqual(right.map((x) => (x === LINE ? LINE : CROSS)));
	});

	it('is the same for the same seed, and makes another puzzle for another', () => {
		expect(loopFilm(LOOP_SEED)).toEqual(film);
		const other = loopFilm(1);
		expect(other.chapters[2].frames[0].puzzle).toEqual(generateLoop(7, 7, 'normal', 1).puzzle);
	});

	it('has every text it says in both languages, with its values', () => {
		const frames = new Timeline(film).frames;
		const captions = frames.flatMap((f) => [f.caption, ...(f.detail ? [f.detail] : [])]);
		try {
			for (const locale of ['en', 'de'] as const) {
				i18n.locale = locale;
				for (const title of film.chapters.map((c) => c.title)) expect(ti(title)).not.toBe(title);
				for (const { key, params } of captions) {
					const text = ti(key, params);
					expect(text, key).not.toBe(key);
					expect(text, key).not.toMatch(/\{\w+\}/);
				}
			}
		} finally {
			i18n.locale = 'en';
		}
	});
});
