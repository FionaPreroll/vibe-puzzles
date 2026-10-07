import { resolve } from '$app/paths';
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
	message: string;
	rank?: number;
	total?: number;
}

/** Same-origin API under the app's base path. */
const api = () => `${resolve('/').replace(/\/$/, '')}/api`;
let available: Promise<boolean> | null = null;

export function serverAvailable(): Promise<boolean> {
	available ??= fetch(`${api()}/health`)
		.then((r) => (r.ok ? r.json() : null))
		.then((body) => body?.ok === true)
		.catch(() => false);
	return available;
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
	if (!res.ok) throw new Error('Unknown sync code');
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
