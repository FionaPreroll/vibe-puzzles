import { describe, expect, it } from 'vitest';
import type { GameModule } from '../core/types';
import en from '../i18n/en';
import { GAMES, gameById } from './index';
import { GAME_LOGIC } from './logic';

const keysOf = (items: { key: string }[]) => items.map((i) => i.key);

/** Games whose logic (and puzzle collection) landed before their board. */
const LOGIC_ONLY = ['sudoku'];

describe('game registry', () => {
	it('lists every game with logic, and finds games by ID', () => {
		const withBoard = Object.keys(GAME_LOGIC).filter((id) => !LOGIC_ONLY.includes(id));
		expect(GAMES.map((g) => g.id).sort()).toEqual(withBoard.sort());
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

	it('starts the tutorial on a valid, uniquely solvable puzzle that is not solved yet', () => {
		const tutorial = game.tutorial!;
		const { width, height } = tutorial.puzzle as { width: number; height: number };
		const variant = { key: 'tutorial', label: '', width, height, difficulty: 'normal' as const };
		expect(game.isValidPuzzle(tutorial.puzzle, variant)).toBe(true);
		expect(game.countSolutions(tutorial.puzzle, 2)).toEqual({ count: 1, finished: true });
		const start = tutorial.start(tutorial.puzzle);
		expect(game.isValidState(tutorial.puzzle, start)).toBe(true);
		expect(game.isSolved(tutorial.puzzle, start)).toBe(false);
	});
});
