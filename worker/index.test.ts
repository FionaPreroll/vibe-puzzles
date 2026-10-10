import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from './index';

describe('worker', () => {
	const env = (serverPuzzles?: string) =>
		({
			DB: {} as D1Database,
			ASSETS: { fetch: vi.fn(async () => new Response('app')) },
			SERVER_PUZZLES: serverPuzzles
		}) as unknown as Env;
	const call = (url: string, e: Env) =>
		worker.fetch(new Request(url) as never, e, {} as ExecutionContext);

	it('answers the API and passes everything else to the static app', async () => {
		const e = env();
		const health = await call('https://example.test/api/health', e);
		expect(await health.json()).toEqual({ ok: true, serverPuzzles: false });
		const page = await call('https://example.test/tetroid', e);
		expect(await page.text()).toBe('app');
		expect(e.ASSETS.fetch).toHaveBeenCalledTimes(1);
	});

	it('limits registering with the REGISTER_LIMIT binding, keyed by client address', async () => {
		const limit = vi.fn(async () => ({ success: false }));
		const e = { ...env(), REGISTER_LIMIT: { limit } } as unknown as Env;
		const req = new Request('https://example.test/api/player', {
			method: 'POST',
			headers: { 'cf-connecting-ip': '203.0.113.7' },
			body: JSON.stringify({ name: 'A' })
		});
		const res = await worker.fetch(req as never, e, {} as ExecutionContext);
		expect(res.status).toBe(429);
		expect(limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
	});

	it('ignores the rate limiters with RATE_LIMITS=off', async () => {
		const limit = vi.fn(async () => ({ success: false }));
		const e = { ...env(), REGISTER_LIMIT: { limit }, RATE_LIMITS: 'off' } as unknown as Env;
		const DB = {
			prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
		};
		const req = new Request('https://example.test/api/player', {
			method: 'POST',
			body: JSON.stringify({ name: 'A' })
		});
		const res = await worker.fetch(req as never, { ...e, DB } as Env, {} as ExecutionContext);
		expect(res.status).toBe(201);
		expect(limit).not.toHaveBeenCalled();
	});

	it('switches server puzzles on with the SERVER_PUZZLES variable', async () => {
		const res = await call('https://example.test/api/health', env('true'));
		expect(await res.json()).toEqual({ ok: true, serverPuzzles: true });
	});

	it('deletes old tickets on the daily schedule, and waits for it', async () => {
		const sql: string[] = [];
		const DB = {
			prepare: (query: string) => {
				sql.push(query);
				return { bind: () => ({ run: async () => ({ meta: { changes: 3 } }) }) };
			}
		};
		const waiting: Promise<unknown>[] = [];
		const ctx = { waitUntil: (p: Promise<unknown>) => waiting.push(p) };
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		await worker.scheduled(
			{} as ScheduledController,
			{ ...env(), DB } as unknown as Env,
			ctx as unknown as ExecutionContext
		);
		expect(waiting).toHaveLength(1);
		await Promise.all(waiting);
		expect(sql).toEqual([expect.stringMatching(/^DELETE FROM tickets/)]);
		expect(log).toHaveBeenCalledWith('Deleted 3 old tickets');
		log.mockRestore();
	});
});
