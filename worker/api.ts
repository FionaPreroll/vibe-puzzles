import { gameLogic } from '../src/lib/games/logic';
import type { BankEntry, Collection } from '../src/lib/core/bank';
import type { Variant } from '../src/lib/core/variants';
import {
	decodePuzzleId,
	encodePuzzleId,
	periodKey,
	randomSeed,
	specialSeed
} from '../src/lib/core/variants';
import type { Scope, Store } from './store';

export interface ApiOptions {
	/**
	 * Generate puzzles on the server. The client then never learns the seed of a ranked puzzle,
	 * and ranked times are measured by the server from the moment the puzzle was issued.
	 */
	serverPuzzles?: boolean;
	/**
	 * Take server puzzles from the pre-generated collection instead of generating them, which
	 * keeps every request within the CPU limits of Cloudflare Workers.
	 */
	collection?: Collection;
	/** Limits on requests that create rows: registering by client address, puzzles by player. */
	limits?: { register?: Limiter; puzzles?: Limiter };
}

/** Whether a request with this key may go ahead (false once the key used up its allowance). */
export type Limiter = (key: string) => Promise<boolean>;

/**
 * JSON API of the optional server. All game rules are verified with the same logic the client
 * uses. Players are anonymous: a name plus a secret token that doubles as the sync code.
 */

const MAX_SAVE_BYTES = 256 * 1024;
const BOARD_SIZE = 20;

class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
	});

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newToken(): string {
	const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Control and formatting characters, which could hide a name or reverse how the ones next to it
 * read. Joiners (emoji sequences, some scripts) and tag characters (flag emoji) stay.
 */
const INVISIBLE = /[\p{Cc}\p{Cf}]/u;
const KEPT = /\u200c|\u200d|[\u{e0020}-\u{e007f}]/u;
const visible = (text: string) =>
	[...text].filter((c) => !INVISIBLE.test(c) || KEPT.test(c)).join('');

function cleanName(value: unknown): string {
	const name = typeof value === 'string' ? visible(value.replace(/\s+/g, ' ')).trim() : '';
	if (name.length < 1 || name.length > 24)
		throw new HttpError(400, 'Names have 1 to 24 characters');
	if (!/[\p{L}\p{N}\p{P}\p{S}]/u.test(name))
		throw new HttpError(400, 'Names need a visible character');
	return name;
}

/** A save of MAX_SAVE_BYTES characters takes up to three bytes per character in UTF-8. */
const MAX_BODY_BYTES = MAX_SAVE_BYTES * 4;

/** The request body as text, read no further than the limit (a body can be far larger). */
async function readBody(req: Request): Promise<string> {
	const tooLarge = () => new HttpError(413, 'Request too large');
	if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) throw tooLarge();
	if (!req.body) return '';
	const reader = req.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > MAX_BODY_BYTES) {
			await reader.cancel();
			throw tooLarge();
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let at = 0;
	for (const c of chunks) {
		bytes.set(c, at);
		at += c.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

async function body(req: Request): Promise<Record<string, unknown>> {
	const text = await readBody(req);
	try {
		const value = JSON.parse(text);
		if (value && typeof value === 'object') return value;
	} catch {
		/* fall through */
	}
	throw new HttpError(400, 'Invalid JSON');
}

async function auth(req: Request, store: Store) {
	const header = req.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
	const player = token ? await store.playerByToken(await sha256(token)) : null;
	if (!player) throw new HttpError(401, 'Unknown player');
	return player;
}

function formatTime(ms: number) {
	const total = Math.floor(ms / 1000);
	const p2 = (n: number) => String(n).padStart(2, '0');
	const h = Math.floor(total / 3600);
	const m = Math.floor(total / 60) % 60;
	return h > 0 ? `${h}:${p2(m)}:${p2(total % 60)}` : `${p2(m)}:${p2(total % 60)}`;
}

function scopeOf(game: string, variantKey: string, puzzleId: number | null): Scope {
	const logic = gameLogic(game);
	const variant = logic?.variants.find((v) => v.key === variantKey);
	if (!variant) throw new HttpError(400, 'Unknown game or puzzle type');
	// Special types rank one puzzle; regular types rank best times over all puzzles.
	return { game, variant: variantKey, puzzleId: variant.special ? puzzleId : null };
}

const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/** A random puzzle from the collection, preferring ones the player has not had yet. */
async function pickFromCollection(
	collection: Collection,
	game: string,
	variant: string,
	playerId: string,
	store: Store
): Promise<BankEntry | null> {
	const played = await store.playedPuzzles(playerId, game, variant);
	return (
		(await collection.pick(game, variant, (id) => played.has(id), secureRandom)) ??
		(await collection.pick(game, variant, undefined, secureRandom))
	);
}

async function checkLimit(limiter: Limiter | undefined, key: string) {
	if (limiter && !(await limiter(key))) {
		throw new HttpError(429, 'Too many requests, please try again in a minute');
	}
}

/** Hand out a puzzle to a player and remember it; the ID of regular puzzles stays secret. */
async function issuePuzzle(req: Request, store: Store, options: ApiOptions) {
	const player = await auth(req, store);
	await checkLimit(options.limits?.puzzles, player.id);
	const b = await body(req);
	const game = String(b.game);
	const logic = gameLogic(game);
	const index = logic ? logic.variants.findIndex((v) => v.key === b.variant) : -1;
	if (!logic || index < 0) throw new HttpError(400, 'Unknown game or puzzle type');
	const variant = logic.variants[index];
	let puzzleId: number;
	let puzzle: unknown;
	if (options.collection) {
		const entry = variant.special
			? await options.collection.special(game, variant.key, variant.special)
			: await pickFromCollection(options.collection, game, variant.key, player.id, store);
		if (!entry || !logic.isValidPuzzle(entry.puzzle, variant)) {
			throw new HttpError(503, 'No pre-generated puzzle available');
		}
		({ id: puzzleId, puzzle } = entry);
	} else {
		const seed = variant.special
			? specialSeed(game, variant.special, periodKey(variant.special))
			: randomSeed(secureRandom);
		puzzleId = encodePuzzleId(index, seed);
		puzzle = logic.generate(variant, seed);
	}
	const ticket = newToken();
	const issuedAt = Date.now();
	await store.createTicket({
		id: ticket,
		playerId: player.id,
		game,
		variant: variant.key,
		puzzleId,
		puzzle: JSON.stringify(puzzle),
		issuedAt,
		solvedAt: null
	});
	// Special puzzles are the same for everyone, so their ID is no secret.
	return json({ ticket, puzzle, issuedAt, puzzleId: variant.special ? puzzleId : null }, 201);
}

/** Solve of a server-issued puzzle: the stored puzzle and the server clock count. */
async function submitTicket(player: { id: string }, b: Record<string, unknown>, store: Store) {
	const ticket = await store.getTicket(String(b.ticket));
	if (!ticket) {
		// Most likely removed by cleanupTickets; the solve can no longer be verified.
		return json({
			ok: false,
			code: 'expired',
			message: 'Not ranked: the server no longer keeps this old puzzle.'
		});
	}
	if (ticket.playerId !== player.id) throw new HttpError(400, 'Unknown puzzle ticket');
	const logic = gameLogic(ticket.game)!;
	const puzzle = JSON.parse(ticket.puzzle);
	if (typeof b.answer !== 'string' || !logic.verifyAnswer(puzzle, b.answer)) {
		return json({ ok: false, code: 'wrong', message: 'That is not the solution yet.' });
	}
	const now = Date.now();
	if (!(await store.solveTicket(ticket.id, now))) {
		return json({
			ok: true,
			code: 'repeat',
			puzzleId: ticket.puzzleId,
			timeMs: now - ticket.issuedAt,
			message: 'Solved! (You solved this puzzle before.)'
		});
	}
	const timeMs = now - ticket.issuedAt;
	// The personal timer cannot have run longer than the puzzle was out.
	const playMs = Math.min(timeMs, Math.max(0, Math.round(Number(b.playMs)) || 0));
	return recordScore(player, store, {
		game: ticket.game,
		variant: logic.variants.find((v) => v.key === ticket.variant)!,
		puzzleId: ticket.puzzleId,
		timeMs,
		playMs,
		competitive: b.competitive !== false,
		hinted: b.hinted === true,
		unranked: null
	});
}

async function submitScore(req: Request, store: Store, options: ApiOptions) {
	const player = await auth(req, store);
	const b = await body(req);
	if (options.serverPuzzles && typeof b.ticket === 'string') {
		return submitTicket(player, b, store);
	}
	const game = String(b.game);
	const logic = gameLogic(game);
	if (!logic) throw new HttpError(400, 'Unknown game');
	const puzzleId = Number(b.puzzleId);
	if (!Number.isSafeInteger(puzzleId) || puzzleId <= 0)
		throw new HttpError(400, 'Invalid puzzle ID');
	const variant = logic.variants[decodePuzzleId(puzzleId).variantIndex];
	if (!variant || variant.key !== b.variant)
		throw new HttpError(400, 'Puzzle ID does not match its type');
	if (!logic.isValidPuzzle(b.puzzle, variant)) throw new HttpError(400, 'Invalid puzzle');
	const print = await sha256(JSON.stringify(b.puzzle));
	if ((await store.fingerprint(game, puzzleId, print)) !== print) {
		throw new HttpError(400, 'Puzzle does not match its ID');
	}
	if (typeof b.answer !== 'string' || !logic.verifyAnswer(b.puzzle, b.answer)) {
		return json({ ok: false, code: 'wrong', message: 'That is not the solution yet.' });
	}
	const timeMs = Math.round(Number(b.timeMs));
	const playMs = Math.round(Number(b.playMs));
	// Whole milliseconds the database can store; Infinity (`1e400` in JSON) would be no score.
	if (!Number.isSafeInteger(timeMs) || timeMs <= 0 || !Number.isSafeInteger(playMs) || playMs < 0)
		throw new HttpError(400, 'Invalid time');
	return recordScore(player, store, {
		game,
		variant,
		puzzleId,
		timeMs,
		playMs,
		competitive: b.competitive !== false,
		hinted: b.hinted === true,
		// With server puzzles only those are ranked: a client that knows the seed knows the solution.
		unranked: options.serverPuzzles ? 'only puzzles from the server are ranked' : null
	});
}

async function recordScore(
	player: { id: string },
	store: Store,
	s: {
		game: string;
		variant: Variant;
		puzzleId: number;
		timeMs: number;
		playMs: number;
		competitive: boolean;
		/** The player used a hint. */
		hinted: boolean;
		unranked: string | null;
	}
) {
	const { game, variant, puzzleId, timeMs, playMs } = s;
	const competitive = s.competitive && !s.hinted && !s.unranked;
	const added = await store.addScore({
		playerId: player.id,
		game,
		variant: variant.key,
		puzzleId,
		timeMs,
		playMs,
		competitive,
		createdAt: Date.now()
	});
	const shown = s.competitive ? timeMs : playMs;
	const base = { ok: true, puzzleId, timeMs: shown };
	if (!added) {
		return json({
			...base,
			code: 'repeat',
			message: `Solved in ${formatTime(shown)}! (You solved this puzzle before.)`
		});
	}
	if (!competitive) {
		const why = s.hinted ? 'a hint was used' : (s.unranked ?? 'personal timer');
		return json({
			...base,
			code: s.hinted ? 'hinted' : s.unranked ? 'local' : 'personal',
			message: `Solved in ${formatTime(shown)}! Not ranked: ${why}.`
		});
	}
	const scope = scopeOf(game, variant.key, puzzleId);
	const [mine, total] = await Promise.all([store.rank(scope, player.id), store.players(scope)]);
	const best =
		mine && mine.row.timeMs < timeMs ? ` Your best is ${formatTime(mine.row.timeMs)}.` : '';
	return json({
		...base,
		code: 'ranked',
		bestMs: mine?.row.timeMs,
		rank: mine?.rank,
		total,
		message: `Solved in ${formatTime(timeMs)}! Rank ${mine?.rank ?? '–'} of ${total} on ${variant.label}.${best}`
	});
}

async function getBoard(url: URL, req: Request, store: Store) {
	const puzzleId = url.searchParams.get('puzzleId')
		? Number(url.searchParams.get('puzzleId'))
		: null;
	if (puzzleId != null && !Number.isSafeInteger(puzzleId))
		throw new HttpError(400, 'Invalid puzzle ID');
	const scope = scopeOf(
		url.searchParams.get('game') ?? '',
		url.searchParams.get('variant') ?? '',
		puzzleId
	);
	const me = await auth(req, store).catch(() => null);
	const [rows, players, mine] = await Promise.all([
		store.board(scope, BOARD_SIZE),
		store.players(scope),
		me ? store.rank(scope, me.id) : null
	]);
	const entry = (rank: number, r: (typeof rows)[number]) => ({
		rank,
		name: r.name,
		timeMs: r.timeMs,
		playMs: r.playMs,
		puzzleId: r.puzzleId,
		at: new Date(r.createdAt).toISOString(),
		me: r.playerId === me?.id
	});
	return json({
		entries: rows.map((r, i) => entry(i + 1, r)),
		me: mine ? entry(mine.rank, mine.row) : null,
		players
	});
}

/** How long the server keeps puzzle tickets: unsolved ones, and solved ones after the solve. */
export const TICKET_RETENTION_DAYS = { unsolved: 45, solved: 7 };

/**
 * Removes old puzzle tickets (run daily by the Worker's cron trigger). An unsolved ticket that
 * old cannot give a meaningful ranked time; a solved one is only kept to recognise a repeat.
 */
export async function cleanupTickets(store: Store, now = Date.now()): Promise<number> {
	const day = 86_400_000;
	return store.deleteTickets(
		now - TICKET_RETENTION_DAYS.unsolved * day,
		now - TICKET_RETENTION_DAYS.solved * day
	);
}

export async function handleApi(
	req: Request,
	store: Store,
	options: ApiOptions = {}
): Promise<Response> {
	const url = new URL(req.url);
	const path = url.pathname.replace(/^.*?\/api\//, '/');
	const method = req.method;
	try {
		if (path === '/health') return json({ ok: true, serverPuzzles: !!options.serverPuzzles });

		if (path === '/puzzles' && method === 'POST' && options.serverPuzzles) {
			return await issuePuzzle(req, store, options);
		}

		if (path === '/player') {
			if (method === 'POST') {
				await checkLimit(options.limits?.register, req.headers.get('cf-connecting-ip') ?? '');
				const name = cleanName((await body(req)).name);
				const id = crypto.randomUUID();
				const token = newToken();
				await store.createPlayer(id, name, await sha256(token));
				return json({ id, name, token }, 201);
			}
			const player = await auth(req, store);
			if (method === 'GET') return json(player);
			if (method === 'PATCH') {
				const name = cleanName((await body(req)).name);
				await store.renamePlayer(player.id, name);
				return json({ id: player.id, name });
			}
		}

		const save = path.match(/^\/saves\/(.+)$/);
		if (save) {
			let key: string;
			try {
				key = decodeURIComponent(save[1]);
			} catch {
				throw new HttpError(400, 'Invalid key');
			}
			if (key.length > 128) throw new HttpError(400, 'Key too long');
			const player = await auth(req, store);
			if (method === 'GET') {
				const row = await store.getSave(player.id, key);
				if (!row) return json({ key, data: null, updatedAt: 0 });
				return json({ key, data: JSON.parse(row.data), updatedAt: row.updatedAt });
			}
			if (method === 'PUT') {
				const b = await body(req);
				const data = JSON.stringify(b.data ?? null);
				if (data.length > MAX_SAVE_BYTES) throw new HttpError(413, 'Save too large');
				const updatedAt = Number(b.updatedAt);
				if (!Number.isSafeInteger(updatedAt)) throw new HttpError(400, 'Invalid timestamp');
				const stored = await store.putSave(player.id, key, data, updatedAt);
				return json({ stored });
			}
		}

		if (path === '/scores') {
			if (method === 'POST') return await submitScore(req, store, options);
			if (method === 'GET') return await getBoard(url, req, store);
		}

		throw new HttpError(404, 'Not found');
	} catch (e) {
		if (e instanceof HttpError) return json({ error: e.message }, e.status);
		console.error(e);
		return json({ error: 'Server error' }, 500);
	}
}
