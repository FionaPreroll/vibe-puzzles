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

	it('switches server puzzles on with the SERVER_PUZZLES variable', async () => {
		const res = await call('https://example.test/api/health', env('true'));
		expect(await res.json()).toEqual({ ok: true, serverPuzzles: true });
	});
});
