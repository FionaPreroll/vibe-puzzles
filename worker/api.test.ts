import { describe, expect, it, vi } from 'vitest';
import { Collection, layoutType, specialPuzzleId } from '../src/lib/core/bank';
import { decodePuzzleId, encodePuzzleId, periodKey } from '../src/lib/core/variants';
import { generateTetroid } from '../src/lib/games/tetroid/generator';
import type { TetroidPuzzle } from '../src/lib/games/tetroid/rules';
import { solveTetroid } from '../src/lib/games/tetroid/solver';
import { cleanupTickets, handleApi, TICKET_RETENTION_DAYS, type ApiOptions } from './api';
import { MemoryStore } from './store';

function client(options: ApiOptions = {}, store = new MemoryStore()) {
	return async (method: string, path: string, body?: unknown, token?: string) => {
		const headers: Record<string, string> = {};
		if (token) headers.authorization = `Bearer ${token}`;
		const res = await handleApi(
			new Request(`https://example.test/api${path}`, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body)
			}),
			store,
			options
		);
		return { status: res.status, body: (await res.json()) as Record<string, unknown> };
	};
}

// 6x6 Normal is variant 0 of Tetroid.
const seed = 4242;
const { puzzle, solution } = generateTetroid(6, 6, 'normal', seed);
const puzzleId = encodePuzzleId(0, seed);
const answer = solution.join('');

describe('api', () => {
	it('reports health', async () => {
		const api = client();
		expect((await api('GET', '/health')).body).toEqual({ ok: true, serverPuzzles: false });
	});

	it('creates, reads and renames players', async () => {
		const api = client();
		const created = await api('POST', '/player', { name: '  Ada  ' });
		expect(created.status).toBe(201);
		expect(created.body.name).toBe('Ada');
		const token = created.body.token as string;
		expect((await api('GET', '/player', undefined, token)).body.name).toBe('Ada');
		expect((await api('PATCH', '/player', { name: 'Grace' }, token)).body.name).toBe('Grace');
		expect((await api('GET', '/player', undefined, 'wrong')).status).toBe(401);
		expect((await api('POST', '/player', { name: '' })).status).toBe(400);
	});

	it('limits registering by client address', async () => {
		const keys: string[] = [];
		const register = async (key: string) => (keys.push(key), keys.length <= 2);
		const api = client({ limits: { register } });
		expect((await api('POST', '/player', { name: 'A' })).status).toBe(201);
		expect((await api('POST', '/player', { name: 'B' })).status).toBe(201);
		const third = await api('POST', '/player', { name: 'C' });
		expect(third).toMatchObject({
			status: 429,
			body: { error: expect.stringContaining('minute') }
		});
		// The test requests carry no Cloudflare client address.
		expect(keys).toEqual(['', '', '']);
	});

	it('keeps the newest save', async () => {
		const api = client();
		const { token } = (await api('POST', '/player', { name: 'A' })).body as { token: string };
		expect((await api('GET', '/saves/save%3Atetroid%3A6n', undefined, token)).body.data).toBeNull();
		await api('PUT', '/saves/save%3Atetroid%3A6n', { data: { v: 2 }, updatedAt: 200 }, token);
		const stale = await api(
			'PUT',
			'/saves/save%3Atetroid%3A6n',
			{ data: { v: 1 }, updatedAt: 100 },
			token
		);
		expect(stale.body.stored).toBe(false);
		const got = await api('GET', '/saves/save%3Atetroid%3A6n', undefined, token);
		expect(got.body).toEqual({ key: 'save:tetroid:6n', data: { v: 2 }, updatedAt: 200 });
	});

	it('verifies and ranks scores', async () => {
		const api = client();
		const a = (await api('POST', '/player', { name: 'A' })).body.token as string;
		const b = (await api('POST', '/player', { name: 'B' })).body.token as string;
		const submit = (token: string, extra: Record<string, unknown> = {}) =>
			api(
				'POST',
				'/scores',
				{
					game: 'tetroid',
					variant: '6n',
					puzzleId,
					puzzle,
					answer,
					timeMs: 60000,
					playMs: 50000,
					competitive: true,
					...extra
				},
				token
			);

		const wrong = await submit(a, { answer: '0'.repeat(36) });
		expect(wrong.body.ok).toBe(false);
		expect((await submit(a, { variant: '6h' })).status).toBe(400);
		const tampered = { ...puzzle, regions: puzzle.regions.slice().reverse() };
		expect((await submit(a, { puzzle: tampered })).status).toBe(400);

		expect((await submit(a, { timeMs: 90000 })).body).toMatchObject({
			ok: true,
			rank: 1,
			total: 1
		});
		expect((await submit(b)).body).toMatchObject({ ok: true, rank: 1, total: 2 });
		expect((await submit(b)).body.message).toContain('before');

		const board = await api('GET', '/scores?game=tetroid&variant=6n', undefined, a);
		const entries = board.body.entries as { name: string; me: boolean }[];
		expect(entries.map((e) => e.name)).toEqual(['B', 'A']);
		expect(entries[1].me).toBe(true);
		expect(board.body.players).toBe(2);
		expect((await api('GET', '/scores?game=nope&variant=6n')).status).toBe(400);
	});

	it('rejects a body that is not a JSON object', async () => {
		for (const text of ['{name: "A"', 'null', '42', '"A"']) {
			const res = await handleApi(
				new Request('https://example.test/api/player', { method: 'POST', body: text }),
				new MemoryStore()
			);
			expect(res.status, text).toBe(400);
			expect(await res.json()).toEqual({ error: 'Invalid JSON' });
		}
	});

	it('rejects a score whose puzzle ID is not a positive whole number', async () => {
		const api = client();
		const token = (await api('POST', '/player', { name: 'A' })).body.token as string;
		for (const id of [0, -puzzleId, puzzleId + 0.5, 2 ** 53, 'abc', null]) {
			const res = await api(
				'POST',
				'/scores',
				{ game: 'tetroid', variant: '6n', puzzleId: id, puzzle, answer, timeMs: 1, playMs: 1 },
				token
			);
			expect(res, String(id)).toEqual({ status: 400, body: { error: 'Invalid puzzle ID' } });
		}
	});

	it('answers an unexpected error with a 500 that does not reveal it', async () => {
		const store = new MemoryStore();
		store.createPlayer = async () => {
			throw new Error('D1_ERROR: no such table: players');
		};
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await client({}, store)('POST', '/player', { name: 'A' });
		expect(res).toEqual({ status: 500, body: { error: 'Server error' } });
		// The details go to the log only.
		expect(logged).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
		logged.mockRestore();
	});

	it('does not rank the personal timer', async () => {
		const api = client();
		const a = (await api('POST', '/player', { name: 'A' })).body.token as string;
		const res = await api(
			'POST',
			'/scores',
			{
				game: 'tetroid',
				variant: '6n',
				puzzleId,
				puzzle,
				answer,
				timeMs: 1000,
				playMs: 900,
				competitive: false
			},
			a
		);
		expect(res.body.ok).toBe(true);
		expect((await api('GET', '/scores?game=tetroid&variant=6n')).body.players).toBe(0);
	});

	it('does not rank a game solved with a hint', async () => {
		const api = client();
		const a = (await api('POST', '/player', { name: 'A' })).body.token as string;
		const res = await api(
			'POST',
			'/scores',
			{
				game: 'tetroid',
				variant: '6n',
				puzzleId,
				puzzle,
				answer,
				timeMs: 1000,
				playMs: 900,
				competitive: true,
				hinted: true
			},
			a
		);
		expect(res.body).toMatchObject({ ok: true, code: 'hinted', timeMs: 1000 });
		expect(res.body.message).toContain('a hint was used');
		expect((await api('GET', '/scores?game=tetroid&variant=6n')).body.players).toBe(0);
	});

	describe('server puzzles', () => {
		async function setup() {
			const api = client({ serverPuzzles: true });
			const token = (await api('POST', '/player', { name: 'A' })).body.token as string;
			const issued = (await api('POST', '/puzzles', { game: 'tetroid', variant: '6n' }, token))
				.body as { ticket: string; puzzle: TetroidPuzzle; issuedAt: number; puzzleId: null };
			const solved = solveTetroid(issued.puzzle, { limit: 1 }).solutions[0].join('');
			return { api, token, issued, solved };
		}

		it('issues puzzles without revealing the seed', async () => {
			const { api, issued } = await setup();
			expect((await api('GET', '/health')).body.serverPuzzles).toBe(true);
			expect(issued.puzzleId).toBeNull();
			expect(issued.puzzle.width).toBe(6);
			expect(typeof issued.ticket).toBe('string');
			expect((await api('POST', '/puzzles', { game: 'tetroid', variant: '6n' })).status).toBe(401);
		});

		it('ranks a ticket with the server clock and reveals the ID', async () => {
			const { api, token, issued, solved } = await setup();
			const submit = (answer: string) =>
				api(
					'POST',
					'/scores',
					{ ticket: issued.ticket, answer, timeMs: 1, playMs: 1, competitive: true },
					token
				);
			expect((await submit('0'.repeat(36))).body.ok).toBe(false);
			const res = await submit(solved);
			expect(res.body).toMatchObject({ ok: true, rank: 1, total: 1 });
			expect(res.body.puzzleId).toBeGreaterThan(0);
			const board = await api('GET', '/scores?game=tetroid&variant=6n');
			const [entry] = board.body.entries as { timeMs: number }[];
			// The claimed 1 ms is ignored in favour of the time since the puzzle was issued.
			expect(entry.timeMs).toBeGreaterThanOrEqual(0);
			expect(entry.timeMs).toBeLessThan(60000);
			expect((await submit(solved)).body.message).toContain('before');
		});

		it('does not rank a ticket solved with a hint', async () => {
			const { api, token, issued, solved } = await setup();
			const res = await api(
				'POST',
				'/scores',
				{ ticket: issued.ticket, answer: solved, timeMs: 1, playMs: 1, hinted: true },
				token
			);
			expect(res.body).toMatchObject({ ok: true, code: 'hinted' });
			expect(res.body.puzzleId).toBeGreaterThan(0);
			expect((await api('GET', '/scores?game=tetroid&variant=6n')).body.players).toBe(0);
		});

		it('does not rank a ticket the server has cleaned up', async () => {
			const store = new MemoryStore();
			const api = client({ serverPuzzles: true }, store);
			const token = (await api('POST', '/player', { name: 'A' })).body.token as string;
			const issued = (await api('POST', '/puzzles', { game: 'tetroid', variant: '6n' }, token))
				.body as { ticket: string; puzzle: TetroidPuzzle; issuedAt: number };
			const day = 86_400_000;
			// Not old enough yet.
			const soon = issued.issuedAt + (TICKET_RETENTION_DAYS.unsolved - 1) * day;
			expect(await cleanupTickets(store, soon)).toBe(0);
			const later = issued.issuedAt + (TICKET_RETENTION_DAYS.unsolved + 1) * day;
			expect(await cleanupTickets(store, later)).toBe(1);
			const solved = solveTetroid(issued.puzzle, { limit: 1 }).solutions[0].join('');
			const res = await api(
				'POST',
				'/scores',
				{ ticket: issued.ticket, answer: solved, timeMs: 1, playMs: 1, competitive: true },
				token
			);
			expect(res.body).toMatchObject({ ok: false, code: 'expired' });
			expect((await api('GET', '/scores?game=tetroid&variant=6n')).body.players).toBe(0);
		});

		it("rejects another player's ticket", async () => {
			const { api, issued, solved } = await setup();
			const other = (await api('POST', '/player', { name: 'B' })).body.token as string;
			const res = await api('POST', '/scores', { ticket: issued.ticket, answer: solved }, other);
			expect(res.status).toBe(400);
		});

		it('does not rank puzzles the client generated', async () => {
			const { api, token } = await setup();
			const res = await api(
				'POST',
				'/scores',
				{
					game: 'tetroid',
					variant: '6n',
					puzzleId,
					puzzle,
					answer,
					timeMs: 1000,
					playMs: 900,
					competitive: true
				},
				token
			);
			expect(res.body.message).toContain('Not ranked');
			expect((await api('GET', '/scores?game=tetroid&variant=6n')).body.players).toBe(0);
		});
	});

	describe('server puzzles from the collection', () => {
		// Variant 10 of Tetroid is the daily special.
		const today = periodKey('daily');
		const dailyId = specialPuzzleId('tetroid', 10, 'daily', today);
		const daily = generateTetroid(10, 10, 'normal', decodePuzzleId(dailyId).seed).puzzle;
		const other = generateTetroid(6, 6, 'normal', 77).puzzle;
		const entries6n = [
			{ id: puzzleId, puzzle },
			{ id: encodePuzzleId(0, 77), puzzle: other }
		];
		const files: Record<string, unknown> = {
			...layoutType('tetroid', '6n', entries6n),
			...layoutType('tetroid', 'daily', [{ id: dailyId, period: today, puzzle: daily }], 'daily'),
			...layoutType('tetroid', '8n', []),
			// A broken puzzle must not be handed out.
			...layoutType('tetroid', '8h', [{ id: 1, puzzle: { width: 3 } }])
		};
		const collection = new Collection(async (path) => files[path] ?? null);

		async function setup() {
			const api = client({ serverPuzzles: true, collection });
			const token = (await api('POST', '/player', { name: 'A' })).body.token as string;
			const issue = (variant: string) =>
				api('POST', '/puzzles', { game: 'tetroid', variant }, token);
			return { api, token, issue };
		}

		it('limits puzzles per player', async () => {
			const used = new Map<string, number>();
			const puzzles = async (key: string) => {
				used.set(key, (used.get(key) ?? 0) + 1);
				return used.get(key)! <= 1;
			};
			const api = client({ serverPuzzles: true, collection, limits: { puzzles } });
			const token = (await api('POST', '/player', { name: 'A' })).body.token as string;
			const other = (await api('POST', '/player', { name: 'B' })).body.token as string;
			const issue = (t: string) => api('POST', '/puzzles', { game: 'tetroid', variant: '6n' }, t);
			expect((await issue(token)).status).toBe(201);
			expect((await issue(token)).status).toBe(429);
			// Every player has an allowance of their own.
			expect((await issue(other)).status).toBe(201);
		});

		it('hands out every puzzle of a type before repeating one', async () => {
			const { issue } = await setup();
			const first = (await issue('6n')).body.puzzle;
			const second = (await issue('6n')).body.puzzle;
			expect([first, second]).toEqual(expect.arrayContaining([puzzle, other]));
			// All played: any of them again.
			expect([puzzle, other]).toContainEqual((await issue('6n')).body.puzzle);
		});

		it('hands out the special puzzle of the current period', async () => {
			const { issue } = await setup();
			const res = await issue('daily');
			expect(res.status).toBe(201);
			expect(res.body).toMatchObject({ puzzle: daily, puzzleId: dailyId });
		});

		it('never generates a puzzle that is not in the collection', async () => {
			const { issue } = await setup();
			for (const variant of ['8n', '8h', '10n', 'weekly']) {
				expect((await issue(variant)).status, variant).toBe(503);
			}
		});

		it('ranks a solve of a collection puzzle and reveals its ID', async () => {
			const { api, token, issue } = await setup();
			const issued = (await issue('6n')).body as { ticket: string; puzzle: TetroidPuzzle };
			const solved = solveTetroid(issued.puzzle, { limit: 1 }).solutions[0].join('');
			const res = await api(
				'POST',
				'/scores',
				{ ticket: issued.ticket, answer: solved, timeMs: 1, playMs: 1, competitive: true },
				token
			);
			expect(res.body).toMatchObject({ ok: true, rank: 1 });
			expect(entries6n.map((p) => p.id)).toContain(res.body.puzzleId);
		});
	});
});
