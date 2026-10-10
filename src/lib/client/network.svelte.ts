import { load, save } from './storage';
import { KEY } from './storageKeys';

/**
 * What the connection menu shows and switches. The build sets the defaults (`__NET__`, see
 * README); a player's own choice is stored on this device only and never synced.
 *
 * - `offline`: offline mode. The app sends nothing by itself: no health checks, no sync, no score
 *   uploads, no update checks, and the service worker serves pages from its cache. Only "Sync
 *   now" and "Check now" reach out, once each time they are pressed.
 * - `updateCheck`: look for a new version now and then, while not in offline mode.
 */

/** Where the server stands. `none`: this build or hosting has no server. */
export type ServerStatus = 'checking' | 'online' | 'unreachable' | 'offline' | 'none';

export const net = $state({
	/** The build runs with the optional server. */
	hasServer: __NET__.server,
	offline: load<boolean>(KEY.offlineMode, __NET__.offline) === true,
	updateCheck: load<boolean>(KEY.updateCheck, __NET__.updateCheck) === true,
	status: (__NET__.server ? 'checking' : 'none') as ServerStatus,
	/** Round trip of the last answer from the server, in milliseconds. */
	latencyMs: null as number | null,
	/** When the server last answered. */
	lastContact: null as number | null,
	/** When "Sync now" last went through. */
	lastSync: null as number | null,
	/** Uploads waiting in the outbox. */
	pending: 0,
	/** "Sync now" is running. */
	syncing: false
});

export function saveOfflineMode(on: boolean) {
	net.offline = on;
	save(KEY.offlineMode, on);
}

export function setUpdateCheck(on: boolean) {
	net.updateCheck = on;
	save(KEY.updateCheck, on);
}

/** Tell the service worker whether to stay off the network (it cannot read local storage). */
export function tellServiceWorker(offline: boolean) {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	void navigator.serviceWorker.ready
		.then((reg) => reg.active?.postMessage({ type: 'offline', offline }))
		.catch(() => undefined);
}
