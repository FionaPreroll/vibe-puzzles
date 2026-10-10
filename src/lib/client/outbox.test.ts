import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';
import {
	clearOutbox,
	MAX_SCORES,
	pending,
	pendingCount,
	queueSave,
	queueScore,
	saveSent,
	scoreSent
} from './outbox';
import { setQuotaHandler } from './storage';

let storage: MemoryStorage;

beforeEach(() => {
	storage = new MemoryStorage();
	vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
	vi.unstubAllGlobals();
	setQuotaHandler(() => false);
});

const solve = (puzzleId: number) => ({ game: 'tetroid', variant: '6n', puzzleId, timeMs: 1 });

describe('outbox', () => {
	it('keeps the newest version of each value', () => {
		expect(queueSave('save:a', { v: 1 }, 1)).toBe(true);
		queueSave('save:a', { v: 3 }, 3);
		queueSave('save:a', { v: 2 }, 2);
		queueSave('settings:b', { s: 1 }, 5);
		expect(pending().saves).toEqual([
			['save:a', { data: { v: 3 }, updatedAt: 3 }],
			['settings:b', { data: { s: 1 }, updatedAt: 5 }]
		]);
		expect(pendingCount()).toBe(2);
	});

	it('removes a sent value unless a newer one came in meanwhile', () => {
		queueSave('save:a', { v: 1 }, 1);
		queueSave('save:a', { v: 2 }, 2);
		saveSent('save:a', 1);
		expect(pendingCount()).toBe(1);
		saveSent('save:a', 2);
		expect(pendingCount()).toBe(0);
		// An empty outbox takes no storage.
		expect(storage.getItem('vp:outbox')).toBeNull();
	});

	it('keeps one solve per puzzle and only the newest ones', () => {
		queueScore(solve(1));
		queueScore({ ...solve(1), timeMs: 9 });
		queueScore(solve(2));
		expect(pending().scores).toEqual([solve(1), solve(2)]);
		scoreSent(solve(1));
		expect(pending().scores).toEqual([solve(2)]);
		for (let id = 3; id < MAX_SCORES + 10; id++) queueScore(solve(id));
		const { scores } = pending();
		expect(scores).toHaveLength(MAX_SCORES);
		expect(scores.at(-1)?.puzzleId).toBe(MAX_SCORES + 9);
	});

	it('never makes room by removing games when storage is full', () => {
		const handler = vi.fn(() => true);
		setQuotaHandler(handler);
		storage.full = true;
		expect(queueSave('save:a', {}, 1)).toBe(false);
		expect(queueScore(solve(1))).toBe(false);
		expect(handler).not.toHaveBeenCalled();
	});

	it('reads a damaged outbox as empty and can be cleared', () => {
		storage.setItem('vp:outbox', '{"saves":3,"scores":"x"}');
		expect(pending()).toEqual({ saves: [], scores: [] });
		queueSave('save:a', {}, 1);
		clearOutbox();
		expect(pendingCount()).toBe(0);
	});
});
