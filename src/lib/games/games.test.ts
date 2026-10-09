import { describe, expect, it } from 'vitest';
import type { GameModule } from '../core/types';
import de from '../i18n/de';
import en from '../i18n/en';
import { GAMES, gameById } from './index';
import { GAME_LOGIC } from './logic';
import {
	findTutorial,
	tutorialDoneKey,
	tutorialNextVariant,
	tutorialsOf,
	tutorialTextKey
} from './tutorials';

function lookup(dict: unknown, key: string): unknown {
	return key
		.split('.')
		.reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], dict);
}

const keysOf = (items: { key: string }[]) => items.map((i) => i.key);

describe('game registry', () => {
	it('lists every game with logic, and finds games by ID', () => {
		expect(GAMES.map((g) => g.id).sort()).toEqual(Object.keys(GAME_LOGIC).sort());
		expect(gameById('tetroid')?.name).toBe('Tetroid');
		expect(gameById('nope')).toBeUndefined();
	});
});

describe.each(GAMES.map((g) => [g.id, g] as [string, GameModule]))('%s', (id, game) => {
	it('has texts in the translations', () => {
		const texts = (en.games as Record<string, { rules?: unknown }>)[id];
		expect(texts?.rules).toBeDefined();
	});

	it('has unique tools and keys, and a default tool among them', () => {
		const tools = game.tools.map((t) => t.id);
		expect(new Set(tools).size).toBe(tools.length);
		const keys = [...keysOf(game.tools), ...keysOf(game.toolOptions?.values ?? [])];
		expect(new Set(keys).size).toBe(keys.length);
		expect(tools).toContain(game.defaultTool(true));
		expect(tools).toContain(game.defaultTool(false));
		if (game.toolOptions) {
			expect(tools).toContain(game.toolOptions.tool);
			expect(game.toolOptions.values.map((v) => v.value)).toContain(game.toolOptions.default);
		}
	});

	it('has unique settings whose dependencies exist', () => {
		const keys = keysOf(game.settings);
		expect(new Set(keys).size).toBe(keys.length);
		for (const s of game.settings) if (s.requires) expect(keys).toContain(s.requires.key);
		for (const key of keys) expect(Object.keys(en.setting), key).toContain(key);
	});

	it.each(tutorialsOf(game).map((r) => [r.mode ?? 'main', r] as const))(
		'starts the %s tutorial on a valid, uniquely solvable puzzle that is not solved yet',
		(_, { mode, tutorial }) => {
			const { width, height } = tutorial.puzzle as { width: number; height: number };
			const variant = {
				key: 'tutorial',
				label: '',
				width,
				height,
				difficulty: 'normal' as const,
				mode
			};
			expect(game.isValidPuzzle(tutorial.puzzle, variant)).toBe(true);
			expect(game.countSolutions(tutorial.puzzle, 2)).toEqual({ count: 1, finished: true });
			const start = tutorial.start(tutorial.puzzle);
			expect(game.isValidState(tutorial.puzzle, start)).toBe(true);
			expect(game.isSolved(tutorial.puzzle, start)).toBe(false);
		}
	);

	it.each(tutorialsOf(game).map((r) => [r.mode ?? 'main', r] as const))(
		'guides the %s tutorial with a text per step and "Show me" for every task',
		(_, r) => {
			const { puzzle, start, steps } = r.tutorial;
			let s = start(puzzle);
			for (const step of steps) {
				if (!step.done) continue;
				expect(step.done(puzzle, s)).toBe(false);
				s = step.show!(puzzle, s);
				expect(step.done(puzzle, s)).toBe(true);
			}
			expect(game.isSolved(puzzle, s)).toBe(false);
			for (const dict of [en, de]) {
				const texts = lookup(dict, tutorialTextKey(r)) as {
					text: string;
					task?: string;
					done?: string;
				}[];
				expect(texts).toHaveLength(steps.length);
				steps.forEach((step, n) => {
					expect(texts[n].text, `step ${n + 1}`).toBeTruthy();
					if (step.done) expect(texts[n].task && texts[n].done, `step ${n + 1}`).toBeTruthy();
				});
				// The last step is a task too: solving the board ends the tutorial.
				expect(texts.at(-1)!.task).toBeTruthy();
			}
		}
	);
});

describe('tutorials', () => {
	const sudoku = gameById('sudoku')!;
	const tetroid = gameById('tetroid')!;

	it('lists the main tutorial, then one per mode', () => {
		expect(tutorialsOf(sudoku).map((r) => r.mode)).toEqual([undefined, 'calc']);
		expect(tutorialsOf(tetroid).map((r) => r.mode)).toEqual([undefined]);
		expect(findTutorial(sudoku, 'calc')?.tutorial).toBe(sudoku.modeTutorials!.calc);
		expect(findTutorial(sudoku, 'nope')).toBeUndefined();
	});

	it('keeps texts, progress and the next puzzle apart per mode', () => {
		const main = findTutorial(sudoku)!;
		const calc = findTutorial(sudoku, 'calc')!;
		expect(tutorialDoneKey(main)).toBe('tutorialDone:sudoku');
		expect(tutorialDoneKey(calc)).toBe('tutorialDone:sudoku:calc');
		expect(tutorialTextKey(main)).toBe('games.sudoku.tutorial');
		expect(tutorialTextKey(calc)).toBe('games.sudoku.modes.calc.tutorial');
		expect(tutorialNextVariant(main)).toBeUndefined();
		expect(sudoku.variants.find((v) => v.key === tutorialNextVariant(calc))?.mode).toBe('calc');
	});
});
