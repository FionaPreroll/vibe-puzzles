import { describe, expect, it } from 'vitest';
import { encodePuzzleId } from '../src/lib/core/variants';
import { generateTetroid } from '../src/lib/games/tetroid/generator';
import { handleApi } from './api';
import { MemoryStore } from './store';

function client() {
	const store = new MemoryStore();
	return async (method: string, path: string, body?: unknown, token?: string) => {
		const headers: Record<string, string> = {};
		if (token) headers.authorization = `Bearer ${token}`;
		const res = await handleApi(
			new Request(`https://example.test/api${path}`, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body)
			}),
			store
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
		expect((await api('GET', '/health')).body).toEqual({ ok: true });
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
});
