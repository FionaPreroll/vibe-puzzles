import { resolve } from '$app/paths';
import { t } from '../i18n/index.svelte';
import { load, remove, save } from './storage';

/**
 * Client for the optional server (Cloudflare Worker). On static hosting (GitHub Pages) the
 * health check fails and every feature here quietly stays off.
 */

export interface Player {
	id: string;
	name: string;
	/** Secret token; doubles as the sync code for other devices. */
	token: string;
}

export interface ScoreEntry {
	rank: number;
	name: string;
	timeMs: number;
	playMs: number;
	puzzleId: number;
	at: string;
	me?: boolean;
}

export interface ScoreResult {
	ok: boolean;
	code?: 'wrong' | 'repeat' | 'personal' | 'local' | 'hinted' | 'ranked' | 'expired';
	message: string;
	timeMs?: number;
	bestMs?: number;
	rank?: number;
	total?: number;
	puzzleId?: number;
}

/** Same-origin API under the app's base path. */
const api = () => `${resolve('/').replace(/\/$/, '')}/api`;
interface Health {
	ok: boolean;
	serverPuzzles: boolean;
	/** No answer (offline, or a server error), so asking again later may give a different one. */
	retry: boolean;
}
const UNREACHABLE: Health = { ok: false, serverPuzzles: false, retry: true };

/**
 * How long an unanswered health check counts. A clear answer (a server, or static hosting without
 * one) counts for the life of the page.
 */
export const HEALTH_RETRY_MS = 30_000;

let health: Promise<Health> | null = null;
let result: Health | null = null;
let checkedAt = 0;
const watchers = new Set<(ok: boolean) => void>();

function checkHealth(): Promise<Health> {
	if (result?.retry && Date.now() - checkedAt >= HEALTH_RETRY_MS) health = null;
	if (!health) {
		listenForReconnect();
		const previous = result;
		result = null;
		checkedAt = Date.now();
		health = fetch(`${api()}/health`)
			.then(async (r): Promise<Health> => {
				if (r.status >= 500) return UNREACHABLE;
				const body = r.ok ? await r.json().catch(() => null) : null;
				return { ok: body?.ok === true, serverPuzzles: body?.serverPuzzles === true, retry: false };
			})
			.catch(() => UNREACHABLE)
			.then((h) => {
				result = h;
				if (previous && previous.ok !== h.ok) for (const w of watchers) w(h.ok);
				return h;
			});
	}
	return health;
}

/** Ask again as soon as the device is back online or the page is shown, if nobody answered. */
let listening = false;
function listenForReconnect() {
	if (listening || typeof window === 'undefined') return;
	listening = true;
	const recheck = () => {
		if (!result?.retry || document.visibilityState === 'hidden') return;
		health = null;
		void checkHealth();
	};
	window.addEventListener('online', recheck);
	document.addEventListener('visibilitychange', recheck);
}

export async function serverAvailable(): Promise<boolean> {
	return (await checkHealth()).ok;
}

/**
 * Tell `listener` whether the server is available, then again whenever that changes (for example
 * when a device that started offline gets a connection). Returns a function that stops it.
 */
export function watchServer(listener: (ok: boolean) => void): () => void {
	watchers.add(listener);
	void serverAvailable().then((ok) => watchers.has(listener) && listener(ok));
	return () => void watchers.delete(listener);
}

/** Whether new puzzles come from the server (needs a registered player). */
export async function serverPuzzles(): Promise<boolean> {
	return !!currentPlayer() && (await checkHealth()).serverPuzzles;
}

export interface IssuedPuzzle<P = unknown> {
	ticket: string;
	puzzle: P;
	issuedAt: number;
	/** Only for special puzzles; regular IDs stay secret until solved. */
	puzzleId: number | null;
}

export function issuePuzzle<P>(game: string, variant: string): Promise<IssuedPuzzle<P>> {
	return call<IssuedPuzzle<P>>('/puzzles', {
		method: 'POST',
		body: JSON.stringify({ game, variant })
	});
}

export function currentPlayer(): Player | null {
	return load<Player | null>('player', null);
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
	const player = currentPlayer();
	const headers = new Headers(init.headers);
	if (player) headers.set('authorization', `Bearer ${player.token}`);
	if (init.body) headers.set('content-type', 'application/json');
	const res = await fetch(`${api()}${path}`, { ...init, headers });
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
	return body as T;
}

export async function register(name: string): Promise<Player> {
	const player = await call<Player>('/player', { method: 'POST', body: JSON.stringify({ name }) });
	save('player', player);
	return player;
}

/** Link this device to an existing player by its sync code. */
export async function linkDevice(code: string): Promise<Player> {
	const token = code.replace(/[\s-]/g, '');
	const res = await fetch(`${api()}/player`, { headers: { authorization: `Bearer ${token}` } });
	if (!res.ok) throw new Error(t('player.unknownCode'));
	const body = (await res.json()) as { id: string; name: string };
	const player = { id: body.id, name: body.name, token };
	save('player', player);
	return player;
}

export async function rename(name: string): Promise<Player> {
	const body = await call<{ id: string; name: string }>('/player', {
		method: 'PATCH',
		body: JSON.stringify({ name })
	});
	const player = { ...currentPlayer()!, name: body.name };
	save('player', player);
	return player;
}

export function signOut() {
	remove('player');
}

export interface RemoteSave<T = unknown> {
	key: string;
	data: T;
	updatedAt: number;
}

export async function pullSave<T>(key: string): Promise<RemoteSave<T> | null> {
	if (!currentPlayer() || !(await serverAvailable())) return null;
	try {
		const save = await call<RemoteSave<T>>(`/saves/${encodeURIComponent(key)}`);
		return save.data == null ? null : save;
	} catch {
		return null;
	}
}

export async function pushSave(key: string, data: unknown, updatedAt: number): Promise<void> {
	if (!currentPlayer() || !(await serverAvailable())) return;
	await call(`/saves/${encodeURIComponent(key)}`, {
		method: 'PUT',
		body: JSON.stringify({ data, updatedAt })
	}).catch(() => undefined);
}

export interface Submission {
	game: string;
	variant: string;
	puzzleId: number;
	puzzle: unknown;
	answer: string;
	timeMs: number;
	playMs: number;
	competitive: boolean;
	/** A hint was used: not ranked. */
	hinted?: boolean;
	/** Set for puzzles issued by the server. */
	ticket?: string;
}

export async function submitScore(s: Submission): Promise<ScoreResult | null> {
	if (!currentPlayer() || !(await serverAvailable())) return null;
	return call<ScoreResult>('/scores', { method: 'POST', body: JSON.stringify(s) });
}

export interface Leaderboard {
	entries: ScoreEntry[];
	me: ScoreEntry | null;
	players: number;
}

export async function leaderboard(game: string, variant: string, puzzleId?: number) {
	const q = new URLSearchParams({ game, variant });
	if (puzzleId) q.set('puzzleId', String(puzzleId));
	return call<Leaderboard>(`/scores?${q}`);
}
