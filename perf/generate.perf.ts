import { describe, expect, it } from 'vitest';
import { GAME_LOGIC } from '../src/lib/games/logic';

/**
 * How long generating a puzzle (with its uniqueness check) takes per variant. Times vary a lot
 * between seeds, so the budget applies to the median of a few fixed seeds. PERF_BUDGET_SCALE
 * (default 1) relaxes the budgets on slow machines.
 */
const SCALE = Number(process.env.PERF_BUDGET_SCALE ?? 1);
const SEEDS = [1, 2, 3, 4, 5];
/** Median budget by board size, in ms. */
const BUDGET: Record<number, number> = {
	5: 200,
	6: 500,
	7: 300,
	8: 1000,
	9: 500,
	10: 2000,
	15: 5000,
	20: 20000
};

/** Rule sets that take longer than the game's main one, as a factor on the size's budget. */
const MODE_FACTOR: Record<string, number> = { calc: 4 };

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

for (const [id, logic] of Object.entries(GAME_LOGIC)) {
	describe(id, () => {
		for (const variant of logic.variants.filter((v) => !v.special)) {
			it(`generates ${variant.key} within budget`, () => {
				const times = SEEDS.map((seed) => {
					const start = performance.now();
					const puzzle = logic.generate(variant, seed);
					const ms = performance.now() - start;
					expect(logic.isValidPuzzle(puzzle, variant)).toBe(true);
					return ms;
				});
				const ms = median(times);
				console.log(
					`${id} ${variant.key}: median ${Math.round(ms)} ms (${times.map(Math.round).join(', ')})`
				);
				expect(ms).toBeLessThan(
					BUDGET[variant.width] * (MODE_FACTOR[variant.mode ?? ''] ?? 1) * SCALE
				);
			});
		}
	});
}
