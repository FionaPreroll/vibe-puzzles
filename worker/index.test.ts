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

	it('switches server puzzles on with the SERVER_PUZZLES variable', async () => {
		const res = await call('https://example.test/api/health', env('true'));
		expect(await res.json()).toEqual({ ok: true, serverPuzzles: true });
	});
});
