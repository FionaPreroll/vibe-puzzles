import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../client/api';
import { MemoryStorage } from '../../../test/memory-storage';
import { pushSettingsSoon, SETTINGS_PUSH_DELAY_MS, watchPage } from './lifecycle';

const server = vi.hoisted(() => ({
	listener: null as ((ok: boolean) => void) | null,
	sync: null as (() => Promise<unknown>) | null
}));

vi.mock('../../client/api', () => ({
	currentPlayer: vi.fn(() => ({ id: 'p', name: 'P' })),
	pullSave: vi.fn(async () => null),
	pushSave: vi.fn(async () => undefined),
	watchServer: vi.fn((listener: (ok: boolean) => void) => {
		server.listener = listener;
		return () => (server.listener = null);
	}),
	onSync: vi.fn((pull: () => Promise<unknown>) => {
		server.sync = pull;
		return () => (server.sync = null);
	})
}));

/** A page that can be shown, hidden and focused. */
class FakeDocument extends EventTarget {
	visibilityState: 'visible' | 'hidden' = 'visible';
	focused = true;
	hasFocus() {
		return this.focused;
	}
}

let doc: FakeDocument;
let win: EventTarget;

function fakes() {
	const session = {
		slot: 'save:tetroid:10n',
		setActive: vi.fn(),
		followStorage: vi.fn(),
		refreshFromServer: vi.fn(async () => {}),
		flush: vi.fn()
	};
	const settings = { game: 'tetroid', reload: vi.fn(), merge: vi.fn() };
	return { session, settings };
}

beforeEach(() => {
	doc = new FakeDocument();
	win = new EventTarget();
	vi.stubGlobal('document', doc);
	vi.stubGlobal('window', win);
	vi.stubGlobal('localStorage', new MemoryStorage());
	vi.mocked(api.pullSave).mockReset().mockResolvedValue(null);
	vi.mocked(api.pushSave).mockClear();
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('watching the page', () => {
	it('runs the clock while the page is shown and has the focus', () => {
		const { session, settings } = fakes();
		const stop = watchPage(session, settings);
		expect(session.setActive).toHaveBeenLastCalledWith(true);
		doc.focused = false;
		win.dispatchEvent(new Event('blur'));
		expect(session.setActive).toHaveBeenLastCalledWith(false);
		doc.focused = true;
		win.dispatchEvent(new Event('focus'));
		expect(session.setActive).toHaveBeenLastCalledWith(true);
		stop();
	});

	it('saves when the page is hidden or left, and catches up when it is shown', () => {
		const { session, settings } = fakes();
		const stop = watchPage(session, settings);
		doc.visibilityState = 'hidden';
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(session.setActive).toHaveBeenLastCalledWith(false);
		expect(session.flush).toHaveBeenCalledTimes(1);
		expect(session.followStorage).not.toHaveBeenCalled();

		doc.visibilityState = 'visible';
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(session.followStorage).toHaveBeenCalledTimes(1);
		expect(session.refreshFromServer).toHaveBeenCalledTimes(1);

		win.dispatchEvent(new Event('pagehide'));
		expect(session.flush).toHaveBeenCalledTimes(2);
		stop();
		expect(session.flush).toHaveBeenCalledTimes(3);

		// Stopped: no more listeners.
		win.dispatchEvent(new Event('pagehide'));
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(session.flush).toHaveBeenCalledTimes(3);
		expect(session.followStorage).toHaveBeenCalledTimes(1);
	});

	it("follows another tab's saves of this game and its settings", () => {
		const { session, settings } = fakes();
		const stop = watchPage(session, settings);
		const storage = (key: string | null) =>
			win.dispatchEvent(Object.assign(new Event('storage'), { key }));
		storage('vp:save:tetroid:10n');
		expect(session.followStorage).toHaveBeenCalledTimes(1);
		expect(settings.reload).not.toHaveBeenCalled();
		storage('vp:settings:tetroid');
		expect(settings.reload).toHaveBeenCalledTimes(1);
		storage('vp:save:tetroid:20h');
		storage('other');
		expect(session.followStorage).toHaveBeenCalledTimes(1);
		// Storage cleared: both.
		storage(null);
		expect(session.followStorage).toHaveBeenCalledTimes(2);
		expect(settings.reload).toHaveBeenCalledTimes(2);
		stop();
	});

	it('fetches the settings once the server answers, and the game too when it comes back', async () => {
		const { session, settings } = fakes();
		vi.mocked(api.pullSave).mockResolvedValue({
			key: 'settings:tetroid',
			data: { hideControls: true },
			updatedAt: 5
		});
		const stop = watchPage(session, settings);
		server.listener!(false);
		expect(api.pullSave).not.toHaveBeenCalled();
		server.listener!(false);
		server.listener!(true);
		await vi.waitFor(() => expect(settings.merge).toHaveBeenCalledWith({ hideControls: true }));
		expect(api.pullSave).toHaveBeenCalledWith('settings:tetroid');
		expect(session.refreshFromServer).toHaveBeenCalledTimes(1);
		// The same answer again changes nothing.
		server.listener!(true);
		expect(api.pullSave).toHaveBeenCalledTimes(1);
		stop();
		expect(server.listener).toBeNull();
		expect(server.sync).toBeNull();
	});

	it('takes the first answer of the server as the start: the game was fetched on opening', async () => {
		const { session, settings } = fakes();
		const stop = watchPage(session, settings);
		server.listener!(true);
		await vi.waitFor(() => expect(api.pullSave).toHaveBeenCalledTimes(1));
		expect(session.refreshFromServer).not.toHaveBeenCalled();
		// The server has no settings of this game yet.
		expect(settings.merge).not.toHaveBeenCalled();
		stop();
	});

	it('fetches nothing without a player', () => {
		vi.mocked(api.currentPlayer).mockReturnValueOnce(null);
		const { session, settings } = fakes();
		const stop = watchPage(session, settings);
		server.listener!(true);
		expect(api.pullSave).not.toHaveBeenCalled();
		stop();
	});

	it('fetches the game and the settings on "Sync now"', async () => {
		const { session, settings } = fakes();
		const stop = watchPage(session, settings);
		await server.sync!();
		expect(session.refreshFromServer).toHaveBeenCalledTimes(1);
		expect(api.pullSave).toHaveBeenCalledWith('settings:tetroid');
		stop();
	});
});

describe('pushing settings', () => {
	const settings = {
		game: 'tetroid',
		updatedAt: 100,
		syncable: () => ({ updatedAt: 100, values: {} })
	};

	it('uploads shortly after the last change, once', () => {
		vi.useFakeTimers();
		pushSettingsSoon(settings)();
		const stop = pushSettingsSoon(settings);
		vi.advanceTimersByTime(SETTINGS_PUSH_DELAY_MS);
		expect(api.pushSave).toHaveBeenCalledExactlyOnceWith(
			'settings:tetroid',
			{ updatedAt: 100, values: {} },
			100
		);
		stop();
	});

	it('uploads nothing without a player, or settings never changed', () => {
		vi.useFakeTimers();
		pushSettingsSoon({ ...settings, updatedAt: 0 });
		vi.mocked(api.currentPlayer).mockReturnValueOnce(null);
		pushSettingsSoon(settings);
		vi.advanceTimersByTime(SETTINGS_PUSH_DELAY_MS);
		expect(api.pushSave).not.toHaveBeenCalled();
	});
});
