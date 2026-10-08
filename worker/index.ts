import { cleanupTickets, handleApi, type Limiter } from './api';
import { assetBank } from './bank';
import { D1Store } from './store';

export interface Env {
	DB: D1Database;
	ASSETS: Fetcher;
	/** "true" to hand out puzzles from the server (see README). */
	SERVER_PUZZLES?: string;
	/** Rate limiters (`ratelimits` in wrangler.jsonc); without them requests are not limited. */
	REGISTER_LIMIT?: RateLimit;
	PUZZLE_LIMIT?: RateLimit;
}

/** A Cloudflare rate limiter as the API expects it. */
const limiter = (binding: RateLimit | undefined): Limiter | undefined =>
	binding && (async (key) => (await binding.limit({ key })).success);

/** Cloudflare Worker: the static app from `build/` plus the JSON API under /api. */
export default {
	async fetch(req, env) {
		const url = new URL(req.url);
		if (url.pathname.startsWith('/api/'))
			return handleApi(req, new D1Store(env.DB), {
				serverPuzzles: env.SERVER_PUZZLES === 'true',
				// The deployed server never generates puzzles itself: it hands out pre-generated ones.
				bank: assetBank(env.ASSETS),
				limits: { register: limiter(env.REGISTER_LIMIT), puzzles: limiter(env.PUZZLE_LIMIT) }
			});
		return env.ASSETS.fetch(req);
	},

	/** Daily housekeeping (`triggers.crons` in wrangler.jsonc). */
	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(
			cleanupTickets(new D1Store(env.DB)).then((n) => console.log(`Deleted ${n} old tickets`))
		);
	}
} satisfies ExportedHandler<Env>;
