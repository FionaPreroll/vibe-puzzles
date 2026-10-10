/** How often a page that stays open looks for a new version. */
export const UPDATE_INTERVAL_MS = 30 * 60_000;

/** Showing the page or getting a connection back looks too, but at most this often. */
export const UPDATE_MIN_GAP_MS = 5 * 60_000;

/**
 * Look for a new version with `check` (SvelteKit's `updated.check`, which asks for the app's
 * `version.json`) now and then, when the page is shown and when the device is online again. The
 * page itself was just loaded, so the first look waits. Returns a function that stops it.
 */
export function scheduleUpdateChecks(
	check: () => Promise<unknown>,
	now: () => number = Date.now
): () => void {
	let last = now();
	const run = () => {
		if (now() - last < UPDATE_MIN_GAP_MS) return;
		last = now();
		void check().catch(() => undefined);
	};
	const shown = () => {
		if (document.visibilityState === 'visible') run();
	};
	const timer = setInterval(run, UPDATE_INTERVAL_MS);
	window.addEventListener('online', run);
	document.addEventListener('visibilitychange', shown);
	return () => {
		clearInterval(timer);
		window.removeEventListener('online', run);
		document.removeEventListener('visibilitychange', shown);
	};
}
