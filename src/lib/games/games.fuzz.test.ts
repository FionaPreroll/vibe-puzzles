import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { BasePuzzle, GameModule } from '../core/types';
import { isPlayable } from '../core/variants';
import { GAMES } from './index';

/**
 * Puzzles and positions from outside (saves, other devices, backups, shared links) can be
 * anything. Checking them never throws, and whatever passes the check the game can play.
 */

const RUNS = {
	numRuns: Number(process.env.FUZZ_RUNS ?? 1000),
	seed: Number(process.env.FUZZ_SEED ?? 77)
};

const leaf = fc.oneof(
	fc.integer({ min: -2, max: 40 }),
	fc.constantFrom(0.5, -1.5, 1e9, 2 ** 53),
	fc.string({ maxLength: 4 }),
	fc.boolean(),
	fc.constant(null)
);
/** What JSON.parse can give. */
const json = fc
	.letrec((tie) => ({
		value: fc.oneof({ depthSize: 'small' }, leaf, tie('array'), tie('object')),
		array: fc.array(tie('value'), { maxLength: 6 }),
		object: fc.dictionary(fc.string({ maxLength: 8 }), tie('value'), { maxKeys: 4 })
	}))
	.value.map((v) => JSON.parse(JSON.stringify(v)) as unknown);

/** `value` with its `n`-th node (in pre-order, wrapping around) replaced by `by`. */
function replaceNode(value: unknown, n: number, by: unknown): unknown {
	const nodes: { parent: unknown[] | Record<string, unknown>; key: string | number }[] = [];
	const copy = structuredClone(value);
	const walk = (v: unknown) => {
		if (!v || typeof v !== 'object') return;
		for (const [k, child] of Object.entries(v)) {
			nodes.push({ parent: v as Record<string, unknown>, key: k });
			walk(child);
		}
	};
	walk(copy);
	if (!nodes.length) return by;
	const { parent, key } = nodes[n % nodes.length];
	(parent as Record<string, unknown>)[key] = by;
	return copy;
}

/** Each game with a puzzle of its smallest regular types (generating bigger ones takes long). */
const samples = GAMES.map((game) => {
	const g = game as unknown as GameModule;
	const small = g.variants
		.filter((v) => !v.special && isPlayable(v))
		.sort((a, b) => a.width * a.height - b.width * b.height)
		.filter((v, i, all) => i === 0 || v.mode !== all[0].mode)
		.slice(0, 2);
	return { game: g, puzzles: small.map((v) => ({ variant: v, puzzle: g.generate(v, 7) })) };
});

/** Everything a game does with a position it accepted. */
function play(game: GameModule, puzzle: BasePuzzle, state: unknown) {
	game.isSolved(puzzle, state);
	game.answer(puzzle, state);
	game.decodeState(puzzle, game.encodeState(state));
	game.hint?.(puzzle, state);
}

describe.each(samples)('$game.id fuzzing', ({ game, puzzles }) => {
	it('checks any puzzle without throwing, and plays every one it accepts', () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...puzzles),
				fc.nat(),
				json,
				fc.constantFrom(...game.variants),
				({ puzzle }, n, by, variant) => {
					const changed = replaceNode(puzzle, n, by);
					const valid = game.isValidPuzzle(changed, variant);
					expect(typeof valid).toBe('boolean');
					if (!valid) return;
					const empty = game.emptyState(changed);
					expect(game.isValidState(changed, empty)).toBe(true);
					play(game, changed, empty);
					game.verifyAnswer(changed, game.answer(changed, empty));
				}
			),
			RUNS
		);
	});

	it('checks any position without throwing, and plays every one it accepts', () => {
		fc.assert(
			fc.property(fc.constantFrom(...puzzles), fc.nat(), json, ({ puzzle }, n, by) => {
				const state = replaceNode(game.emptyState(puzzle), n, by);
				const valid = game.isValidState(puzzle, state);
				expect(typeof valid).toBe('boolean');
				if (valid) play(game, puzzle, state);
			}),
			RUNS
		);
	});

	it('decodes any shared position to null or a valid one', () => {
		/** A shared position, as linked or with some characters changed, cut or added. */
		const text = fc
			.tuple(
				fc.constantFrom(...puzzles),
				fc.array(fc.tuple(fc.nat(), fc.nat({ max: 2 }), fc.string({ maxLength: 3 })), {
					maxLength: 4
				})
			)
			.map(([{ puzzle }, edits]) => {
				let t = game.encodeState(game.emptyState(puzzle));
				for (const [at, cut, add] of edits) {
					const i = t.length ? at % t.length : 0;
					t = t.slice(0, i) + add + t.slice(i + cut);
				}
				return t;
			});
		fc.assert(
			fc.property(
				fc.constantFrom(...puzzles),
				fc.oneof(text, fc.string({ maxLength: 120 })),
				({ puzzle }, text) => {
					const state = game.decodeState(puzzle, text);
					expect(state === null || game.isValidState(puzzle, state)).toBe(true);
				}
			),
			RUNS
		);
	});

	it('verifies any answer without throwing', () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...puzzles),
				fc.string({ maxLength: 120 }),
				({ puzzle }, text) => {
					expect(typeof game.verifyAnswer(puzzle, text)).toBe('boolean');
				}
			),
			RUNS
		);
	});
});
