/**
 * Backup of everything the app keeps in this browser: saves, stats, settings and the player code.
 * The file format is described by `static/backup.schema.json`.
 */

export const BACKUP_FORMAT = 'vibe-puzzles-backup';
export const BACKUP_VERSION = 1;
const PREFIX = 'vp:';

export interface Backup {
	$schema?: string;
	format: typeof BACKUP_FORMAT;
	version: typeof BACKUP_VERSION;
	exportedAt: string;
	app: { version: string; commit: string };
	/** Raw stored values by key, without the `vp:` prefix. */
	data: Record<string, string>;
}

export function createBackup(
	storage: Storage,
	app: Backup['app'],
	schemaUrl?: string,
	now = new Date()
): Backup {
	const data: Record<string, string> = {};
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (!key?.startsWith(PREFIX)) continue;
		const value = storage.getItem(key);
		if (value != null) data[key.slice(PREFIX.length)] = value;
	}
	return {
		...(schemaUrl ? { $schema: schemaUrl } : {}),
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt: now.toISOString(),
		app,
		data
	};
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Checks a file's text against the schema's rules; `error` is a short English reason. */
export function parseBackup(text: string): ParseResult {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: 'not JSON' };
	}
	if (!isObject(raw)) return { ok: false, error: 'not an object' };
	if (raw.format !== BACKUP_FORMAT) return { ok: false, error: 'not a Vibe Puzzles backup' };
	if (raw.version !== BACKUP_VERSION) return { ok: false, error: `unknown version ${raw.version}` };
	if (typeof raw.exportedAt !== 'string') return { ok: false, error: 'missing exportedAt' };
	if (
		!isObject(raw.app) ||
		typeof raw.app.version !== 'string' ||
		typeof raw.app.commit !== 'string'
	)
		return { ok: false, error: 'missing app info' };
	if (!isObject(raw.data)) return { ok: false, error: 'missing data' };
	for (const [key, value] of Object.entries(raw.data)) {
		if (!key || typeof value !== 'string') return { ok: false, error: `bad entry ${key}` };
	}
	return { ok: true, backup: raw as unknown as Backup };
}

/** Writes the backup's entries; keys not in the backup stay. Returns the number written. */
export function restoreBackup(storage: Storage, backup: Backup): number {
	let n = 0;
	for (const [key, value] of Object.entries(backup.data)) {
		storage.setItem(PREFIX + key, value);
		n++;
	}
	return n;
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}
