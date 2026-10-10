import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';

type Network = typeof import('./network.svelte');

/** A fresh module, reading `stored` from local storage. */
async function fresh(stored: Record<string, string> = {}): Promise<Network> {
	vi.resetModules();
	const storage = new MemoryStorage();
	for (const [k, v] of Object.entries(stored)) storage.setItem(k, v);
	vi.stubGlobal('localStorage', storage);
	return import('./network.svelte');
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('connection settings', () => {
	it('start from the build defaults: a server, online, with update checks', async () => {
		const { net } = await fresh();
		expect(net).toMatchObject({
			hasServer: true,
			offline: false,
			updateCheck: true,
			status: 'checking',
			pending: 0
		});
	});

	it('keep the choices of this device and count waiting uploads', async () => {
		const outbox = JSON.stringify({ saves: { 'save:a': { data: 1, updatedAt: 1 } }, scores: [] });
		const { net, saveOfflineMode, setUpdateCheck } = await fresh({
			'vp:offlineMode': 'true',
			'vp:updateCheck': 'false',
			'vp:outbox': outbox
		});
		expect(net).toMatchObject({ offline: true, updateCheck: false, pending: 1 });
		saveOfflineMode(false);
		setUpdateCheck(true);
		expect(localStorage.getItem('vp:offlineMode')).toBe('false');
		expect(localStorage.getItem('vp:updateCheck')).toBe('true');
		expect(net).toMatchObject({ offline: false, updateCheck: true });
	});
});

describe('service worker', () => {
	it('hears whether offline mode is on', async () => {
		const { tellServiceWorker } = await fresh();
		const postMessage = vi.fn();
		vi.stubGlobal('navigator', {
			serviceWorker: { ready: Promise.resolve({ active: { postMessage } }) }
		});
		tellServiceWorker(true);
		await vi.waitFor(() =>
			expect(postMessage).toHaveBeenCalledWith({ type: 'offline', offline: true })
		);
	});

	it('is skipped where there is none', async () => {
		const { tellServiceWorker } = await fresh();
		vi.stubGlobal('navigator', {});
		expect(() => tellServiceWorker(false)).not.toThrow();
		// A worker that fails or is not active yet costs nothing (no unhandled rejection).
		vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.reject(new Error('no')) } });
		expect(tellServiceWorker(false)).toBeUndefined();
		vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ active: null }) } });
		expect(tellServiceWorker(false)).toBeUndefined();
		await new Promise((r) => setTimeout(r));
	});
});
