import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readType, typeDir } from '../../../scripts/collection';
import { layoutType, serialize, specialPuzzleId } from '../core/bank';
import { decodePuzzleId } from '../core/variants';
import { GAME_LOGIC } from './logic';

/** Every puzzle in the collection must be valid, belong to its file and have one solution. */
describe('puzzle collection', () => {
	for (const logic of Object.values(GAME_LOGIC)) {
		it(`${logic.id} has a folder per puzzle type and nothing else`, () => {
			const keys = logic.variants.map((v) => v.key).sort();
			expect(readdirSync(join('static', 'puzzles', logic.id)).sort()).toEqual(keys);
		});

		logic.variants.forEach((variant, index) => {
			const dir = typeDir('static', logic.id, variant.key);
			if (!existsSync(dir)) return;
			it(`${logic.id} ${variant.key}`, () => {
				const kind = variant.special;
				const puzzles = readType('static', logic.id, variant.key, kind);
				// The files are exactly what the layout makes of their puzzles: chunks, index and
				// period groups in order, one puzzle per line, no stray files.
				const files = layoutType(logic.id, variant.key, puzzles, kind);
				const names = Object.keys(files).map((path) => path.split('/').pop());
				expect(readdirSync(dir).sort()).toEqual(names.sort());
				for (const [path, file] of Object.entries(files)) {
					expect(readFileSync(join('static', path), 'utf8'), path).toBe(serialize(file));
				}

				const ids = puzzles.map((p) => p.id);
				expect(new Set(ids).size).toBe(ids.length);
				for (const { id, puzzle, period } of puzzles) {
					expect(decodePuzzleId(id).variantIndex, `#${id}`).toBe(index);
					// A special puzzle must be the one every player gets for its period.
					if (kind) expect(id, `#${id}`).toBe(specialPuzzleId(logic.id, index, kind, period!));
					else expect(period, `#${id}`).toBeUndefined();
					expect(logic.isValidPuzzle(puzzle, variant), `#${id}`).toBe(true);
					expect(logic.countSolutions(puzzle, 2), `#${id}`).toEqual({ count: 1, finished: true });
				}
			}, 120_000);
		});
	}
});
