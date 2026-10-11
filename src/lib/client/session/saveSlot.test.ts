import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameModule } from '../../core/types';
import { GAME_LOGIC } from '../../games/logic';
import { generateTetroid } from '../../games/tetroid/generator';
import { SHADED, type TetroidPuzzle, type TetroidState } from '../../games/tetroid/rules';
import { MemoryStorage } from '../../../test/memory-storage';
import * as api from '../api';
import { load, save } from '../storage';
import { PUSH_DELAY_MS, SaveSlot, type GameRecord } from './saveSlot';
import type { SavedGame } from './saves';

vi.mock('../api', () => ({ pushSave: vi.fn(async () => undefined) }));

const game = GAME_LOGIC.tetroid as unknown as GameModule<TetroidPuzzle, TetroidState>;
const variant = game.variants[0];
const KEY = 'save:tetroid:6n';
const { puzzle } = generateTetroid(6, 6, 'normal', 4242);

function record(...cells: number[]): GameRecord<TetroidState> {
	const state = game.emptyState(puzzle);
	for (const c of cells) state.marks[c] = SHADED;
	return {
		puzzleId: 1,
		variant: variant.key,
		puzzle,
		state,
		checkpoints: [],
		currentCheckpoint: -1,
		solved: false,
		startedAt: 0,
		playMs: 0
	};
}

const stored = () => load<SavedGame<TetroidState> | null>(KEY, null);

function slot() {
	const s = new SaveSlot(game);
	s.select(KEY);
	s.attachBoard();
	return s;
}

beforeEach(() => {
	vi.stubGlobal('localStorage', new MemoryStorage());
	vi.useFakeTimers({ now: 10_000, toFake: ['Date', 'setTimeout', 'clearTimeout'] });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('save slot', () => {
	it('holds the board only once a game of the selected slot is on it', () => {
		const s = new SaveSlot(game);
		expect(s.holdsBoard).toBe(false);
		s.select(KEY);
		expect(s.holdsBoard).toBe(false);
		s.attachBoard();
		expect(s.holdsBoard).toBe(true);
		s.select('save:tetroid:8n');
		expect(s.holdsBoard).toBe(false);
		s.attachBoard(false);
		s.select(KEY);
		expect(s.holdsBoard).toBe(false);
	});

	it('writes each change with a time of its own, and a flush with the last one', () => {
		const s = slot();
		s.write(record(0), true);
		s.write(record(0, 1), true);
		expect(stored()).toMatchObject({ version: 1, updatedAt: 10_001 });
		s.write(record(0, 1), false);
		expect(stored()?.updatedAt).toBe(10_001);
	});

	it('uploads a game with progress once, shortly after the last change', () => {
		const s = slot();
		s.write(record(), true);
		vi.advanceTimersByTime(PUSH_DELAY_MS);
		expect(api.pushSave).not.toHaveBeenCalled();
		s.write(record(0), true);
		vi.advanceTimersByTime(PUSH_DELAY_MS - 1);
		s.write(record(0, 1), true);
		vi.advanceTimersByTime(PUSH_DELAY_MS);
		expect(api.pushSave).toHaveBeenCalledTimes(1);
		expect(api.pushSave).toHaveBeenCalledWith(KEY, stored(), stored()?.updatedAt);
	});

	it('still uploads the last game when another slot is selected, unless cancelled', () => {
		const s = slot();
		s.write(record(0), true);
		s.select('save:tetroid:8n');
		vi.advanceTimersByTime(PUSH_DELAY_MS);
		expect(api.pushSave).toHaveBeenCalledWith(KEY, expect.anything(), expect.any(Number));
		s.select(KEY);
		s.write(record(0, 1), true);
		s.cancelPush();
		vi.advanceTimersByTime(PUSH_DELAY_MS);
		expect(api.pushSave).toHaveBeenCalledTimes(1);
	});

	it('notices a save another tab wrote since', () => {
		const s = slot();
		s.write(record(0), true);
		expect(s.changedElsewhere(variant)).toBeNull();
		save(KEY, { ...stored(), state: record(5).state, updatedAt: 20_000 });
		expect(s.changedElsewhere(variant)?.state).toEqual(record(5).state);
		s.adopt(stored()!);
		expect(s.changedElsewhere(variant)).toBeNull();
		// A broken save is nobody's game.
		save(KEY, { broken: true });
		expect(s.changedElsewhere(variant)).toBeNull();
	});

	it('lets a new game take the slot, whatever is in it', () => {
		const s = slot();
		save(KEY, { ...record(5), version: 1, updatedAt: 30_000 });
		s.claim();
		expect(s.changedElsewhere(variant)).toBeNull();
	});

	it("keeps another device's game it had no room for from counting as another tab's", () => {
		const s = slot();
		s.write(record(0), true);
		(localStorage as MemoryStorage).full = true;
		s.store({ ...record(7), version: 1, updatedAt: 50_000 });
		expect(stored()?.updatedAt).toBe(10_000);
		expect(s.changedElsewhere(variant)).toBeNull();
		// The next change is newer than the other device's game.
		(localStorage as MemoryStorage).full = false;
		s.write(record(7, 8), true);
		expect(stored()?.updatedAt).toBe(50_001);
	});
});
