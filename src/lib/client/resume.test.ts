import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_LOGIC } from '../games/logic';
import { MemoryStorage } from '../../test/memory-storage';
import { latestUnfinished } from './resume';
import type { SavedGame } from './session.svelte';
import { save } from './storage';

const logic = GAME_LOGIC.pinwheel;
const puzzle = logic.generate(
	logic.variants.find((v) => v.key === '5n')!,
	7
);
const empty = logic.emptyState(puzzle);
const NOW = new Date('2026-10-08T14:00:00Z');

function game(variant: string, over: Partial<SavedGame> = {}): SavedGame {
	return {
		version: 1,
		puzzleId: 1,
		variant,
		puzzle,
		state: 'moved',
		checkpoints: [],
		currentCheckpoint: -1,
		solved: false,
		startedAt: 0,
		playMs: 0,
		updatedAt: 1,
		...over
	};
}

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('the game to continue', () => {
	it('is the most recently played unsolved one', () => {
		save('save:pinwheel:5n', game('5n', { updatedAt: 5 }));
		save('save:tetroid:6n', game('6n', { updatedAt: 9, solved: true }));
		save('save:pinwheel:7n', game('7n', { updatedAt: 7 }));
		expect(latestUnfinished(NOW)).toMatchObject({ gameId: 'pinwheel', save: { variant: '7n' } });
	});

	it('needs a move or a checkpoint', () => {
		save('save:pinwheel:5n', game('5n', { state: empty }));
		expect(latestUnfinished(NOW)).toBeNull();
		save('save:pinwheel:5n', game('5n', { state: empty, checkpoints: ['x'] }));
		expect(latestUnfinished(NOW)).not.toBeNull();
	});

	it('counts a special only in its own period', () => {
		save('save:pinwheel:daily:2026-10-07', game('daily', { updatedAt: 9 }));
		save('save:pinwheel:weekly:2026-W40', game('weekly', { updatedAt: 8 }));
		save('save:pinwheel:daily:archive', game('daily', { updatedAt: 7 }));
		expect(latestUnfinished(NOW)).toBeNull();
		save('save:pinwheel:daily:2026-10-08', game('daily', { updatedAt: 3 }));
		expect(latestUnfinished(NOW)?.save.updatedAt).toBe(3);
	});

	it('skips games and puzzle types that no longer exist, and broken saves', () => {
		save('save:chess:8n', game('8n', { updatedAt: 9 }));
		save('save:pinwheel:99n', game('99n', { updatedAt: 9 }));
		save('save:pinwheel:5n', game('5n', { puzzle: null }));
		expect(latestUnfinished(NOW)).toBeNull();
	});
});
