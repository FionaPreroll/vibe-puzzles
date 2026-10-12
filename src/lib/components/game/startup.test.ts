import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../../test/memory-storage';
import type { Message } from '../../client/session/messages';
import { load, save, setQuotaHandler } from '../../client/storage';
import { encodePuzzleId } from '../../core/variants';
import { tetroid } from '../../games/tetroid';
import { firstVisitTutorial, freeSpaceWhenFull, openFromAddress } from './startup';

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => {
	vi.unstubAllGlobals();
	setQuotaHandler(() => false);
});

const none = new URLSearchParams();

describe('the first visit', () => {
	it('opens the tutorial once, unless a link opens a puzzle', () => {
		expect(firstVisitTutorial('tetroid', true, new URLSearchParams('id=1'))).toBe(false);
		expect(firstVisitTutorial('tetroid', true, none)).toBe(true);
		expect(firstVisitTutorial('tetroid', true, none)).toBe(false);
	});

	it('skips a tutorial solved already, or a game without one', () => {
		save('tutorialDone:tetroid', true);
		expect(firstVisitTutorial('tetroid', true, none)).toBe(false);
		expect(load('tutorialSeen:tetroid', false)).toBe(true);
		expect(firstVisitTutorial('nope', false, none)).toBe(false);
		expect(load('tutorialSeen:nope', false)).toBe(false);
	});
});

describe('opening from the address', () => {
	const variants = tetroid.variants;
	const [first, second] = variants;
	const idOf = (variantIndex: number) => encodePuzzleId(variantIndex, 77);

	function fakeSession(replaces = false) {
		const session = {
			variant: first,
			message: null as Message | null,
			replacesGame: vi.fn(() => replaces),
			open: vi.fn(async (key: string) => {
				session.variant = variants.find((v) => v.key === key) ?? first;
			})
		};
		return session;
	}
	const yes = async () => true;
	const no = async () => false;

	it('opens the first type on a plain address and keeps it', async () => {
		const session = fakeSession();
		expect(await openFromAddress(session as never, variants, none, yes)).toBe(false);
		expect(session.open).toHaveBeenCalledWith(first.key, {
			puzzleId: undefined,
			shared: undefined
		});
	});

	it('opens the type asked for', async () => {
		const session = fakeSession();
		const params = new URLSearchParams({ v: second.key });
		expect(await openFromAddress(session as never, variants, params, yes)).toBe(false);
		expect(session.open).toHaveBeenCalledWith(second.key, expect.anything());
	});

	it('opens a linked puzzle with its position, then cleans the address', async () => {
		const session = fakeSession();
		const params = new URLSearchParams({ v: second.key, id: String(idOf(1)), s: 'abc' });
		expect(await openFromAddress(session as never, variants, params, yes)).toBe(true);
		expect(session.open).toHaveBeenCalledWith(second.key, { puzzleId: idOf(1), shared: 'abc' });
	});

	it("asks before a link replaces an unfinished game, and else opens that game's type", async () => {
		const ask = vi.fn(no);
		const session = fakeSession(true);
		const params = new URLSearchParams({ id: String(idOf(1)) });
		expect(await openFromAddress(session as never, variants, params, ask)).toBe(true);
		expect(ask).toHaveBeenCalledOnce();
		expect(session.open).toHaveBeenCalledWith(second.key, {});

		const agreed = fakeSession(true);
		await openFromAddress(agreed as never, variants, params, yes);
		expect(agreed.open).toHaveBeenCalledWith(first.key, { puzzleId: idOf(1), shared: undefined });
	});

	it('says so when a linked ID is no puzzle', async () => {
		const session = fakeSession();
		const params = new URLSearchParams({ id: 'nonsense' });
		expect(await openFromAddress(session as never, variants, params, yes)).toBe(true);
		expect(session.message).toMatchObject({ kind: 'error' });
		expect(session.message!.text).toBe('No puzzle has this ID.');
	});

	it('cleans the address of a type that cannot be played', async () => {
		const session = fakeSession();
		const params = new URLSearchParams({ v: 'nope' });
		expect(await openFromAddress(session as never, variants, params, yes)).toBe(true);
	});
});

describe('a full storage', () => {
	function full() {
		const storage = new MemoryStorage();
		vi.stubGlobal('localStorage', storage);
		save('save:tetroid:20h', { updatedAt: 1, solved: false });
		storage.full = true;
		return storage;
	}

	it('asks once before removing unfinished games, and saves again once allowed', async () => {
		const session = { slot: 'save:tetroid:10n', flush: vi.fn() };
		let answer!: (ok: boolean) => void;
		const ask = vi.fn(() => new Promise<boolean>((r) => (answer = r)));
		freeSpaceWhenFull(session, ask);
		full();
		// The write fails while the question is open.
		expect(save('x', 'y')).toBe(false);
		expect(save('x', 'y')).toBe(false);
		expect(ask).toHaveBeenCalledOnce();
		expect(load('save:tetroid:20h', null)).not.toBeNull();
		answer(true);
		await vi.waitFor(() => expect(session.flush).toHaveBeenCalledOnce());
		// Agreed: the next write that runs out of room removes the unfinished game.
		save('x', 'y');
		expect(load('save:tetroid:20h', null)).toBeNull();
	});

	it('removes solved games without asking', () => {
		const ask = vi.fn(async () => true);
		freeSpaceWhenFull({ slot: 'save:tetroid:10n', flush: vi.fn() }, ask);
		const storage = new MemoryStorage();
		vi.stubGlobal('localStorage', storage);
		save('save:tetroid:20h', { updatedAt: 1, solved: true });
		storage.full = true;
		save('x', 'y');
		expect(load('save:tetroid:20h', null)).toBeNull();
		expect(ask).not.toHaveBeenCalled();
	});

	it('keeps the games when the player says no', async () => {
		const session = { slot: 'save:tetroid:10n', flush: vi.fn() };
		const ask = vi.fn(async () => false);
		freeSpaceWhenFull(session, ask);
		full();
		save('x', 'y');
		await Promise.resolve();
		save('x', 'y');
		expect(ask).toHaveBeenCalledOnce();
		expect(session.flush).not.toHaveBeenCalled();
		expect(load('save:tetroid:20h', null)).not.toBeNull();
	});
});
