import { currentPlayer, onSync, pullSave, pushSave, watchServer } from '../../client/api';
import type { GameSession } from '../../client/session.svelte';
import type { GameSettings, StoredSettings } from '../../client/settings.svelte';
import { watchStorage } from '../../client/storage';
import { settingsKey } from '../../client/storageKeys';

/** How long after the last change settings are uploaded, so that quick changes upload once. */
export const SETTINGS_PUSH_DELAY_MS = 1500;

type Session = Pick<
	GameSession,
	'slot' | 'setActive' | 'followStorage' | 'refreshFromServer' | 'flush'
>;
type Settings = Pick<GameSettings<string>, 'game' | 'reload' | 'merge'>;

/**
 * Keep a game session in step with the page and the world around it, until the returned function
 * is called (which also saves the game):
 *
 * - the clock runs while the page is visible and has the focus;
 * - hiding or leaving the page saves the game; showing it again takes over what another tab or
 *   device played meanwhile;
 * - another tab's saves and settings are followed as they change;
 * - once the server answers (also later, e.g. after being offline), and on "Sync now", the game
 *   and the settings are fetched from it.
 */
export function watchPage(session: Session, settings: Settings): () => void {
	const activity = () =>
		session.setActive(document.visibilityState === 'visible' && document.hasFocus());
	const visibility = () => {
		activity();
		if (document.visibilityState === 'visible') {
			session.followStorage();
			session.refreshFromServer();
		} else session.flush();
	};
	const pagehide = () => session.flush();
	document.addEventListener('visibilitychange', visibility);
	window.addEventListener('focus', activity);
	window.addEventListener('blur', activity);
	window.addEventListener('pagehide', pagehide);
	activity();

	// Another tab of the app played this game or changed its settings.
	const key = settingsKey(settings.game);
	const stopStorage = watchStorage((changed) => {
		if (changed === null || changed === session.slot) session.followStorage();
		if (changed === null || changed === key) settings.reload();
	});

	const pullSettings = async () => {
		const remote = await pullSave<StoredSettings>(key);
		if (remote) settings.merge(remote.data);
	};
	// The server can also answer only later, e.g. when the device was offline at the start.
	let answered = false;
	let server = false;
	const stopWatching = watchServer(async (ok) => {
		if (answered && ok === server) return;
		const back = answered && ok;
		answered = true;
		server = ok;
		if (!ok || !currentPlayer()) return;
		if (back) session.refreshFromServer();
		await pullSettings();
	});
	// "Sync now", also in offline mode.
	const stopSync = onSync(() => Promise.all([session.refreshFromServer(), pullSettings()]));

	return () => {
		stopStorage();
		stopWatching();
		stopSync();
		document.removeEventListener('visibilitychange', visibility);
		window.removeEventListener('focus', activity);
		window.removeEventListener('blur', activity);
		window.removeEventListener('pagehide', pagehide);
		session.flush();
	};
}

/**
 * Upload the settings for the player's other devices shortly after they change; without a
 * connection they wait in the outbox. Returns a function that drops an upload not yet started.
 */
export function pushSettingsSoon(
	settings: Pick<GameSettings<string>, 'game' | 'updatedAt' | 'syncable'>
) {
	if (!currentPlayer() || !settings.updatedAt) return () => {};
	const data = settings.syncable();
	const timer = setTimeout(
		() => pushSave(settingsKey(settings.game), data, data.updatedAt),
		SETTINGS_PUSH_DELAY_MS
	);
	return () => clearTimeout(timer);
}
