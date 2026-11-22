/**
 * Backup of everything the app keeps in this browser: saves, stats, settings and the player code.
 * The file format is described by `static/backup.schema.json`.
 */
import { KEY } from './storageKeys';

export const BACKUP_FORMAT = 'vibe-puzzles-backup';
export const BACKUP_VERSION = 1;
const PREFIX = 'vp:';
/** An RFC 3339 date-time, the schema's `date-time` format. */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;

export interface Backup {
	$schema?: string;
	format: typeof BACKUP_FORMAT;
	version: typeof BACKUP_VERSION;
	exportedAt: string;
	app: { version: string; commit: string };
	/** Raw stored values by key, without the `vp:` prefix. */
	data: Record<string, string>;
}

/** What a stored value is, for choosing what goes into a backup. */
export type BackupPart = 'saves' | 'stats' | 'settings' | 'player';

export const BACKUP_PARTS: readonly BackupPart[] = ['saves', 'stats', 'settings', 'player'];

/** Kinds of keys that belong to one game: `<kind>:<game>…` (see `storageKeys.ts`). */
const GAME_KEYS: Record<string, BackupPart> = {
	save: 'saves',
	stats: 'stats',
	bankPlayed: 'stats',
	settings: 'settings',
	tool: 'settings',
	boardZoom: 'settings',
	tutorialSeen: 'settings',
	tutorialDone: 'settings'
};

/** The part a stored key (without `vp:`) belongs to, and its game if it belongs to one. */
export function backupPart(key: string): { part: BackupPart; game?: string } {
	if (key === KEY.player || key === KEY.outbox) return { part: 'player' };
	const [kind, game] = key.split(':');
	const part = Object.hasOwn(GAME_KEYS, kind) ? GAME_KEYS[kind] : undefined;
	// Anything else holds once for the whole app: the language, night mode, the look, …
	return part && game ? { part, game } : { part: 'settings' };
}

/** What goes into a backup: its parts, and of the keys that belong to a game those of `games`. */
export interface BackupSelection {
	parts: readonly BackupPart[];
	/** All games when left out. */
	games?: readonly string[];
}

export function selects(selection: BackupSelection, key: string): boolean {
	const { part, game } = backupPart(key);
	if (!selection.parts.includes(part)) return false;
	return !game || !selection.games || selection.games.includes(game);
}

/** The games this browser keeps something of, in alphabetical order. */
export function backupGames(storage: Storage): string[] {
	const games = new Set<string>();
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (!key?.startsWith(PREFIX)) continue;
		const { game } = backupPart(key.slice(PREFIX.length));
		if (game) games.add(game);
	}
	return [...games].sort();
}

export function createBackup(
	storage: Storage,
	app: Backup['app'],
	schemaUrl?: string,
	now = new Date(),
	selection?: BackupSelection
): Backup {
	const data: Record<string, string> = {};
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (!key?.startsWith(PREFIX)) continue;
		if (selection && !selects(selection, key.slice(PREFIX.length))) continue;
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
	if (!DATE_TIME.test(raw.exportedAt) || Number.isNaN(Date.parse(raw.exportedAt)))
		return { ok: false, error: 'bad exportedAt' };
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
