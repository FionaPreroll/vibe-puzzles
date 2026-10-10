import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withCommon } from '../core/settings';
import type { GameModule } from '../core/types';
import {
	decodePuzzleId,
	encodePuzzleId,
	periodKey,
	specialSeed,
	SPECIAL_RETENTION_DAYS
} from '../core/variants';
import { GAME_LOGIC } from '../games/logic';
import { sudoku } from '../games/sudoku';
import { tetroid } from '../games/tetroid';
import { generateTetroid } from '../games/tetroid/generator';
import { EMPTY, SHADED, type TetroidPuzzle, type TetroidState } from '../games/tetroid/rules';
import { MemoryStorage } from '../../test/memory-storage';
import * as api from './api';
import * as bank from './bank';
import { generate } from './generate';
import { cleanupSpecialSaves, freeSaveSpace, GameSession, MAX_CHECKPOINTS } from './session.svelte';
import { GameSettings } from './settings.svelte';
import { getStats } from './stats';
import { keys, load, save, setQuotaHandler } from './storage';

vi.mock('./api', () => ({
	currentPlayer: vi.fn(() => null),
	serverPuzzles: vi.fn(async () => false),
	issuePuzzle: vi.fn(),
	pullSave: vi.fn(async () => null),
	pushSave: vi.fn(async () => undefined),
	submitScore: vi.fn(async () => null)
}));
vi.mock('./bank', () => ({
	loadPuzzleSource: vi.fn(() => 'local'),
	pickFromBank: vi.fn(async () => null),
	findInBank: vi.fn(async () => null)
}));
vi.mock('./generate', () => ({
	generate: vi.fn(async (game: string, variant: number, seed: number) => {
		const logic = GAME_LOGIC[game];
		return logic.generate(logic.variants[variant], seed);
	})
}));

type Session = GameSession<TetroidPuzzle, TetroidState>;

const game = GAME_LOGIC.tetroid as unknown as GameModule<TetroidPuzzle, TetroidState>;
const DAILY = game.variants.findIndex((v) => v.key === 'daily');
const SEED = 4242;
const ID = encodePuzzleId(0, SEED);
const { puzzle, solution } = generateTetroid(6, 6, 'normal', SEED);

const solvedState = (): TetroidState => ({
	marks: solution.map((s) => (s ? SHADED : EMPTY)),
	auto: solution.map(() => 0)
});

/** The empty board with the given cells shaded. */
function shaded(...cells: number[]): TetroidState {
	const state = game.emptyState(puzzle);
	for (const c of cells) state.marks[c] = SHADED;
	return state;
}

function session(values: Record<string, boolean> = {}): Session {
	const settings = new GameSettings('tetroid', withCommon([]));
	Object.assign(settings.values, values);
	return new GameSession(game, settings);
}

async function opened(values: Record<string, boolean> = {}, puzzleId = ID): Promise<Session> {
	const s = session(values);
	await s.open('6n', { puzzleId });
	return s;
}

beforeEach(() => {
	vi.stubGlobal('localStorage', new MemoryStorage());
	vi.useFakeTimers({
		now: Date.UTC(2026, 9, 7, 12),
		toFake: ['Date', 'setTimeout', 'clearTimeout']
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('opening a puzzle', () => {
	it('generates a new puzzle on the device and saves it', async () => {
		const s = session();
		await s.open('6n');
		expect(s.loading).toBe(false);
		expect(s.source).toBe('local');
		expect(decodePuzzleId(s.puzzleId).variantIndex).toBe(0);
		expect(s.state).toEqual(game.emptyState(s.puzzle!));
		expect(load<{ puzzleId: number } | null>('save:tetroid:6n', null)?.puzzleId).toBe(s.puzzleId);
		// The next puzzle is prepared in the background.
		expect(generate).toHaveBeenCalledTimes(2);
	});

	it('opens a requested puzzle and its type', async () => {
		const s = session();
		await s.open('8n', { puzzleId: ID });
		expect(s.variant.key).toBe('6n');
		expect(s.puzzle).toEqual(puzzle);
		expect(s.puzzleId).toBe(ID);
	});

	it('falls back to the first type for an unknown one', async () => {
		const s = session();
		await s.open('nope');
		expect(s.variant.key).toBe('6n');
	});

	it('uses a stored collection puzzle instead of generating it', async () => {
		vi.mocked(bank.findInBank).mockResolvedValueOnce(puzzle);
		const s = session();
		await s.open('6n', { puzzleId: ID });
		expect(s.puzzle).toEqual(puzzle);
		expect(generate).toHaveBeenCalledTimes(1); // only the prefetch
	});

	it('takes a new puzzle from the collection when the player chose it', async () => {
		vi.mocked(bank.loadPuzzleSource).mockReturnValueOnce('bank');
		vi.mocked(bank.pickFromBank).mockResolvedValueOnce({ id: ID, puzzle });
		const s = session();
		await s.open('6n');
		expect(s.source).toBe('bank');
		expect(s.puzzleId).toBe(ID);
	});

	it('opens a shared position', async () => {
		const s = session();
		await s.open('6n', { puzzleId: ID, shared: game.encodeState(shaded(0, 1)) });
		expect(s.state?.marks.slice(0, 3)).toEqual([SHADED, SHADED, EMPTY]);
	});

	it('resumes the saved game', async () => {
		const s = await opened();
		s.move(shaded(5), ['5']);
		const again = session();
		await again.open('6n');
		expect(again.puzzleId).toBe(ID);
		expect(again.state?.marks[5]).toBe(SHADED);
	});

	it('reports a puzzle that cannot be created', async () => {
		vi.mocked(generate).mockRejectedValueOnce(new Error('boom'));
		const s = session();
		await s.open('6n', { puzzleId: ID });
		expect(s.message).toEqual({ kind: 'error', text: expect.stringContaining('boom') });
		// Not stuck loading: the page offers to try again, which opens the same puzzle.
		expect(s.loading).toBe(false);
		expect(s.puzzle).toBeNull();
		await s.retry();
		expect(s.puzzleId).toBe(ID);
		expect(s.puzzle).toEqual(puzzle);
	});

	it('keeps the current game when the next puzzle cannot be created', async () => {
		const s = await opened();
		s.move(shaded(3), ['3']);
		vi.mocked(generate).mockRejectedValueOnce(new Error('boom'));
		await s.newPuzzle();
		expect(s.loading).toBe(false);
		expect(s.puzzleId).toBe(ID);
		expect(s.state?.marks[3]).toBe(SHADED);
		expect(s.runningSince).not.toBeNull();
	});

	it('never saves the previous puzzle into the slot of another type', async () => {
		const s = await opened();
		s.move(shaded(3), ['3']);
		vi.mocked(generate).mockRejectedValueOnce(new Error('boom'));
		await s.open('6h');
		expect(s.puzzle).toBeNull();
		s.flush();
		expect(load('save:tetroid:6h', null)).toBeNull();
		expect(load<{ puzzleId: number } | null>('save:tetroid:6n', null)?.puzzleId).toBe(ID);
	});

	it('opens the special puzzle of the current period', async () => {
		const s = session();
		await s.open('daily');
		const today = specialSeed('tetroid', 'daily', periodKey('daily'));
		expect(s.puzzleId).toBe(encodePuzzleId(DAILY, today));
		expect(keys('save:')).toEqual([`save:tetroid:daily:${periodKey('daily')}`]);
		// An older special is kept apart from the current one.
		await s.open('daily', { puzzleId: encodePuzzleId(DAILY, 7) });
		expect(keys('save:')).toContain('save:tetroid:daily:archive');
		// "New puzzle" on an older special goes back to the current one.
		await s.newPuzzle();
		expect(s.puzzleId).toBe(encodePuzzleId(DAILY, today));
	});

	it('continues a special type with a regular puzzle of its size and difficulty', async () => {
		const s = session();
		await s.open('daily');
		const started = game.emptyState(s.puzzle!);
		started.marks[3] = SHADED;
		s.move(started, ['3']);
		const daily = s.puzzleId;
		await s.newPuzzle();
		expect(s.variant).toMatchObject({ key: '10n', width: 10, difficulty: 'normal' });
		expect(s.variant.special).toBeUndefined();
		// The special game is kept for later.
		await s.open('daily');
		expect(s.puzzleId).toBe(daily);
		expect(s.state).toEqual(started);
	});
});

describe('unfinished games', () => {
	const OTHER = encodePuzzleId(0, SEED + 1);

	it('knows when "New puzzle" would throw a started game away', async () => {
		const s = await opened();
		expect(s.newPuzzleDiscards).toBe(false);
		s.move(shaded(3), ['3']);
		expect(s.newPuzzleDiscards).toBe(true);
		s.move(solvedState(), []);
		expect(s.solved).toBe(true);
		expect(s.newPuzzleDiscards).toBe(false);
	});

	it('counts a checkpoint as a start, but not a special type, which keeps its game', async () => {
		const s = await opened();
		s.addCheckpoint();
		expect(s.newPuzzleDiscards).toBe(true);
		const daily = session();
		await daily.open('daily');
		daily.move(shaded(3), ['3']);
		expect(daily.newPuzzleDiscards).toBe(false);
	});

	it('knows when opening a puzzle would replace a started game of its type', async () => {
		const s = await opened();
		expect(s.replacesGame('6n', { puzzleId: OTHER })).toBe(false);
		s.move(shaded(3), ['3']);
		expect(s.replacesGame('6n', { puzzleId: OTHER })).toBe(true);
		// The same puzzle continues; a shared position of it replaces the game.
		expect(s.replacesGame('6n', { puzzleId: ID })).toBe(false);
		expect(s.replacesGame('6n', { puzzleId: ID, shared: 'x' })).toBe(true);
		// Other types keep their own game, and the type comes from the ID.
		expect(s.replacesGame('6h', {})).toBe(false);
		expect(s.replacesGame('6h', { puzzleId: OTHER })).toBe(true);
		s.move(solvedState(), []);
		expect(s.replacesGame('6n', { puzzleId: OTHER })).toBe(false);
	});
});

describe('server puzzles', () => {
	beforeEach(() => {
		vi.mocked(api.serverPuzzles).mockResolvedValue(true);
	});

	it('plays a puzzle issued by the server on its clock', async () => {
		const issuedAt = Date.now() - 5000;
		vi.mocked(api.issuePuzzle).mockResolvedValueOnce({
			ticket: 't1',
			puzzle,
			issuedAt,
			puzzleId: null
		});
		const s = session();
		await s.open('6n');
		expect(s).toMatchObject({ source: 'server', ticket: 't1', puzzleId: 0, startedAt: issuedAt });
		expect(s.elapsed(Date.now())).toBe(5000);
		// Starting over keeps the server's clock.
		s.startOver();
		expect(s.startedAt).toBe(issuedAt);
		expect(generate).not.toHaveBeenCalled();
	});

	it('falls back to a local puzzle when the server fails', async () => {
		vi.mocked(api.issuePuzzle).mockRejectedValueOnce(new Error('503'));
		const s = session();
		await s.open('6n');
		expect(s.source).toBe('local');
		expect(s.message?.kind).toBe('info');
	});

	it('plays requested puzzles locally', async () => {
		const s = await opened();
		expect(api.issuePuzzle).not.toHaveBeenCalled();
		expect(s.source).toBe('local');
	});
});

describe('moves and history', () => {
	it('undoes and redoes moves', async () => {
		const s = await opened({ autoSubmit: false });
		s.move(shaded(0), ['0']);
		s.move(shaded(0, 1), ['1']);
		expect(s.lastChange).toEqual(new Set(['1']));
		// A move that changes nothing is not recorded.
		s.move(shaded(0, 1), []);
		expect(s.past).toHaveLength(2);
		s.undo();
		expect(s.state).toEqual(shaded(0));
		s.redo();
		expect(s.state).toEqual(shaded(0, 1));
		s.redo();
		s.undo();
		s.undo();
		s.undo();
		expect(s.state).toEqual(game.emptyState(puzzle));
		expect(s.future).toHaveLength(2);
		s.move(shaded(3), ['3']);
		expect(s.future).toEqual([]);
	});

	it('ignores moves while loading or solved', async () => {
		const s = session();
		s.move(shaded(0), []);
		expect(s.state).toBeNull();
		const done = await opened();
		done.move(solvedState(), []);
		expect(done.solved).toBe(true);
		done.move(shaded(0), []);
		expect(done.state).toEqual(solvedState());
	});

	it('starts over', async () => {
		const s = await opened({ autoSubmit: false });
		s.move(shaded(0), []);
		s.startOver();
		expect(s.state).toEqual(game.emptyState(puzzle));
		expect(s.past).toEqual([]);
	});
});

describe('checkpoints', () => {
	it('adds, overwrites, loads and deletes checkpoints', async () => {
		const s = await opened({ autoSubmit: false });
		s.move(shaded(0), []);
		s.saveCheckpoint();
		expect(s.checkpoints).toEqual([shaded(0)]);
		s.move(shaded(0, 1), []);
		s.saveCheckpoint();
		expect(s.checkpoints).toEqual([shaded(0, 1)]);
		s.move(shaded(2), []);
		s.addCheckpoint();
		expect(s.currentCheckpoint).toBe(1);

		s.loadCheckpoint(0);
		expect(s.state).toEqual(shaded(0, 1));
		s.undo();
		expect(s.state).toEqual(shaded(2));
		s.loadCheckpoint(5);
		expect(s.currentCheckpoint).toBe(0);

		s.deleteCheckpoint(0);
		expect(s.checkpoints).toEqual([shaded(2)]);
		expect(s.currentCheckpoint).toBe(0);
		s.deleteCheckpoint(3);
		s.deleteCheckpoint(0);
		expect(s.currentCheckpoint).toBe(-1);
	});

	it(`keeps at most ${MAX_CHECKPOINTS}`, async () => {
		const s = await opened();
		for (let i = 0; i < MAX_CHECKPOINTS + 2; i++) s.addCheckpoint();
		expect(s.checkpoints).toHaveLength(MAX_CHECKPOINTS);
	});
});

describe('timers', () => {
	it('counts personal time only while the page is active', async () => {
		const s = await opened({ autoSubmit: false });
		vi.advanceTimersByTime(1000);
		s.setActive(false);
		vi.advanceTimersByTime(5000);
		s.setActive(true);
		vi.advanceTimersByTime(500);
		expect(s.personal(Date.now())).toBe(1500);
		expect(s.elapsed(Date.now())).toBe(6500);
	});

	it('keeps counting in the background when the timer is hidden', async () => {
		const s = await opened({ hideTimer: true });
		s.setActive(false);
		vi.advanceTimersByTime(2000);
		expect(s.personal(Date.now())).toBe(2000);
	});

	it('pauses the personal timer by hand', async () => {
		const s = await opened({ personalTimer: true, autoSubmit: false });
		vi.advanceTimersByTime(1000);
		s.setManualPause(true);
		expect(s.paused).toBe(true);
		expect(s.readonly).toBe(true);
		vi.advanceTimersByTime(3000);
		s.setManualPause(false);
		expect(s.personal(Date.now())).toBe(1000);
		s.flush();
		expect(load<{ playMs: number } | null>('save:tetroid:6n', null)?.playMs).toBe(1000);
	});
});

describe('solving', () => {
	it('says so when the puzzle is not solved yet', async () => {
		const s = await opened();
		await s.submit();
		expect(s.solved).toBe(false);
		expect(s.message?.kind).toBe('error');
	});

	it('records an automatic solve and uploads it', async () => {
		vi.mocked(api.submitScore).mockResolvedValueOnce({
			ok: true,
			code: 'ranked',
			message: '',
			timeMs: 30_000,
			bestMs: 20_000,
			rank: 2,
			total: 9
		});
		const s = await opened();
		vi.advanceTimersByTime(30_000);
		s.move(solvedState(), []);
		await vi.waitFor(() => expect(s.submitting).toBe(false));
		expect(s.solved).toBe(true);
		expect(s.finalMs).toBe(30_000);
		expect(api.submitScore).toHaveBeenCalledWith(
			expect.objectContaining({
				game: 'tetroid',
				variant: '6n',
				puzzleId: ID,
				answer: solution.join(''),
				competitive: true
			})
		);
		expect(s.message?.text).toBe(
			'Solved in 00:30! Rank 2 of 9 on 6×6 Normal. Your best is 00:20.000.'
		);
		expect(getStats('tetroid', '6n').solved).toBe(1);
		expect(s.elapsed(Date.now() + 1000)).toBe(30_000);
		expect(s.personal(Date.now() + 1000)).toBe(30_000);
	});

	it.each([
		[{ ok: false, code: 'wrong' }, 'error', 'That is not the solution yet.'],
		[{ ok: true, code: 'repeat' }, 'success', '(You solved this puzzle before.)'],
		[{ ok: true, code: 'personal' }, 'success', 'Personal timer: not ranked.'],
		[{ ok: true, code: 'local' }, 'success', 'only puzzles from the server are ranked'],
		[{ ok: true, code: 'hinted' }, 'success', 'with a hint: not ranked'],
		[{ ok: true, code: 'expired' }, 'success', 'no longer keeps this old puzzle'],
		[{ ok: true, code: 'ranked', rank: 1, total: 1 }, 'success', 'Rank 1 of 1'],
		[{ ok: true, message: 'From the server' }, 'success', 'From the server']
	] as const)('shows the server answer %o', async (res, kind, text) => {
		vi.mocked(api.submitScore).mockResolvedValueOnce({ message: 'From the server', ...res });
		const s = await opened({ autoSubmit: false });
		s.move(solvedState(), []);
		await s.submit();
		expect(s.message).toEqual({ kind, text: expect.stringContaining(text) });
	});

	it.each([true, false])(
		'accepts a solution the game takes as an alternative (autoSubmit %s)',
		async (autoSubmit) => {
			// A game that also takes the solution with its first shaded cell left out, and fills it in.
			const first = solution.indexOf(1);
			const almost = solvedState();
			almost.marks[first] = EMPTY;
			const lenient: GameModule<TetroidPuzzle, TetroidState> = {
				...game,
				acceptAlternative: (_p, state) =>
					JSON.stringify(state.marks) === JSON.stringify(almost.marks) ? solvedState() : null
			};
			const settings = new GameSettings('tetroid', withCommon([]));
			settings.values.autoSubmit = autoSubmit;
			const s = new GameSession(lenient, settings);
			await s.open('6n', { puzzleId: ID });
			s.move(shaded(first), []);
			await s.submit();
			expect(s.solved).toBe(false);
			s.move(almost, []);
			if (!autoSubmit) {
				expect(s.solved).toBe(false);
				await s.submit();
			}
			await vi.waitFor(() => expect(s.submitting).toBe(false));
			expect(s.solved).toBe(true);
			// The board shows the solution the game made of it, and that is what is submitted.
			expect(s.state).toEqual(solvedState());
			expect(api.submitScore).toHaveBeenCalledWith(
				expect.objectContaining({ answer: solution.join('') })
			);
		}
	);

	it('reveals the ID of a server puzzle once solved', async () => {
		vi.mocked(api.serverPuzzles).mockResolvedValueOnce(true);
		vi.mocked(api.issuePuzzle).mockResolvedValueOnce({
			ticket: 't1',
			puzzle,
			issuedAt: Date.now(),
			puzzleId: null
		});
		vi.mocked(api.submitScore).mockResolvedValueOnce({ ok: true, message: '', puzzleId: ID });
		const s = session({ personalTimer: true });
		await s.open('6n');
		s.move(solvedState(), []);
		await vi.waitFor(() => expect(s.puzzleId).toBe(ID));
		expect(api.submitScore).toHaveBeenCalledWith(
			expect.objectContaining({ ticket: 't1', competitive: false })
		);
		expect(load<{ puzzleId: number } | null>('save:tetroid:6n', null)?.puzzleId).toBe(ID);
	});

	it('keeps the solve when the upload fails', async () => {
		vi.mocked(api.submitScore).mockRejectedValueOnce(new Error('offline'));
		const s = await opened();
		s.move(solvedState(), []);
		await vi.waitFor(() => expect(s.submitting).toBe(false));
		expect(s.solved).toBe(true);
		expect(s.message).toEqual({ kind: 'info', text: expect.stringContaining('offline') });
	});

	it('breaks the streak when a started puzzle is abandoned', async () => {
		const s = await opened();
		s.move(solvedState(), []);
		await vi.waitFor(() => expect(s.submitting).toBe(false));
		expect(getStats('tetroid', '6n').streak).toBe(1);
		await s.newPuzzle();
		s.move(shaded(0), []);
		await s.newPuzzle();
		expect(getStats('tetroid', '6n').streak).toBe(0);
	});
});

describe('hints', () => {
	async function hinting(): Promise<Session> {
		const settings = new GameSettings('tetroid', withCommon([]));
		const s = new GameSession(tetroid, settings);
		await s.open('6n', { puzzleId: ID });
		return s;
	}

	it('point at the next step until the next change; the game counts as hinted', async () => {
		const s = await hinting();
		s.showHint();
		expect(s.hint?.kind).toBe('step');
		expect(s.hint?.spotlight.length).toBeGreaterThan(0);
		expect(s.message?.kind).toBe('info');
		expect(s.message?.text).not.toContain('games.tetroid');
		expect(s.hinted).toBe(true);
		s.move(shaded(solution.indexOf(1)), []);
		expect(s.hint).toBeNull();
		expect(s.message).toBeNull();
		expect(s.hinted).toBe(true);

		// Kept in the save, also for another visit.
		const again = await hinting();
		expect(again.hinted).toBe(true);
	});

	it('point at a wrong mark', async () => {
		const s = await hinting();
		const wrong = solution.indexOf(0);
		s.move(shaded(wrong), []);
		s.showHint();
		expect(s.hint).toMatchObject({ kind: 'mistake', spotlight: [String(wrong)] });
		expect(s.message?.kind).toBe('error');
	});

	it('keep a hinted solve out of the best time and the ranking', async () => {
		const s = await hinting();
		s.showHint();
		s.move(solvedState(), []);
		await vi.waitFor(() => expect(s.submitting).toBe(false));
		expect(s.solved).toBe(true);
		expect(api.submitScore).toHaveBeenCalledWith(expect.objectContaining({ hinted: true }));
		expect(getStats('tetroid', '6n')).toMatchObject({ solved: 1, bestMs: null });
		// No hint once solved, and none for games without hints.
		s.showHint();
		expect(s.hint).toBeNull();
		const plain = await opened();
		plain.showHint();
		expect(plain.hinted).toBe(false);
	});

	it('give none for a solved board that is not submitted yet', async () => {
		const settings = new GameSettings('tetroid', withCommon([]));
		settings.values.autoSubmit = false;
		const s = new GameSession(tetroid, settings);
		await s.open('6n', { puzzleId: ID });
		s.move(solvedState(), []);
		s.showHint();
		expect(s.hint).toBeNull();
		expect(s.hinted).toBe(false);
	});

	it('come with the digit filled in, in Sudoku and in Calcudoku', async () => {
		const s = new GameSession(sudoku, new GameSettings('sudoku', withCommon([])));
		await s.open('9e');
		expect(s.canHint).toBe(true);
		s.showHint();
		expect(s.hint?.kind).toBe('step');
		expect(s.message?.text).toMatch(/^In its box, \d fits only in the highlighted cell/);
		await s.open('c5e');
		s.showHint();
		expect(s.hint?.kind).toBe('step');
		expect(s.message?.text).not.toMatch(/[{}]|games\./);
	});

	it('are off with the setting that hides the button', async () => {
		const settings = new GameSettings('tetroid', withCommon([]));
		settings.values.hideHint = true;
		const s = new GameSession(tetroid, settings);
		await s.open('6n', { puzzleId: ID });
		expect(s.canHint).toBe(false);
		s.showHint();
		expect(s.hint).toBeNull();
		expect(s.hinted).toBe(false);
	});

	it('count each new hint, not another look at the one on the board', async () => {
		const s = await hinting();
		s.showHint();
		s.showHint();
		expect(s.hints).toBe(1);
		s.move(shaded(solution.indexOf(1)), []);
		s.showHint();
		expect(s.hints).toBe(2);
		expect((await hinting()).hints).toBe(2);
		// Saves from before the count only knew that hints were used.
		const key = s.slot;
		const saved = load<Record<string, unknown>>(key, {});
		delete saved.hints;
		save(key, saved);
		expect((await hinting()).hints).toBe(1);
	});

	it('keep a game hinted when hints are turned off in the middle of it', async () => {
		const settings = new GameSettings('tetroid', withCommon([]));
		const s = new GameSession(tetroid, settings);
		await s.open('6n', { puzzleId: ID });
		s.showHint();
		settings.values.hideHint = true;
		expect(s.canHint).toBe(false);
		s.dismissHint();
		expect(s.hint).toBeNull();
		expect(s.message).toBeNull();
		s.showHint();
		expect(s.hints).toBe(1);
		s.move(solvedState(), []);
		await vi.waitFor(() => expect(s.submitting).toBe(false));
		expect(api.submitScore).toHaveBeenCalledWith(expect.objectContaining({ hinted: true }));
		expect(getStats('tetroid', '6n').bestMs).toBeNull();
	});

	it('start a new puzzle unhinted', async () => {
		const s = await hinting();
		s.showHint();
		await s.newPuzzle();
		expect(s.hinted).toBe(false);
	});
});

describe('syncing with other devices', () => {
	function remote(state: TetroidState, updatedAt: number, extra = {}) {
		return {
			key: 'save:tetroid:6n',
			updatedAt,
			data: {
				version: 1 as const,
				puzzleId: ID,
				variant: '6n',
				puzzle,
				state,
				checkpoints: [],
				currentCheckpoint: -1,
				solved: false,
				startedAt: 0,
				playMs: 0,
				updatedAt,
				...extra
			}
		};
	}

	it('uploads a game with progress shortly after the last move', async () => {
		const s = await opened({ autoSubmit: false });
		expect(api.pushSave).not.toHaveBeenCalled();
		s.move(shaded(0), []);
		s.move(shaded(0, 1), []);
		vi.advanceTimersByTime(1500);
		expect(api.pushSave).toHaveBeenCalledTimes(1);
		expect(api.pushSave).toHaveBeenCalledWith(
			'save:tetroid:6n',
			expect.objectContaining({ state: shaded(0, 1) }),
			Date.now() - 1500
		);
	});

	it('continues a newer game from another device', async () => {
		vi.mocked(api.pullSave).mockResolvedValueOnce(remote(shaded(7), Date.now() + 1000));
		const s = session();
		await s.open('6n');
		await vi.waitFor(() => expect(s.state).toEqual(shaded(7)));
		expect(s.puzzleId).toBe(ID);
		expect(s.message?.text).toBe('Continued your game from another device.');
	});

	it('keeps a newer local game and ignores empty or solved remote games', async () => {
		const s = await opened({ autoSubmit: false });
		s.move(shaded(1), []);
		for (const r of [
			remote(shaded(7), Date.now() - 1000),
			remote(game.emptyState(puzzle), Date.now() + 1000),
			remote(shaded(7), Date.now() + 1000, { solved: true })
		]) {
			vi.mocked(api.currentPlayer).mockReturnValue({ id: 'p', name: 'P', token: 't' });
			vi.mocked(api.pullSave).mockResolvedValueOnce(r);
			// The page asks again when it becomes visible; the player has touched this game.
			s.refreshFromServer();
			await Promise.resolve();
			expect(s.state).toEqual(shaded(1));
		}
	});
});

describe('cleaning up saves', () => {
	it('removes saves of special periods that are over', () => {
		const day = 86_400_000;
		const old = Date.now() - (SPECIAL_RETENTION_DAYS.daily + 1) * day;
		save('save:tetroid:daily:2026-08-01', { updatedAt: old });
		save('save:tetroid:daily:2026-10-06', { updatedAt: Date.now() - day });
		save('save:tetroid:daily:archive', { updatedAt: old });
		save('save:tetroid:6n', { updatedAt: old });
		save('save:tetroid:odd:2026', { updatedAt: old });
		cleanupSpecialSaves();
		expect(keys('save:').sort()).toEqual([
			'save:tetroid:6n',
			'save:tetroid:daily:2026-10-06',
			'save:tetroid:daily:archive',
			'save:tetroid:odd:2026'
		]);
	});

	describe('when storage is full', () => {
		const game = (updatedAt: number, solved = false) => ({ updatedAt, solved });

		it('removes solved games first, without asking', () => {
			save('save:a', game(1, true));
			save('save:b', game(2));
			save('save:current', game(3, true));
			save('settings:x', 3);
			const agree = vi.fn(() => true);
			expect(freeSaveSpace('save:current', agree)).toBe(true);
			expect(agree).not.toHaveBeenCalled();
			expect(keys('').sort()).toEqual(['save:b', 'save:current', 'settings:x']);
		});

		it('then removes the unfinished game played longest ago, if the player agrees', () => {
			save('save:new', game(30));
			save('save:old', game(10));
			save('save:current', game(1));
			expect(freeSaveSpace('save:current', () => false)).toBe(false);
			expect(keys('save:')).toHaveLength(3);
			expect(freeSaveSpace('save:current', () => true)).toBe(true);
			expect(keys('save:').sort()).toEqual(['save:current', 'save:new']);
		});

		it('never removes the game being played', () => {
			save('save:current', game(1, true));
			expect(freeSaveSpace('save:current', () => true)).toBe(false);
			expect(keys('save:')).toEqual(['save:current']);
		});

		it('keeps the current game when a move does not fit', async () => {
			const s = await opened();
			save('save:tetroid:8n', game(1, true));
			const storage = localStorage as unknown as MemoryStorage;
			storage.full = true;
			setQuotaHandler(() => {
				const freed = freeSaveSpace(s.slot, () => true);
				storage.full = !freed;
				return freed;
			});
			s.move(shaded(3), ['3']);
			expect(keys('save:')).toEqual(['save:tetroid:6n']);
			expect(load<{ state: TetroidState } | null>('save:tetroid:6n', null)?.state.marks[3]).toBe(
				SHADED
			);
			setQuotaHandler(() => false);
		});
	});
});
