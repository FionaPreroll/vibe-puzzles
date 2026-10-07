import { handleApi } from './api';
import { D1Store } from './store';

export interface Env {
	DB: D1Database;
	ASSETS: Fetcher;
}

/** Cloudflare Worker: the static app from `build/` plus the JSON API under /api. */
export default {
	async fetch(req, env) {
		const url = new URL(req.url);
		if (url.pathname.startsWith('/api/')) return handleApi(req, new D1Store(env.DB));
		return env.ASSETS.fetch(req);
	}
} satisfies ExportedHandler<Env>;
