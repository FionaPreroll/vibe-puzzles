import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameModule } from '../../core/types';
import { encodePuzzleId } from '../../core/variants';
import { GAME_LOGIC } from '../../games/logic';
import { generateTetroid } from '../../games/tetroid/generator';
import { SHADED, type TetroidPuzzle, type TetroidState } from '../../games/tetroid/rules';
import { MemoryStorage } from '../../../test/memory-storage';
import { load, save } from '../storage';
import {
	cleanupSpecialSaves,
	freeSaveSpace,
	hasProgress,
	migrateSave,
	playableSave,
	remoteWins,
	SAVE_VERSION,
	type SavedGame
} from './saves';

const game = GAME_LOGIC.tetroid as unknown as GameModule<TetroidPuzzle, TetroidState>;
const variant = game.variants[0];
const { puzzle } = generateTetroid(6, 6, 'normal', 4242);
const empty = game.emptyState(puzzle);

function shaded(...cells: number[]): TetroidState {
	const state = game.emptyState(puzzle);
	for (const c of cells) state.marks[c] = SHADED;
	return state;
}

function saved(over: Partial<SavedGame<TetroidState>> = {}): SavedGame<TetroidState> {
	return {
		version: 1,
		puzzleId: encodePuzzleId(0, 4242),
		variant: variant.key,
		puzzle,
		state: shaded(0),
		checkpoints: [],
		currentCheckpoint: -1,
		solved: false,
		startedAt: 1000,
		playMs: 500,
		updatedAt: 2000,
		...over
	};
}

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('migrating saves', () => {
	it('keeps a current save as it is', () => {
		const s = saved({ ticket: 't', hints: 2, hinted: true, assisted: true, trial: empty });
		expect(migrateSave(s)).toEqual(s);
	});

	it('reads saves from before the version field and before `hints`', () => {
		const { version: _, ...old } = saved({ hinted: true });
		expect(migrateSave(old)).toMatchObject({ version: SAVE_VERSION, hints: 1, hinted: true });
		expect(migrateSave(saved({ hinted: false }))).toMatchObject({ hints: undefined });
	});

	it('fills in what an older or broken save lacks', () => {
		vi.useFakeTimers({ now: 5000, toFake: ['Date'] });
		try {
			const broken = {
				...saved(),
				puzzleId: 'x',
				checkpoints: 'x',
				currentCheckpoint: 1.5,
				solved: 1,
				startedAt: null,
				playMs: -5,
				ticket: 7,
				hints: -1,
				assisted: 'yes'
			};
			expect(migrateSave(broken)).toMatchObject({
				puzzleId: 0,
				checkpoints: [],
				currentCheckpoint: -1,
				solved: true,
				startedAt: 5000,
				playMs: 0,
				ticket: undefined,
				hints: undefined,
				assisted: true
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it('reads nothing that is no save, has no time, or comes from a newer version', () => {
		for (const raw of [null, 3, 'save', [saved()], {}, saved({ updatedAt: NaN })]) {
			expect(migrateSave(raw)).toBeNull();
		}
		expect(migrateSave({ ...saved(), version: 2 })).toBeNull();
	});
});

describe('playable saves', () => {
	it('need a valid puzzle of the type and a valid position', () => {
		expect(playableSave(game, variant, saved())).toMatchObject({ state: shaded(0) });
		expect(playableSave(game, variant, saved({ puzzle: { width: 6 } }))).toBeNull();
		const bigger = game.variants.find((v) => v.key === '8n')!;
		expect(playableSave(game, bigger, saved())).toBeNull();
		expect(playableSave(game, variant, saved({ state: { marks: [] } as never }))).toBeNull();
		expect(playableSave(game, variant, null)).toBeNull();
	});

	it('leave out broken checkpoints and trials, and point at a checkpoint that exists', () => {
		const s = playableSave(
			game,
			variant,
			saved({
				checkpoints: [shaded(1), 'x' as never, shaded(2)],
				currentCheckpoint: 2,
				trial: 'x' as never
			})
		);
		expect(s?.checkpoints).toEqual([shaded(1), shaded(2)]);
		expect(s?.currentCheckpoint).toBe(1);
		expect(s?.trial).toBeUndefined();
	});
});

describe('progress', () => {
	it('is a move, a checkpoint or a solve', () => {
		expect(hasProgress(game, saved({ state: empty }))).toBe(false);
		expect(hasProgress(game, saved())).toBe(true);
		expect(hasProgress(game, saved({ state: empty, checkpoints: [empty] }))).toBe(true);
		expect(hasProgress(game, saved({ state: empty, solved: true }))).toBe(true);
	});

	it('counts a cross a helper placed', () => {
		const state = game.emptyState(puzzle);
		state.auto[0] = 1;
		expect(hasProgress(game, saved({ state }))).toBe(true);
	});
});

describe('which save wins between devices', () => {
	const progress = (s: SavedGame<TetroidState>) => hasProgress(game, s);
	const other = { puzzleId: 99 };

	it.each([
		// [what is here, what comes from the other device, does it take over?]
		['nothing', saved(), true],
		['nothing', saved({ state: empty }), false],
		['nothing', saved({ solved: true }), false],
		// The same puzzle, saved there before it was opened here.
		['an untouched game', saved({ updatedAt: 1 }), false],
		['an older game', saved({ ...other, updatedAt: 3000 }), true],
		['an older game', saved({ updatedAt: 3000 }), true],
		['a newer game', saved({ ...other, updatedAt: 1000 }), false],
		['a game of the same time', saved({ ...other, updatedAt: 2000 }), false],
		['an untouched game', saved({ ...other, updatedAt: 1 }), true],
		['an older game', saved({ ...other, updatedAt: 3000, solved: true }), false],
		['an older game', saved({ ...other, updatedAt: 3000, state: empty }), false],
		// Every move taken back there (undone, or started over).
		['an older game', saved({ updatedAt: 3000, state: empty }), true],
		['a newer game', saved({ updatedAt: 1000, state: empty }), false],
		['an untouched game', saved({ updatedAt: 3000, state: empty }), false]
	] as const)('%s here, and from there %o: %s', (here, remote, wins) => {
		const local = {
			nothing: null,
			'an untouched game': saved({ state: empty }),
			'an older game': saved({ updatedAt: 2000 }),
			'a newer game': saved({ updatedAt: 2000 }),
			'a game of the same time': saved({ updatedAt: 2000 })
		}[here];
		expect(remoteWins(local, remote, progress)).toBe(wins);
	});

	it('never takes an older save of the same untouched game', () => {
		const local = saved({ state: empty, updatedAt: 2000 });
		expect(remoteWins(local, saved({ updatedAt: 1000 }), () => true)).toBe(false);
		expect(remoteWins(local, saved({ updatedAt: 1000 }), (s) => s !== local)).toBe(false);
	});

	it('tells server puzzles apart by their ticket while their ID is secret', () => {
		const local = saved({ puzzleId: 0, ticket: 'a', state: empty, updatedAt: 2000 });
		const remote = saved({ puzzleId: 0, ticket: 'b', updatedAt: 1000 });
		expect(remoteWins(local, remote, progress)).toBe(true);
		const same = { ...remote, ticket: 'a' };
		expect(remoteWins(local, same, (s) => s === same)).toBe(false);
	});
});

describe('housekeeping', () => {
	it('removes saves of special periods that are over, keeps everything else', () => {
		const day = 86400000;
		const now = Date.UTC(2026, 9, 11);
		save('save:tetroid:daily:2026-10-01', saved({ updatedAt: now - 40 * day }));
		save('save:tetroid:daily:2026-10-10', saved({ updatedAt: now - day }));
		save('save:tetroid:daily:archive', saved({ updatedAt: 0 }));
		save('save:tetroid:6n', saved({ updatedAt: 0 }));
		cleanupSpecialSaves(now);
		expect(load('save:tetroid:daily:2026-10-01', null)).toBeNull();
		expect(load('save:tetroid:daily:2026-10-10', null)).not.toBeNull();
		expect(load('save:tetroid:daily:archive', null)).not.toBeNull();
		expect(load('save:tetroid:6n', null)).not.toBeNull();
	});

	it('makes room with solved games first, then the oldest if the player agrees', () => {
		save('save:tetroid:6n', saved({ updatedAt: 1 }));
		save('save:tetroid:6h', saved({ updatedAt: 2, solved: true }));
		save('save:tetroid:8n', saved({ updatedAt: 3 }));
		const agree = vi.fn(() => true);
		expect(freeSaveSpace('save:tetroid:6n', agree)).toBe(true);
		expect(agree).not.toHaveBeenCalled();
		expect(load('save:tetroid:6h', null)).toBeNull();
		expect(freeSaveSpace('save:tetroid:6n', () => false)).toBe(false);
		expect(freeSaveSpace('save:tetroid:6n', agree)).toBe(true);
		expect(load('save:tetroid:8n', null)).toBeNull();
		expect(load('save:tetroid:6n', null)).not.toBeNull();
		expect(freeSaveSpace('save:tetroid:6n', agree)).toBe(false);
	});

	it('takes a save without a time for the oldest', () => {
		save('save:tetroid:6h', saved({ updatedAt: 5 }));
		save('save:tetroid:8n', { ...saved(), updatedAt: undefined });
		save('save:tetroid:8h', saved({ updatedAt: 9 }));
		expect(freeSaveSpace('save:tetroid:6n', () => true)).toBe(true);
		expect(load('save:tetroid:8n', null)).toBeNull();
		expect(freeSaveSpace('save:tetroid:6n', () => true)).toBe(true);
		expect(load('save:tetroid:6h', null)).toBeNull();
		expect(load('save:tetroid:8h', null)).not.toBeNull();
	});

	it('takes a save of a newer version for neither broken nor solved', () => {
		save('save:tetroid:6n', { ...saved({ updatedAt: Date.now() }), version: 2 });
		save('save:tetroid:daily:2026-10-10', { ...saved({ updatedAt: Date.now() }), version: 2 });
		cleanupSpecialSaves();
		expect(freeSaveSpace('save:tetroid:8n', () => false)).toBe(false);
		expect(load('save:tetroid:6n', null)).not.toBeNull();
		expect(load('save:tetroid:daily:2026-10-10', null)).not.toBeNull();
	});
});
