import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';

vi.mock('$app/paths', () => ({ resolve: (path: string) => `/base${path}` }));

type Api = typeof import('./api');
type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

const player = { id: 'p1', name: 'Ada', token: 'secret' };
let fetchMock: ReturnType<typeof vi.fn>;

/** Fresh module (the health check is cached per page load) with a fake server. */
async function setup(handler: Handler, opts: { signedIn?: boolean } = {}): Promise<Api> {
	vi.resetModules();
	vi.stubGlobal('localStorage', new MemoryStorage());
	if (opts.signedIn) localStorage.setItem('vp:player', JSON.stringify(player));
	fetchMock = vi.fn(async (input: string, init: RequestInit = {}) =>
		handler(new URL(input, 'https://example.test'), init)
	);
	vi.stubGlobal('fetch', fetchMock);
	return import('./api');
}

/** A server that is up and answers the given routes ("METHOD /path"). */
function server(routes: Record<string, unknown> = {}, serverPuzzles = false): Handler {
	return (url, init) => {
		const path = url.pathname.replace('/base/api', '');
		if (path === '/health') return Response.json({ ok: true, serverPuzzles });
		const route = `${init.method ?? 'GET'} ${path}`;
		if (!(route in routes)) return Response.json({ error: `No route ${route}` }, { status: 404 });
		return Response.json(routes[route]);
	};
}

const offline: Handler = () => {
	throw new TypeError('Failed to fetch');
};

const requests = () =>
	(fetchMock.mock.calls as [string, RequestInit | undefined][]).map(([url, init]) => ({
		url,
		method: init?.method ?? 'GET',
		auth: new Headers(init?.headers).get('authorization'),
		body: init?.body ? JSON.parse(String(init.body)) : undefined
	}));

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('server availability', () => {
	it('checks the health once and reports server puzzles only to players', async () => {
		let api = await setup(server({}, true));
		expect(await api.serverAvailable()).toBe(true);
		expect(await api.serverPuzzles()).toBe(false);
		api = await setup(server({}, true), { signedIn: true });
		expect(await api.serverPuzzles()).toBe(true);
		expect(await api.serverAvailable()).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(requests()[0].url).toBe('/base/api/health');
	});

	it('stays off on static hosting', async () => {
		let api = await setup(() => new Response('Not found', { status: 404 }));
		expect(await api.serverAvailable()).toBe(false);
		api = await setup(offline, { signedIn: true });
		expect(await api.serverAvailable()).toBe(false);
		expect(await api.serverPuzzles()).toBe(false);
		api = await setup(() => new Response('<html>'));
		expect(await api.serverAvailable()).toBe(false);
	});
});

describe('players', () => {
	it('registers and stores the player', async () => {
		const api = await setup(server({ 'POST /player': player }));
		expect(api.currentPlayer()).toBeNull();
		expect(await api.register('Ada')).toEqual(player);
		expect(api.currentPlayer()).toEqual(player);
		expect(requests()[0]).toMatchObject({ method: 'POST', body: { name: 'Ada' }, auth: null });
	});

	it('links a device by its sync code', async () => {
		const api = await setup((url, init) =>
			new Headers(init.headers).get('authorization') === 'Bearer abcd1234'
				? Response.json({ id: 'p1', name: 'Ada' })
				: Response.json({ error: 'Unknown player' }, { status: 401 })
		);
		expect(await api.linkDevice('abcd-1234 ')).toEqual({
			id: 'p1',
			name: 'Ada',
			token: 'abcd1234'
		});
		expect(api.currentPlayer()?.token).toBe('abcd1234');
		await expect(api.linkDevice('wrong')).rejects.toThrow('Unknown sync code');
	});

	it('renames and signs out', async () => {
		const api = await setup(server({ 'PATCH /player': { id: 'p1', name: 'Grace' } }), {
			signedIn: true
		});
		expect(await api.rename('Grace')).toEqual({ ...player, name: 'Grace' });
		expect(requests()[0]).toMatchObject({ auth: 'Bearer secret', body: { name: 'Grace' } });
		api.signOut();
		expect(api.currentPlayer()).toBeNull();
	});

	it('reports the error the server sends', async () => {
		let api = await setup(() =>
			Response.json({ error: 'Names have 1 to 24 characters' }, { status: 400 })
		);
		await expect(api.register('')).rejects.toThrow('Names have 1 to 24 characters');
		api = await setup(() => new Response('oops', { status: 502 }));
		await expect(api.register('A')).rejects.toThrow('Request failed (502)');
	});
});

describe('saves', () => {
	it('pulls and pushes saves of a signed-in player', async () => {
		const save = { key: 'save:tetroid:6n', data: { v: 1 }, updatedAt: 5 };
		const api = await setup(
			server({
				'GET /saves/save%3Atetroid%3A6n': save,
				'GET /saves/empty': { key: 'empty', data: null, updatedAt: 0 },
				'PUT /saves/save%3Atetroid%3A6n': { stored: true }
			}),
			{ signedIn: true }
		);
		expect(await api.pullSave('save:tetroid:6n')).toEqual(save);
		expect(await api.pullSave('empty')).toBeNull();
		expect(await api.pullSave('missing')).toBeNull();
		await api.pushSave('save:tetroid:6n', { v: 2 }, 9);
		await api.pushSave('missing', {}, 1);
		expect(requests().at(-2)).toMatchObject({
			method: 'PUT',
			body: { data: { v: 2 }, updatedAt: 9 }
		});
	});

	it('does nothing without a player or a server', async () => {
		let api = await setup(server());
		expect(await api.pullSave('k')).toBeNull();
		await api.pushSave('k', {}, 1);
		expect(fetchMock).not.toHaveBeenCalled();
		api = await setup(offline, { signedIn: true });
		expect(await api.pullSave('k')).toBeNull();
		await api.pushSave('k', {}, 1);
		expect(await api.submitScore({} as never)).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('puzzles and scores', () => {
	it('asks the server for a puzzle', async () => {
		const issued = { ticket: 't', puzzle: {}, issuedAt: 1, puzzleId: null };
		const api = await setup(server({ 'POST /puzzles': issued }, true), { signedIn: true });
		expect(await api.issuePuzzle('tetroid', '6n')).toEqual(issued);
		expect(requests()[0].body).toEqual({ game: 'tetroid', variant: '6n' });
	});

	it('submits solves and reads leaderboards', async () => {
		const result = { ok: true, code: 'ranked', message: 'Rank 1' };
		const board = { entries: [], me: null, players: 0 };
		const api = await setup(
			(url, init) =>
				url.pathname.endsWith('/health')
					? Response.json({ ok: true })
					: Response.json(init.method === 'POST' ? result : { ...board, query: url.search }),
			{ signedIn: true }
		);
		const submission = {
			game: 'tetroid',
			variant: '6n',
			puzzleId: 17,
			puzzle: {},
			answer: '01',
			timeMs: 1,
			playMs: 1,
			competitive: true
		};
		expect(await api.submitScore(submission)).toEqual(result);
		expect(requests()[1].body).toEqual(submission);
		expect(await api.leaderboard('tetroid', '6n')).toMatchObject({
			query: '?game=tetroid&variant=6n'
		});
		expect(await api.leaderboard('tetroid', 'daily', 42)).toMatchObject({
			query: '?game=tetroid&variant=daily&puzzleId=42'
		});
	});
});
