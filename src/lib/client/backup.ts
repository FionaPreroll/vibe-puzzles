/**
 * Backup of everything the app keeps in this browser: saves, stats, settings and the player code.
 * The file format is described by `static/backup.schema.json`.
 */
import { MAX_PER_TYPE } from '../core/bank';
import type { SpecialKind } from '../core/variants';
import { importedSaveWins, migrateSave } from './session/saves';
import { mergeVariantStats, type VariantStats } from './stats';
import { KEY, SAVE_PREFIX, STATS_PREFIX } from './storageKeys';

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

/** Writes the backup's entries over this browser's; keys not in the backup stay. Returns the number written. */
export function restoreBackup(storage: Storage, backup: Backup): number {
	let n = 0;
	for (const [key, value] of Object.entries(backup.data)) {
		storage.setItem(PREFIX + key, value);
		n++;
	}
	return n;
}

const SPECIAL_KINDS: readonly string[] = ['daily', 'weekly', 'monthly'] satisfies SpecialKind[];

function parse(text: string | null): unknown {
	if (text == null) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

/**
 * The value a merge keeps under `key`, given this browser's (`local`, null if none) and the
 * backup's; both are stored text.
 */
function mergeEntry(key: string, local: string | null, imported: string, keepPlayer: boolean) {
	if (local == null) return imported;
	if (local === imported) return local;
	const [kind, game, variant] = key.split(':');
	const mine = parse(local);
	const theirs = parse(imported);
	if (key.startsWith(STATS_PREFIX) && isObject(mine) && isObject(theirs)) {
		const special = SPECIAL_KINDS.includes(variant) ? (variant as SpecialKind) : undefined;
		const merged = mergeVariantStats(statsOf(mine), statsOf(theirs), special);
		return JSON.stringify(merged);
	}
	if (key.startsWith(SAVE_PREFIX)) {
		const other = migrateSave(theirs);
		if (!other) return local;
		return importedSaveWins(migrateSave(mine), other) ? imported : local;
	}
	if (kind === 'settings' && game) {
		const at = (v: unknown) =>
			isObject(v) && Number.isFinite(v.updatedAt) ? (v.updatedAt as number) : -1;
		return at(theirs) > at(mine) ? imported : local;
	}
	if (kind === 'bankPlayed' && Array.isArray(mine) && Array.isArray(theirs)) {
		const seen = new Set(mine);
		const added = theirs.filter((id) => Number.isInteger(id) && !seen.has(id));
		return added.length ? JSON.stringify([...mine, ...added].slice(-MAX_PER_TYPE)) : local;
	}
	if (key === KEY.player && !keepPlayer) return imported;
	// Anything else, the player above all, stays as this browser has it.
	return local;
}

function statsOf(raw: Record<string, unknown>): VariantStats {
	return {
		solved: 0,
		streak: 0,
		bestStreak: 0,
		bestMs: null,
		totalMs: 0,
		...raw,
		recent: Array.isArray(raw.recent) ? raw.recent : []
	} as VariantStats;
}

/**
 * Adds the backup to what this browser keeps, losing nothing of either: entries it lacks are
 * written, statistics are added up, of two saved games or settings the newer (or the solved game)
 * wins, and anything else, such as the player, stays as it is here. Returns the number of entries
 * written.
 */
export function mergeBackup(storage: Storage, backup: Backup): number {
	const playerId = (text: string | null | undefined) => {
		const p = parse(text ?? null);
		return isObject(p) && typeof p.id === 'string' ? p.id : null;
	};
	const localPlayer = playerId(storage.getItem(PREFIX + KEY.player));
	// Uploads that wait for another player than the one who stays must not go out under this one.
	const otherPlayer = !!localPlayer && localPlayer !== playerId(backup.data[KEY.player]);
	let n = 0;
	for (const [key, value] of Object.entries(backup.data)) {
		if (key === KEY.outbox && otherPlayer) continue;
		const local = storage.getItem(PREFIX + key);
		const merged = mergeEntry(key, local, value, !!localPlayer);
		if (merged === local) continue;
		storage.setItem(PREFIX + key, merged);
		n++;
	}
	return n;
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}
