import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';
import { decodePuzzleId, encodePuzzleId, parsePuzzleId } from '../core/variants';
import { GAMES } from '../games/index';
import { parseBackup } from './backup';
import { pending, pendingCount, queueSave, queueScore, saveSent, scoreSent } from './outbox';
import { latestUnfinished } from './resume';

/**
 * What the app finds in storage (written by older versions, other tabs or a restored backup) and
 * in links can be anything. None of it may break a page.
 */

const RUNS = {
	numRuns: Number(process.env.FUZZ_RUNS ?? 500),
	seed: Number(process.env.FUZZ_SEED ?? 77)
};

const json = fc
	.letrec((tie) => ({
		value: fc.oneof(
			{ depthSize: 'small' },
			fc.oneof(fc.integer(), fc.double(), fc.string(), fc.boolean(), fc.constant(null)),
			tie('array'),
			tie('object')
		),
		array: fc.array(tie('value'), { maxLength: 4 }),
		object: fc.dictionary(
			fc.oneof(
				fc.string(),
				fc.constantFrom('saves', 'scores', 'data', 'updatedAt', 'game', 'variant', 'puzzleId')
			),
			tie('value'),
			{ maxKeys: 4 }
		)
	}))
	.value.map((v) => JSON.parse(JSON.stringify(v)) as unknown);

const ids = [...GAMES.map((g) => g.id), '__proto__', 'constructor', 'toString', 'x'];
/** A storage key as the app writes them, for games and types that may not exist. */
const key = fc.oneof(
	fc
		.tuple(
			fc.constantFrom(...ids),
			fc.constantFrom('6n', '5n', '9e', 'daily', 'constructor', 'x'),
			fc.constantFrom('', ':archive', ':2026-10-10', ':')
		)
		.map(([g, v, slot]) => `save:${g}:${v}${slot}`),
	fc.constantFrom('outbox', 'player', 'settings:tetroid'),
	fc.string()
);
/** A stored value: JSON, or text that is not. */
const stored = fc.oneof(
	json.map((v) => JSON.stringify(v)),
	fc.string()
);

let storage: MemoryStorage;
beforeEach(() => {
	storage = new MemoryStorage();
	vi.stubGlobal('localStorage', storage);
});
afterEach(() => {
	vi.unstubAllGlobals();
});

function fill(entries: [string, string][]) {
	storage.clear();
	for (const [k, v] of entries) storage.setItem(`vp:${k}`, v);
}

describe('client fuzzing', () => {
	it('finds the game to continue in any storage', () => {
		fc.assert(
			fc.property(fc.array(fc.tuple(key, stored), { maxLength: 6 }), (entries) => {
				fill(entries);
				const found = latestUnfinished();
				expect(found === null || GAMES.some((g) => g.id === found.gameId)).toBe(true);
			}),
			RUNS
		);
	});

	it('keeps the outbox working whatever it held', () => {
		fc.assert(
			fc.property(
				stored,
				fc.string(),
				json,
				fc.record({ game: fc.string(), variant: fc.string(), puzzleId: fc.integer() }),
				(outbox, k, data, score) => {
					fill([['outbox', outbox]]);
					const before = pendingCount();
					expect(pending().saves.length + pending().scores.length).toBe(before);
					queueSave(k, data, 5);
					queueScore(score);
					expect(pending().saves).toContainEqual([k, expect.objectContaining({ updatedAt: 5 })]);
					saveSent(k, 5);
					scoreSent(score);
					for (const s of pending().scores) scoreSent(s);
					for (const [k2, s] of pending().saves) saveSent(k2, s.updatedAt);
					expect(pendingCount()).toBe(0);
				}
			),
			RUNS
		);
	});

	it('opens only puzzle IDs of a game type', () => {
		fc.assert(
			fc.property(
				fc.oneof(
					fc.string(),
					fc.double().map(String),
					fc.bigInt({ min: -(2n ** 60n), max: 2n ** 60n }).map(String)
				),
				fc.integer({ min: 1, max: 16 }),
				(text, types) => {
					const id = parsePuzzleId(text, types);
					if (id === undefined) return;
					expect(Number.isSafeInteger(id) && id > 0).toBe(true);
					const { variantIndex, seed } = decodePuzzleId(id);
					expect(variantIndex).toBeLessThan(types);
					expect(encodePuzzleId(variantIndex, seed)).toBe(id);
				}
			),
			RUNS
		);
		for (const game of GAMES) {
			game.variants.forEach((_, i) => {
				const id = encodePuzzleId(i, 12345);
				expect(parsePuzzleId(String(id), game.variants.length)).toBe(id);
			});
		}
	});

	it('reads any backup file without throwing', () => {
		fc.assert(
			fc.property(
				fc.oneof(
					fc.string(),
					json.map((v) => JSON.stringify(v)),
					json.map((data) =>
						JSON.stringify({
							format: 'vibe-puzzles-backup',
							version: 1,
							exportedAt: '2026-10-10T10:00:00Z',
							app: { version: '1', commit: 'x' },
							data
						})
					)
				),
				(text) => {
					const res = parseBackup(text);
					expect(typeof res.ok).toBe('boolean');
				}
			),
			RUNS
		);
	});
});
