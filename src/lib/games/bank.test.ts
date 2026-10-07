import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bankPath, type PuzzleBank } from '../core/bank';
import { decodePuzzleId } from '../core/variants';
import { GAME_LOGIC } from './logic';

/** Every puzzle in the collection must be valid, belong to its file and have one solution. */
describe('puzzle collection', () => {
	for (const logic of Object.values(GAME_LOGIC)) {
		logic.variants.forEach((variant, index) => {
			if (variant.special) return;
			const file = join('static', bankPath(logic.id, variant.key));
			if (!existsSync(file)) return;
			it(`${logic.id} ${variant.key}`, () => {
				const bank: PuzzleBank = JSON.parse(readFileSync(file, 'utf8'));
				expect(bank).toMatchObject({ version: 1, game: logic.id, variant: variant.key });
				const ids = bank.puzzles.map((p) => p.id);
				expect(new Set(ids).size).toBe(ids.length);
				for (const { id, puzzle } of bank.puzzles) {
					expect(decodePuzzleId(id).variantIndex, `#${id}`).toBe(index);
					expect(logic.isValidPuzzle(puzzle, variant), `#${id}`).toBe(true);
					expect(logic.countSolutions(puzzle, 2), `#${id}`).toEqual({ count: 1, finished: true });
				}
			}, 120_000);
		});
	}
});
