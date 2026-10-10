import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	checksDifficulty,
	collectionSizes,
	filesToCheck,
	readType,
	serializeSizes,
	typeDir
} from '../../../scripts/collection';
import {
	layoutType,
	MAX_PER_TYPE,
	serialize,
	sizesPath,
	specialPuzzleId,
	type BankFile
} from '../core/bank';
import type { BasePuzzle } from '../core/types';
import { decodePuzzleId } from '../core/variants';
import { GAME_LOGIC } from './logic';

/**
 * With BANK_TEST_SINCE set to a commit (CI on pull requests), solving puzzles again is limited to
 * the collection files changed since then, unless the game logic changed (see filesToCheck). The
 * cheap checks of layout, format and IDs always cover the whole collection.
 */
const since = process.env.BANK_TEST_SINCE;
const changed = since
	? execFileSync('git', ['diff', '--name-only', since, 'HEAD'], { encoding: 'utf8' })
			.split('\n')
			.filter(Boolean)
	: null;
const solveAgain = filesToCheck(changed);

/**
 * Every puzzle in the collection must be valid, belong to its file, have one solution and fit
 * its type's difficulty (special puzzles from DIFFICULTY_CHECKED_FROM on).
 */
describe('puzzle collection', () => {
	it('lists the size of every regular type, at most MAX_PER_TYPE', () => {
		const sizes = collectionSizes('static', Object.values(GAME_LOGIC));
		expect(readFileSync(join('static', sizesPath), 'utf8')).toBe(serializeSizes(sizes));
		const counts = Object.values(sizes).flatMap((types) => Object.values(types));
		expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_PER_TYPE);
	});

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
				for (const { id, period } of puzzles) {
					expect(decodePuzzleId(id).variantIndex, `#${id}`).toBe(index);
					// A special puzzle must be the one every player gets for its period.
					if (kind) expect(id, `#${id}`).toBe(specialPuzzleId(logic.id, index, kind, period!));
					else expect(period, `#${id}`).toBeUndefined();
				}

				for (const [path, file] of Object.entries(files)) {
					if (!('puzzles' in file) || !solveAgain(join('static', path))) continue;
					for (const { id, puzzle, period } of (file as BankFile<BasePuzzle>).puzzles) {
						expect(logic.isValidPuzzle(puzzle, variant), `#${id}`).toBe(true);
						expect(logic.countSolutions(puzzle, 2), `#${id}`).toEqual({ count: 1, finished: true });
						if (!checksDifficulty(kind, period)) continue;
						expect(logic.fitsDifficulty(puzzle, variant), `#${id} ${variant.difficulty}`).toBe(
							true
						);
					}
				}
			}, 120_000);
		});
	}
});
