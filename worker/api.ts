import { GAME_LOGIC } from '../src/lib/games/logic';
import { decodePuzzleId } from '../src/lib/core/variants';
import type { Scope, Store } from './store';

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

function cleanName(value: unknown): string {
	const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
	if (name.length < 1 || name.length > 24)
		throw new HttpError(400, 'Names have 1 to 24 characters');
	return name;
}

async function body(req: Request): Promise<Record<string, unknown>> {
	const text = await req.text();
	if (text.length > MAX_SAVE_BYTES * 2) throw new HttpError(413, 'Request too large');
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
	const logic = GAME_LOGIC[game];
	const variant = logic?.variants.find((v) => v.key === variantKey);
	if (!variant) throw new HttpError(400, 'Unknown game or puzzle type');
	// Special types rank one puzzle; regular types rank best times over all puzzles.
	return { game, variant: variantKey, puzzleId: variant.special ? puzzleId : null };
}

async function submitScore(req: Request, store: Store) {
	const player = await auth(req, store);
	const b = await body(req);
	const game = String(b.game);
	const logic = GAME_LOGIC[game];
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
		return json({ ok: false, message: 'That is not the solution yet.' });
	}
	const timeMs = Math.round(Number(b.timeMs));
	const playMs = Math.round(Number(b.playMs));
	if (!(timeMs > 0) || !(playMs >= 0)) throw new HttpError(400, 'Invalid time');
	const competitive = b.competitive !== false;

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
	const shown = competitive ? timeMs : playMs;
	if (!added) {
		return json({
			ok: true,
			message: `Solved in ${formatTime(shown)}! (You solved this puzzle before.)`
		});
	}
	if (!competitive) {
		return json({
			ok: true,
			message: `Solved in ${formatTime(shown)}! Personal timer: not ranked.`
		});
	}
	const scope = scopeOf(game, variant.key, puzzleId);
	const [mine, total] = await Promise.all([store.rank(scope, player.id), store.players(scope)]);
	const best =
		mine && mine.row.timeMs < timeMs ? ` Your best is ${formatTime(mine.row.timeMs)}.` : '';
	return json({
		ok: true,
		rank: mine?.rank,
		total,
		message: `Solved in ${formatTime(timeMs)}! Rank ${mine?.rank ?? '–'} of ${total} on ${variant.label}.${best}`
	});
}

async function getBoard(url: URL, req: Request, store: Store) {
	const puzzleId = url.searchParams.get('puzzleId');
	const scope = scopeOf(
		url.searchParams.get('game') ?? '',
		url.searchParams.get('variant') ?? '',
		puzzleId ? Number(puzzleId) : null
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

export async function handleApi(req: Request, store: Store): Promise<Response> {
	const url = new URL(req.url);
	const path = url.pathname.replace(/^.*?\/api\//, '/');
	const method = req.method;
	try {
		if (path === '/health') return json({ ok: true });

		if (path === '/player') {
			if (method === 'POST') {
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
			const key = decodeURIComponent(save[1]);
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
			if (method === 'POST') return await submitScore(req, store);
			if (method === 'GET') return await getBoard(url, req, store);
		}

		throw new HttpError(404, 'Not found');
	} catch (e) {
		if (e instanceof HttpError) return json({ error: e.message }, e.status);
		console.error(e);
		return json({ error: 'Server error' }, 500);
	}
}
