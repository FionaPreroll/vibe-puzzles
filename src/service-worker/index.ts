import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

/**
 * Offline support: the app shell, static files and all prerendered pages are cached on install.
 * Pages are served network first (so updates arrive), everything else cache first. The API is
 * never cached.
 *
 * The puzzle collection is the exception. It is large and keeps growing, so it is not part of the
 * install: each file is cached the first time a puzzle of its type is needed, in a cache that
 * outlives new versions of the app. Such a file is served from that cache at once and refreshed in
 * the background (usually a cheap "not modified" answer).
 */

const CACHE = `vibe-puzzles-${version}`;
const COLLECTION = 'vibe-puzzles-collection';
const scope = new URL(self.registration.scope);
const url = (path: string) => new URL(path.replace(/^\//, ''), scope).href;
const inCollection = (href: string) => href.startsWith(url('puzzles/'));
const PRECACHE = [...immutable, ...assets, ...prerendered]
	.map((f) => f.path)
	.filter((path) => !path.split('/').pop()!.startsWith('.'))
	.map(url)
	.filter((href) => !inCollection(href));
/** The collection files of this version; cached ones that are gone are removed. */
const COLLECTION_FILES = new Set(assets.map((f) => url(f.path)).filter(inCollection));

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
					keys.filter((k) => k !== CACHE && k !== COLLECTION).map((k) => caches.delete(k))
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

/** Serve a collection file from the cache if there is one, and refresh it from the network. */
async function collectionFile(event: FetchEvent): Promise<Response> {
	const cache = await caches.open(COLLECTION);
	const cached = await cache.match(event.request);
	const fresh = fetch(event.request).then(async (res) => {
		if (res.ok) await cache.put(event.request, res.clone());
		return res;
	});
	if (!cached) return fresh;
	event.waitUntil(fresh.catch(() => undefined));
	return cached;
}

self.addEventListener('fetch', (event) => {
	const req = event.request;
	const target = new URL(req.url);
	if (req.method !== 'GET' || target.origin !== scope.origin) return;
	if (target.pathname.startsWith(`${scope.pathname}api/`)) return;

	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req).catch(async () => {
				const cache = await caches.open(CACHE);
				const path = target.pathname.replace(/\/$/, '');
				return (
					(await cache.match(target.origin + path)) ??
					(await cache.match(`${target.origin}${path}.html`)) ??
					(await cache.match(url(''))) ??
					Response.error()
				);
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
		caches.match(req, { ignoreVary: true }).then((hit) => hit ?? fetch(req))
	);
});
