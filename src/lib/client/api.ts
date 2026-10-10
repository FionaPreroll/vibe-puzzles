import { resolve } from '$app/paths';
import { t } from '../i18n/index.svelte';
import { net, saveOfflineMode, tellServiceWorker } from './network.svelte';
import {
	clearOutbox,
	pending,
	pendingCount,
	queueSave,
	queueScore,
	saveSent,
	scoreSent
} from './outbox';
import { load, remove, save } from './storage';
import { KEY } from './storageKeys';

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
/** Offline mode: the server is not asked. */
const OFF: Health = { ok: false, serverPuzzles: false, retry: true };
/** A build without a server. */
const NONE: Health = { ok: false, serverPuzzles: false, retry: false };

/**
 * How long an unanswered health check counts. A clear answer (a server, or static hosting without
 * one) counts for the life of the page, until a request gets no answer.
 */
export const HEALTH_RETRY_MS = 30_000;

let health: Promise<Health> | null = null;
let result: Health | null = null;
let checkedAt = 0;
/** The server's answer while "Sync now" runs, which may use it even in offline mode. */
let manual: Health | null = null;
const watchers = new Set<(ok: boolean) => void>();
/** What the watchers were told last. */
let announced = false;

function announce(ok: boolean) {
	if (ok === announced) return;
	announced = ok;
	for (const w of watchers) w(ok);
}

/** The server answered a request that started at `start` (`performance.now()`). */
function contact(start: number) {
	net.latencyMs = Math.round(performance.now() - start);
	net.lastContact = Date.now();
}

function setResult(h: Health) {
	result = h;
	net.status = net.offline ? 'offline' : h.ok ? 'online' : h.retry ? 'unreachable' : 'none';
	// Without a server nothing will ever be uploaded.
	if (!h.ok && !h.retry) clearOutbox();
	net.pending = pendingCount();
	announce(!net.offline && h.ok);
	if (h.ok) void flushOutbox();
}

async function fetchHealth(): Promise<Health> {
	const start = performance.now();
	try {
		const r = await fetch(`${api()}/health`);
		if (r.status >= 500) return UNREACHABLE;
		const body = r.ok ? await r.json().catch(() => null) : null;
		if (body?.ok === true) contact(start);
		return { ok: body?.ok === true, serverPuzzles: body?.serverPuzzles === true, retry: false };
	} catch {
		return UNREACHABLE;
	}
}

function checkHealth(): Promise<Health> {
	if (result?.retry && Date.now() - checkedAt >= HEALTH_RETRY_MS) health = null;
	if (!health) {
		listenForReconnect();
		checkedAt = Date.now();
		health = fetchHealth().then((h) => {
			setResult(h);
			return h;
		});
	}
	return health;
}

/** A request got no answer: count the server as unreachable until the next check. */
function markUnreachable() {
	if (!result || (!result.ok && !result.retry)) return;
	checkedAt = Date.now();
	health = Promise.resolve(UNREACHABLE);
	setResult(UNREACHABLE);
}

/** Ask again as soon as the device is back online or the page is shown, if nobody answered. */
let listening = false;
function listenForReconnect() {
	if (listening || typeof window === 'undefined') return;
	listening = true;
	const recheck = () => {
		if (net.offline || document.visibilityState === 'hidden') return;
		if (result?.ok) {
			void flushOutbox();
			return;
		}
		if (!result?.retry) return;
		health = null;
		void checkHealth();
	};
	window.addEventListener('online', recheck);
	window.addEventListener('offline', () => {
		if (!net.offline) markUnreachable();
	});
	document.addEventListener('visibilitychange', recheck);
}

/** What the app may use now: nothing in offline mode, except while "Sync now" runs. */
function reachable(): Promise<Health> {
	if (!net.hasServer) return Promise.resolve(NONE);
	if (manual) return Promise.resolve(manual);
	if (net.offline) return Promise.resolve(OFF);
	return checkHealth();
}

export async function serverAvailable(): Promise<boolean> {
	return (await reachable()).ok;
}

/**
 * Tell `listener` whether the server is available, then again whenever that changes (for example
 * when a device that started offline gets a connection, or offline mode is switched). Returns a
 * function that stops it.
 */
export function watchServer(listener: (ok: boolean) => void): () => void {
	let told: boolean | null = null;
	const tell = (ok: boolean) => {
		if (ok === told) return;
		told = ok;
		listener(ok);
	};
	watchers.add(tell);
	void serverAvailable().then((ok) => watchers.has(tell) && tell(ok));
	return () => void watchers.delete(tell);
}

/** Whether new puzzles come from the server (needs a registered player). */
export async function serverPuzzles(): Promise<boolean> {
	return !!currentPlayer() && (await reachable()).serverPuzzles;
}

/**
 * Switch offline mode. Switching it off asks the server again at once and sends what waits.
 * The service worker learns it too, so it serves pages from its cache.
 */
export function setOfflineMode(on: boolean) {
	if (on === net.offline) return;
	saveOfflineMode(on);
	tellServiceWorker(on);
	if (!net.hasServer) return;
	if (on) {
		net.status = 'offline';
		announce(false);
		return;
	}
	net.status = result?.ok ? 'online' : 'checking';
	health = null;
	void checkHealth();
}

/**
 * Ask the server afresh (opening the connection menu), for its state and a current latency. Not
 * in offline mode.
 */
export function pingServer(): Promise<boolean> {
	if (!net.hasServer || net.offline || net.status === 'none') return Promise.resolve(false);
	health = null;
	return serverAvailable();
}

/** Things to refresh from the server on "Sync now", such as the open game and its settings. */
const syncers = new Set<() => Promise<unknown>>();

/** Run `pull` on every "Sync now"; returns a function that stops it. */
export function onSync(pull: () => Promise<unknown>): () => void {
	syncers.add(pull);
	return () => void syncers.delete(pull);
}

/**
 * Sync once, also in offline mode: ask the server, send what waits, and refresh what the open
 * page shows. Returns whether the server answered.
 */
export async function syncNow(): Promise<boolean> {
	if (!net.hasServer || net.syncing) return false;
	net.syncing = true;
	try {
		const h = await fetchHealth();
		if (!net.offline) {
			checkedAt = Date.now();
			health = Promise.resolve(h);
			setResult(h);
		} else if (!h.ok && !h.retry) {
			setResult(h);
			net.status = 'offline';
		}
		if (!h.ok) return false;
		manual = h;
		await flushOutbox();
		if (net.pending) await flushOutbox();
		await Promise.all([...syncers].map((pull) => pull().catch(() => undefined)));
		net.lastSync = Date.now();
		return true;
	} finally {
		manual = null;
		net.syncing = false;
	}
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
	return load<Player | null>(KEY.player, null);
}

/** The server answered with an error. */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

/** Whether a failed upload may go through later: no answer, a server error or too many requests. */
const worthRetry = (e: unknown) => !(e instanceof ApiError) || e.status >= 500 || e.status === 429;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
	if (net.offline && !manual) throw new Error(t('net.offlineError'));
	const player = currentPlayer();
	const headers = new Headers(init.headers);
	if (player) headers.set('authorization', `Bearer ${player.token}`);
	if (init.body) headers.set('content-type', 'application/json');
	const start = performance.now();
	let res: Response;
	try {
		res = await fetch(`${api()}${path}`, { ...init, headers });
	} catch (e) {
		markUnreachable();
		throw e;
	}
	contact(start);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
	return body as T;
}

export async function register(name: string): Promise<Player> {
	const player = await call<Player>('/player', { method: 'POST', body: JSON.stringify({ name }) });
	save(KEY.player, player);
	return player;
}

/** Link this device to an existing player by its sync code. */
export async function linkDevice(code: string): Promise<Player> {
	const token = code.replace(/[\s-]/g, '');
	const res = await fetch(`${api()}/player`, { headers: { authorization: `Bearer ${token}` } });
	if (!res.ok) throw new Error(t('player.unknownCode'));
	const body = (await res.json()) as { id: string; name: string };
	const player = { id: body.id, name: body.name, token };
	save(KEY.player, player);
	return player;
}

export async function rename(name: string): Promise<Player> {
	const body = await call<{ id: string; name: string }>('/player', {
		method: 'PATCH',
		body: JSON.stringify({ name })
	});
	const player = { ...currentPlayer()!, name: body.name };
	save(KEY.player, player);
	return player;
}

export function signOut() {
	remove(KEY.player);
	clearOutbox();
	net.pending = 0;
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

/**
 * Upload a synced value. It waits in the outbox until the server has it, so a game played
 * offline or in offline mode reaches the server once it answers again.
 */
export async function pushSave(key: string, data: unknown, updatedAt: number): Promise<void> {
	if (!currentPlayer() || net.status === 'none') return;
	if (!queueSave(key, data, updatedAt)) {
		// Storage is full: try once, as nothing can wait.
		if (!(await serverAvailable())) return;
		await call(`/saves/${encodeURIComponent(key)}`, {
			method: 'PUT',
			body: JSON.stringify({ data, updatedAt })
		}).catch(() => undefined);
		return;
	}
	net.pending = pendingCount();
	await flushOutbox();
}

let flushing: Promise<void> | null = null;

/** Send what waits in the outbox, if the server may be used and answers. */
export function flushOutbox(): Promise<void> {
	flushing ??= sendPending().finally(() => {
		flushing = null;
		net.pending = pendingCount();
	});
	return flushing;
}

async function sendPending() {
	// What comes in while sending goes out in the next round.
	for (let round = 0; round < 3 && pendingCount(); round++) {
		if (!currentPlayer() || !(await serverAvailable())) return;
		const { saves, scores } = pending();
		for (const [key, s] of saves) {
			try {
				await call(`/saves/${encodeURIComponent(key)}`, {
					method: 'PUT',
					body: JSON.stringify({ data: s.data, updatedAt: s.updatedAt })
				});
			} catch (e) {
				// Kept for later; a refused one would be refused again.
				if (worthRetry(e)) return;
			}
			saveSent(key, s.updatedAt);
		}
		for (const score of scores) {
			try {
				await call('/scores', { method: 'POST', body: JSON.stringify(score) });
			} catch (e) {
				if (worthRetry(e)) return;
			}
			scoreSent(score);
		}
	}
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

/**
 * Submit a solve. Null when there is no server or player, `'queued'` when it waits to be
 * submitted later. Only solves timed on the device wait: a ranked time is measured by the server
 * up to the moment the answer arrives, so a ticket's solve without a connection fails.
 */
export async function submitScore(s: Submission): Promise<ScoreResult | 'queued' | null> {
	if (!currentPlayer()) return null;
	const h = await reachable();
	const later = () => {
		if (s.ticket || !queueScore({ ...s })) return null;
		net.pending = pendingCount();
		return 'queued' as const;
	};
	if (!h.ok) {
		if (!h.retry) return null;
		if (s.ticket) throw new Error(t('net.noConnection'));
		return later();
	}
	try {
		return await call<ScoreResult>('/scores', { method: 'POST', body: JSON.stringify(s) });
	} catch (e) {
		if (!worthRetry(e)) throw e;
		const queued = later();
		if (!queued) throw e;
		return queued;
	}
}

export interface Leaderboard {
	entries: ScoreEntry[];
	me: ScoreEntry | null;
	players: number;
}

const isEntry = (e: unknown): e is ScoreEntry =>
	!!e &&
	typeof e === 'object' &&
	typeof (e as ScoreEntry).rank === 'number' &&
	typeof (e as ScoreEntry).name === 'string' &&
	typeof (e as ScoreEntry).timeMs === 'number';

/**
 * A leaderboard, with only the entries that can be shown: something between the app and the
 * server (a captive portal, a proxy) may answer in its place.
 */
export async function leaderboard(
	game: string,
	variant: string,
	puzzleId?: number
): Promise<Leaderboard> {
	const q = new URLSearchParams({ game, variant });
	if (puzzleId) q.set('puzzleId', String(puzzleId));
	const b = await call<Partial<Leaderboard> | null>(`/scores?${q}`);
	const entries = Array.isArray(b?.entries) ? b.entries.filter(isEntry) : [];
	return {
		entries,
		me: isEntry(b?.me) ? b.me : null,
		players: typeof b?.players === 'number' ? b.players : entries.length
	};
}
