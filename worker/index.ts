import { handleApi } from './api';
import { assetBank } from './bank';
import { D1Store } from './store';

export interface Env {
	DB: D1Database;
	ASSETS: Fetcher;
	/** "true" to generate puzzles on the server (see README). */
	SERVER_PUZZLES?: string;
}

/** Cloudflare Worker: the static app from `build/` plus the JSON API under /api. */
export default {
	async fetch(req, env) {
		const url = new URL(req.url);
		if (url.pathname.startsWith('/api/'))
			return handleApi(req, new D1Store(env.DB), {
				serverPuzzles: env.SERVER_PUZZLES === 'true',
				// The deployed server never generates puzzles itself: it hands out pre-generated ones.
				bank: assetBank(env.ASSETS)
			});
		return env.ASSETS.fetch(req);
	}
} satisfies ExportedHandler<Env>;
