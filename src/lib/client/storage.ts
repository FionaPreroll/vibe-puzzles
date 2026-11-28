/** Small wrapper around localStorage that never throws (private mode, quota, SSR). */

const PREFIX = 'vp:';

/**
 * Called when a write fails because storage is full. Returning true means it made room, and the
 * write is tried again.
 */
let onQuota: (() => boolean | void) | null = null;

/** How often one write may be retried after the quota handler made room. */
const QUOTA_RETRIES = 20;

export function setQuotaHandler(handler: () => boolean | void) {
	onQuota = handler;
}

/**
 * The browser's localStorage, or null where there is none: on the server, or where the browser
 * blocks it (reading `localStorage` then throws).
 */
export function browserStorage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

const store = browserStorage;

/** Whether `e`, thrown by a write, means that storage is full. */
export const isQuotaError = (e: unknown) =>
	e instanceof DOMException && /quota/i.test(e.name + e.message);

export function load<T>(key: string, fallback: T): T {
	try {
		const raw = store()?.getItem(PREFIX + key);
		return raw == null ? fallback : (JSON.parse(raw) as T);
	} catch {
		return fallback;
	}
}

/** Store `value`; `freeSpace: false` skips the quota handler when storage is full. */
export function save(key: string, value: unknown, freeSpace = true): boolean {
	const s = store();
	if (!s) return false;
	const text = JSON.stringify(value);
	for (let retry = 0; ; retry++) {
		try {
			s.setItem(PREFIX + key, text);
			return true;
		} catch (e) {
			if (!isQuotaError(e) || !freeSpace || onQuota?.() !== true || retry >= QUOTA_RETRIES)
				return false;
		}
	}
}

export function remove(key: string) {
	try {
		store()?.removeItem(PREFIX + key);
	} catch {
		/* ignore */
	}
}

/** Keys (without prefix) that start with `prefix`. */
export function keys(prefix = ''): string[] {
	const s = store();
	if (!s) return [];
	const out: string[] = [];
	for (let i = 0; i < s.length; i++) {
		const k = s.key(i);
		if (k?.startsWith(PREFIX + prefix)) out.push(k.slice(PREFIX.length));
	}
	return out;
}

/**
 * Call `listener` when another tab of the app changes a value: with its key (without prefix), or
 * null when all of storage was cleared. Returns a function that stops listening.
 */
export function watchStorage(listener: (key: string | null) => void): () => void {
	if (typeof window === 'undefined') return () => undefined;
	const changed = (e: StorageEvent) => {
		if (e.key === null) listener(null);
		else if (e.key.startsWith(PREFIX)) listener(e.key.slice(PREFIX.length));
	};
	window.addEventListener('storage', changed);
	return () => window.removeEventListener('storage', changed);
}
