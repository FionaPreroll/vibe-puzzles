/** Small wrapper around localStorage that never throws (private mode, quota, SSR). */

const PREFIX = 'vp:';

/** Called when a write fails because storage is full. */
let onQuota: (() => void) | null = null;

export function setQuotaHandler(handler: () => void) {
	onQuota = handler;
}

function store(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export function load<T>(key: string, fallback: T): T {
	try {
		const raw = store()?.getItem(PREFIX + key);
		return raw == null ? fallback : (JSON.parse(raw) as T);
	} catch {
		return fallback;
	}
}

export function save(key: string, value: unknown): boolean {
	const s = store();
	if (!s) return false;
	try {
		s.setItem(PREFIX + key, JSON.stringify(value));
		return true;
	} catch (e) {
		if (e instanceof DOMException && /quota/i.test(e.name + e.message)) onQuota?.();
		return false;
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
