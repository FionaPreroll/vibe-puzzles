import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

/**
 * Offline support: the app shell, static files and all prerendered pages are cached on install,
 * apart from the Inside page's code, which is cached when the page is first opened.
 * Pages are served network first (so updates arrive), everything else cache first. The API is
 * never cached.
 *
 * The puzzle collection is the exception. It is large and keeps growing, so it is not part of the
 * install: each file is cached the first time a puzzle of its type is needed, in a cache that
 * outlives new versions of the app. The app asks for a file with the revision of its type in its
 * version (`?r=`, see collectionUrl in src/lib/client/bank.ts). A cached copy fetched for that
 * revision is served at once; any other copy is replaced from the network first, so a new version
 * never shows puzzles of an older collection. Without a connection the cached copy is served,
 * whatever its revision.
 *
 * In offline mode (the page sends a message when it is switched) nothing goes to the network:
 * pages come from the cache, and a collection file that is not cached fails, so the app generates
 * the puzzle on the device instead.
 */

/** Built files of the Inside page, filled in by the build (`insideFiles` in vite.config.ts). */
declare const __INSIDE_FILES__: string[];

const CACHE = `vibe-puzzles-${version}`;
const COLLECTION = 'vibe-puzzles-collection';
/** Outlives new versions too: holds whether offline mode is on. */
const SETTINGS = 'vibe-puzzles-settings';
const scope = new URL(self.registration.scope);
const url = (path: string) => new URL(path.replace(/^\//, ''), scope).href;
const inCollection = (href: string) => href.startsWith(url('puzzles/'));
/** The Inside page's code: cached when the page is first opened, not on install. */
const INSIDE_FILES = new Set(__INSIDE_FILES__.map(url));
const PRECACHE = [...immutable, ...assets, ...prerendered]
	.map((f) => f.path)
	.filter((path) => !path.split('/').pop()!.startsWith('.'))
	.map(url)
	.filter((href) => !inCollection(href) && !INSIDE_FILES.has(href));
/** The collection files of this version; cached ones that are gone are removed. */
const COLLECTION_FILES = new Set(assets.map((f) => url(f.path)).filter(inCollection));

const OFFLINE_FLAG = url('__offline-mode');
let offline: Promise<boolean> | null = null;
/** Read once per start of the worker; the browser stops idle workers. */
function offlineMode(): Promise<boolean> {
	offline ??= caches
		.open(SETTINGS)
		.then((cache) => cache.match(OFFLINE_FLAG))
		.then((hit) => !!hit)
		.catch(() => false);
	return offline;
}

self.addEventListener('message', (event) => {
	if (event.data?.type !== 'offline') return;
	const on = event.data.offline === true;
	offline = Promise.resolve(on);
	event.waitUntil(
		caches.open(SETTINGS).then(async (cache) => {
			if (on) await cache.put(OFFLINE_FLAG, new Response('1'));
			else await cache.delete(OFFLINE_FLAG);
		})
	);
});

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			// One missing file must not stop the rest from being cached.
			.then((cache) =>
				Promise.allSettled([...new Set([url(''), ...PRECACHE])].map((u) => cache.add(u)))
			)
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => k !== CACHE && k !== COLLECTION && k !== SETTINGS)
						.map((k) => caches.delete(k))
				)
			)
			.then(pruneCollection)
			.then(() => self.clients.claim())
	);
});

async function pruneCollection() {
	const cache = await caches.open(COLLECTION);
	for (const req of await cache.keys()) {
		if (!COLLECTION_FILES.has(req.url)) await cache.delete(req);
	}
}

/** The revision of its type a cached collection file was fetched for. */
const REVISION = 'X-Collection-Revision';

/**
 * Serve a collection file from the cache if it holds the copy of the revision asked for; else from
 * the network, with the cached copy as the fallback. A request without a revision gets the cached
 * copy at once, refreshed in the background.
 */
async function collectionFile(event: FetchEvent): Promise<Response> {
	const target = new URL(event.request.url);
	const revision = target.searchParams.get('r');
	// One copy of each file, whatever revision it was asked for.
	target.search = '';
	const key = target.href;
	const cache = await caches.open(COLLECTION);
	const cached = await cache.match(key);
	if (cached && revision && cached.headers.get(REVISION) === revision) return cached;
	if (await offlineMode()) return cached ?? Response.error();
	const fresh = refresh(cache, key, revision);
	if (cached && !revision) {
		event.waitUntil(fresh.catch(() => undefined));
		return cached;
	}
	return fresh.catch(() => cached ?? Response.error());
}

/** A collection file from the network, cached with the revision it was asked for. */
async function refresh(cache: Cache, key: string, revision: string | null): Promise<Response> {
	// Past the browser's HTTP cache, which may hold an older copy for a few minutes: it asks the
	// server whether its copy is current (usually a cheap "not modified" answer).
	const res = await fetch(key, { cache: 'no-cache' });
	if (!res.ok) return res;
	// Only the type: the body is already decoded.
	const headers = new Headers({ 'Content-Type': res.headers.get('Content-Type') ?? '' });
	if (revision) headers.set(REVISION, revision);
	const copy = new Response(await res.blob(), { headers });
	await cache.put(key, copy.clone()).catch(() => undefined);
	return copy;
}

self.addEventListener('fetch', (event) => {
	const req = event.request;
	const target = new URL(req.url);
	if (req.method !== 'GET' || target.origin !== scope.origin) return;
	if (target.pathname.startsWith(`${scope.pathname}api/`)) return;

	if (req.mode === 'navigate') {
		const fromCache = async () => {
			const cache = await caches.open(CACHE);
			const path = target.pathname.replace(/\/$/, '');
			return (
				(await cache.match(target.origin + path)) ??
				(await cache.match(`${target.origin}${path}.html`)) ??
				(await cache.match(url('')))
			);
		};
		event.respondWith(
			offlineMode().then(async (off) => {
				// Offline mode: the network only for a page that was never cached.
				if (off) return (await fromCache()) ?? fetch(req);
				return fetch(req).catch(async () => (await fromCache()) ?? Response.error());
			})
		);
		return;
	}

	if (inCollection(req.url)) {
		event.respondWith(collectionFile(event));
		return;
	}

	event.respondWith(
		// ignoreVary: module scripts are requested with an Origin header that the cached copy lacks.
		caches
			.match(req, { ignoreVary: true })
			.then((hit) => hit ?? (INSIDE_FILES.has(req.url) ? cacheOnUse(req) : fetch(req)))
	);
});

/** Fetch a file and keep it for next time (offline too). */
async function cacheOnUse(req: Request): Promise<Response> {
	const res = await fetch(req);
	if (res.ok) await (await caches.open(CACHE)).put(req, res.clone());
	return res;
}
