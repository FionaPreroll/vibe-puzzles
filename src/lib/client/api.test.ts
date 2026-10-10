import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';

vi.mock('$app/paths', () => ({ resolve: (path: string) => `/base${path}` }));

type Api = typeof import('./api');
type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

const player = { id: 'p1', name: 'Ada', token: 'secret' };
let fetchMock: ReturnType<typeof vi.fn>;

/** Fresh module (it keeps the health check's answer) with a fake server. */
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

	it('asks static hosting only once', async () => {
		vi.useFakeTimers();
		try {
			const api = await setup(() => new Response('Not found', { status: 404 }));
			expect(await api.serverAvailable()).toBe(false);
			vi.advanceTimersByTime(api.HEALTH_RETRY_MS * 10);
			expect(await api.serverAvailable()).toBe(false);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it('asks again a while after no answer or a server error', async () => {
		vi.useFakeTimers();
		try {
			let up: Handler = offline;
			const api = await setup((url, init) => up(url, init));
			expect(await api.serverAvailable()).toBe(false);
			// Within the retry time the failed answer stands.
			up = server();
			vi.advanceTimersByTime(api.HEALTH_RETRY_MS - 1);
			expect(await api.serverAvailable()).toBe(false);
			expect(fetchMock).toHaveBeenCalledTimes(1);
			vi.advanceTimersByTime(1);
			expect(await api.serverAvailable()).toBe(true);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			// A server error counts like no answer.
			const flaky = await setup(() => Response.json({ error: 'Server error' }, { status: 503 }));
			expect(await flaky.serverAvailable()).toBe(false);
			vi.advanceTimersByTime(api.HEALTH_RETRY_MS);
			await flaky.serverAvailable();
			expect(fetchMock).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	describe('in the browser', () => {
		let doc: EventTarget & { visibilityState: DocumentVisibilityState };

		beforeEach(() => {
			doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as const });
		});

		/** Like setup, with a window and document that get the reconnect listeners. */
		async function setupBrowser(handler: Handler): Promise<{ api: Api; win: EventTarget }> {
			const api = await setup(handler);
			const win = new EventTarget();
			vi.stubGlobal('window', win);
			vi.stubGlobal('document', doc);
			return { api, win };
		}

		it('asks again when the device comes back online and tells the watchers', async () => {
			let up: Handler = offline;
			const { api, win } = await setupBrowser((url, init) => up(url, init));
			const seen: boolean[] = [];
			const stop = api.watchServer((ok) => seen.push(ok));
			await vi.waitFor(() => expect(seen).toEqual([false]));
			up = server();
			win.dispatchEvent(new Event('online'));
			await vi.waitFor(() => expect(seen).toEqual([false, true]));
			expect(await api.serverAvailable()).toBe(true);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			// Stopped watchers hear nothing, and an answer that stands is not asked again.
			stop();
			win.dispatchEvent(new Event('online'));
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it('asks again when the page is shown, not while it is hidden', async () => {
			let up: Handler = offline;
			const { api } = await setupBrowser((url, init) => up(url, init));
			expect(await api.serverAvailable()).toBe(false);
			up = server();
			doc.visibilityState = 'hidden';
			doc.dispatchEvent(new Event('visibilitychange'));
			expect(fetchMock).toHaveBeenCalledTimes(1);
			doc.visibilityState = 'visible';
			doc.dispatchEvent(new Event('visibilitychange'));
			expect(await api.serverAvailable()).toBe(true);
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it('keeps a clear answer when the device goes offline later', async () => {
			let up: Handler = server();
			vi.useFakeTimers({ toFake: ['Date'] });
			try {
				const { api } = await setupBrowser((url, init) => up(url, init));
				const seen: boolean[] = [];
				api.watchServer((ok) => seen.push(ok));
				await vi.waitFor(() => expect(seen).toEqual([true]));
				// Failed requests later on are handled where they happen.
				up = offline;
				vi.setSystemTime(Date.now() + api.HEALTH_RETRY_MS * 10);
				expect(await api.serverAvailable()).toBe(true);
				expect(fetchMock).toHaveBeenCalledTimes(1);
			} finally {
				vi.useRealTimers();
			}
		});
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
		expect(fetchMock).toHaveBeenCalledTimes(1);
		api = await setup(() => new Response('Not found', { status: 404 }), { signedIn: true });
		expect(await api.submitScore({} as never)).toBeNull();
		await api.pushSave('k', {}, 1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(localStorage.getItem('vp:outbox')).toBeNull();
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

describe('outbox and offline mode', () => {
	let doc: EventTarget & { visibilityState: DocumentVisibilityState };
	let win: EventTarget;

	/** A signed-in player in a browser, with the connection state of the fresh module. */
	async function browser(handler: Handler) {
		const api = await setup(handler, { signedIn: true });
		doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as const });
		win = new EventTarget();
		vi.stubGlobal('window', win);
		vi.stubGlobal('document', doc);
		const { net } = await import('./network.svelte');
		const outbox = await import('./outbox');
		return { api, net, outbox };
	}

	const puts = () => requests().filter((r) => r.method === 'PUT');
	const posts = () => requests().filter((r) => r.method === 'POST');
	const routes = {
		'PUT /saves/save%3Aa': { stored: true },
		'POST /scores': { ok: true, code: 'personal', message: 'Solved' }
	};
	const solve = {
		game: 'tetroid',
		variant: '6n',
		puzzleId: 17,
		puzzle: {},
		answer: '01',
		timeMs: 1,
		playMs: 1,
		competitive: true
	};

	it('sends a game played without a connection once the device is back online', async () => {
		let up: Handler = offline;
		const { api, net, outbox } = await browser((url, init) => up(url, init));
		await api.pushSave('save:a', { v: 1 }, 1);
		await api.pushSave('save:a', { v: 2 }, 2);
		expect(net.status).toBe('unreachable');
		expect(net.pending).toBe(1);
		up = server(routes);
		win.dispatchEvent(new Event('online'));
		await vi.waitFor(() => expect(outbox.pendingCount()).toBe(0));
		expect(puts()).toEqual([expect.objectContaining({ body: { data: { v: 2 }, updatedAt: 2 } })]);
		expect(net).toMatchObject({ status: 'online', pending: 0 });
		expect(net.latencyMs).toEqual(expect.any(Number));
	});

	it('keeps what got no answer and drops what the server refuses', async () => {
		let status = 503;
		const { api, outbox } = await browser((url) =>
			url.pathname.endsWith('/health')
				? Response.json({ ok: true })
				: Response.json({ error: 'No' }, { status })
		);
		await api.pushSave('save:a', {}, 1);
		expect(outbox.pendingCount()).toBe(1);
		status = 400;
		await api.flushOutbox();
		expect(outbox.pendingCount()).toBe(0);
	});

	it('marks the server unreachable when a request gets no answer', async () => {
		let up: Handler = server(routes);
		const { api, net } = await browser((url, init) => up(url, init));
		const seen: boolean[] = [];
		api.watchServer((ok) => seen.push(ok));
		await vi.waitFor(() => expect(seen).toEqual([true]));
		up = offline;
		await api.pushSave('save:a', {}, 1);
		expect(seen).toEqual([true, false]);
		expect(net).toMatchObject({ status: 'unreachable', pending: 1 });
		win.dispatchEvent(new Event('offline'));
		up = server(routes);
		doc.dispatchEvent(new Event('visibilitychange'));
		await vi.waitFor(() => expect(seen).toEqual([true, false, true]));
		await vi.waitFor(() => expect(net.pending).toBe(0));
	});

	it('keeps solves timed on the device for later, but not ranked ones', async () => {
		let up: Handler = offline;
		const { api, outbox } = await browser((url, init) => up(url, init));
		expect(await api.submitScore(solve)).toBe('queued');
		await expect(api.submitScore({ ...solve, ticket: 't' })).rejects.toThrow('no connection');
		expect(outbox.pending().scores).toEqual([solve]);
		up = server(routes);
		win.dispatchEvent(new Event('online'));
		await vi.waitFor(() => expect(outbox.pendingCount()).toBe(0));
		expect(posts()).toEqual([expect.objectContaining({ body: solve })]);
	});

	it('queues a solve whose upload gets no answer', async () => {
		let up: Handler = server(routes);
		const { api, outbox } = await browser((url, init) => up(url, init));
		expect(await api.serverAvailable()).toBe(true);
		up = (url, init) =>
			url.pathname.endsWith('/scores') ? offline(url, init) : server(routes)(url, init);
		await expect(api.submitScore({ ...solve, ticket: 't' })).rejects.toThrow('Failed to fetch');
		// Now known to be unreachable.
		expect(await api.submitScore(solve)).toBe('queued');
		expect(outbox.pending().scores).toEqual([solve]);
	});

	it('sends nothing in offline mode until "Sync now"', async () => {
		const { api, net, outbox } = await browser(server(routes, true));
		api.setOfflineMode(true);
		expect(localStorage.getItem('vp:offlineMode')).toBe('true');
		expect(net.status).toBe('offline');
		expect(await api.serverAvailable()).toBe(false);
		expect(await api.serverPuzzles()).toBe(false);
		expect(await api.pullSave('save:a')).toBeNull();
		await api.pushSave('save:a', { v: 1 }, 1);
		expect(await api.submitScore(solve)).toBe('queued');
		await expect(api.leaderboard('tetroid', '6n')).rejects.toThrow('Offline mode is on.');
		win.dispatchEvent(new Event('online'));
		expect(fetchMock).not.toHaveBeenCalled();
		expect(net.pending).toBe(2);

		const pull = vi.fn(async () => api.pullSave('save:a'));
		const stop = api.onSync(pull);
		expect(await api.syncNow()).toBe(true);
		expect(outbox.pendingCount()).toBe(0);
		expect(puts()).toHaveLength(1);
		expect(posts()).toEqual([expect.objectContaining({ body: solve })]);
		expect(pull).toHaveBeenCalledTimes(1);
		expect(net).toMatchObject({ status: 'offline', syncing: false, pending: 0 });
		expect(net.lastSync).toEqual(expect.any(Number));
		// Still offline afterwards.
		const calls = fetchMock.mock.calls.length;
		expect(await api.serverAvailable()).toBe(false);
		stop();
		await api.syncNow();
		expect(pull).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls.length).toBe(calls + 1);
	});

	it('asks the server again when offline mode is switched off', async () => {
		const { api, net } = await browser(server(routes));
		api.setOfflineMode(true);
		const seen: boolean[] = [];
		api.watchServer((ok) => seen.push(ok));
		await vi.waitFor(() => expect(seen).toEqual([false]));
		api.setOfflineMode(false);
		await vi.waitFor(() => expect(seen).toEqual([false, true]));
		expect(net.status).toBe('online');
		api.setOfflineMode(true);
		expect(seen).toEqual([false, true, false]);
	});

	it('reports a failed "Sync now"', async () => {
		const { api, net } = await browser(offline);
		api.setOfflineMode(true);
		expect(await api.syncNow()).toBe(false);
		expect(net).toMatchObject({ status: 'offline', syncing: false, lastSync: null });
	});

	it('never asks a server in a build without one', async () => {
		const { api, net } = await browser(server(routes));
		net.hasServer = false;
		net.status = 'none';
		expect(await api.serverAvailable()).toBe(false);
		await api.pushSave('save:a', {}, 1);
		expect(await api.submitScore(solve)).toBeNull();
		expect(await api.syncNow()).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('forgets waiting uploads on sign out', async () => {
		const { api, net, outbox } = await browser(offline);
		await api.pushSave('save:a', {}, 1);
		expect(net.pending).toBe(1);
		api.signOut();
		expect(outbox.pendingCount()).toBe(0);
		expect(net.pending).toBe(0);
	});
});

describe('ping', () => {
	it('asks afresh for the latency, but never in offline mode or without a server', async () => {
		let api = await setup(server());
		expect(await api.pingServer()).toBe(true);
		expect(await api.pingServer()).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		api.setOfflineMode(true);
		expect(await api.pingServer()).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		api = await setup(() => new Response('Not found', { status: 404 }));
		expect(await api.pingServer()).toBe(false);
		expect(await api.pingServer()).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('connection edge cases', () => {
	let win: EventTarget;
	let doc: EventTarget & { visibilityState: DocumentVisibilityState };

	async function browser(handler: Handler, signedIn = true) {
		const api = await setup(handler, { signedIn });
		doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as const });
		win = new EventTarget();
		vi.stubGlobal('window', win);
		vi.stubGlobal('document', doc);
		const { net } = await import('./network.svelte');
		const outbox = await import('./outbox');
		return { api, net, outbox };
	}

	const solve = {
		game: 'tetroid',
		variant: '6n',
		puzzleId: 17,
		puzzle: {},
		answer: '01',
		timeMs: 1,
		playMs: 1,
		competitive: true
	};

	it('"Sync now" while online refreshes the state and sends what waits', async () => {
		let up: Handler = offline;
		const { api, net, outbox } = await browser((url, init) => up(url, init));
		await api.pushSave('save:a', {}, 1);
		expect(net.status).toBe('unreachable');
		up = server({ 'PUT /saves/save%3Aa': {} });
		const pull = vi.fn(async () => {
			throw new Error('a failing page does not stop the sync');
		});
		api.onSync(pull);
		expect(await api.syncNow()).toBe(true);
		expect(net.status).toBe('online');
		expect(outbox.pendingCount()).toBe(0);
		expect(pull).toHaveBeenCalled();
	});

	it('"Sync now" retries what an upload already under way could not send', async () => {
		let answer: (r: Response) => void = () => undefined;
		let puts = 0;
		const { api, outbox } = await browser((url, init) => {
			if (url.pathname.endsWith('/health')) return Response.json({ ok: true });
			if (init.method === 'PUT' && ++puts === 1) return new Promise((r) => (answer = r));
			return Response.json({});
		});
		expect(await api.serverAvailable()).toBe(true);
		void api.pushSave('save:a', {}, 1);
		await vi.waitFor(() => expect(puts).toBe(1));
		const synced = api.syncNow();
		await new Promise((r) => setTimeout(r));
		answer(Response.json({ error: 'busy' }, { status: 503 }));
		expect(await synced).toBe(true);
		expect(puts).toBe(2);
		expect(outbox.pendingCount()).toBe(0);
	});

	it('"Sync now" in offline mode on hosting without a server forgets what waits', async () => {
		const { api, net, outbox } = await browser(() => new Response('Not found', { status: 404 }));
		api.setOfflineMode(true);
		await api.pushSave('save:a', {}, 1);
		expect(outbox.pendingCount()).toBe(1);
		expect(await api.syncNow()).toBe(false);
		expect(net.status).toBe('offline');
		expect(outbox.pendingCount()).toBe(0);
	});

	it('switching offline mode does nothing twice and only remembers it without a server', async () => {
		const { api, net } = await browser(server());
		expect(await api.serverAvailable()).toBe(true);
		api.setOfflineMode(false);
		api.setOfflineMode(true);
		api.setOfflineMode(true);
		api.setOfflineMode(false);
		// The server answered before, so it counts as online right away.
		expect(net.status).toBe('online');
		net.hasServer = false;
		api.setOfflineMode(true);
		expect(net).toMatchObject({ offline: true, status: 'online' });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('ignores the browser going offline in offline mode and on static hosting', async () => {
		const { api, net } = await browser(() => new Response('Not found', { status: 404 }));
		expect(await api.serverAvailable()).toBe(false);
		win.dispatchEvent(new Event('offline'));
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(net.status).toBe('none');
		api.setOfflineMode(true);
		win.dispatchEvent(new Event('offline'));
		expect(net.status).toBe('offline');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('a failed request before any health check changes nothing', async () => {
		const { api, net } = await browser(offline, false);
		await expect(api.register('Ada')).rejects.toThrow('Failed to fetch');
		expect(net.status).toBe('checking');
	});

	it('uploads at once when storage is too full to wait', async () => {
		const { api, outbox } = await browser(server({ 'PUT /saves/save%3Aa': {} }));
		(localStorage as unknown as MemoryStorage).full = true;
		await api.pushSave('save:a', { v: 1 }, 1);
		expect(requests().at(-1)).toMatchObject({ method: 'PUT', body: { data: { v: 1 } } });
		expect(outbox.pendingCount()).toBe(0);
		// A refused upload is lost quietly, as before the outbox.
		await expect(api.pushSave('save:b', {}, 1)).resolves.toBeUndefined();
		api.setOfflineMode(true);
		await api.pushSave('save:a', { v: 2 }, 2);
		expect(requests()).toHaveLength(3);
	});

	it('keeps a waiting solve while the server cannot take it', async () => {
		let status = 503;
		const { api, outbox } = await browser((url) =>
			url.pathname.endsWith('/health')
				? Response.json({ ok: true })
				: Response.json({ error: 'No' }, { status })
		);
		expect(await api.submitScore(solve)).toBe('queued');
		await api.flushOutbox();
		expect(outbox.pending().scores).toEqual([solve]);
		status = 400;
		await expect(api.submitScore({ ...solve, puzzleId: 18 })).rejects.toThrow('No');
		await api.flushOutbox();
		expect(outbox.pendingCount()).toBe(0);
	});

	it('submits nothing without a player', async () => {
		const { api } = await browser(server(), false);
		expect(await api.submitScore(solve)).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
