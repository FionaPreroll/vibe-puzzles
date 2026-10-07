import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

/**
 * Offline support: the app shell, static files and all prerendered pages are cached on install.
 * Pages are served network first (so updates arrive), everything else cache first. The API is
 * never cached.
 */

const CACHE = `vibe-puzzles-${version}`;
const scope = new URL(self.registration.scope);
const url = (path: string) => new URL(path.replace(/^\//, ''), scope).href;
const PRECACHE = [...immutable, ...assets, ...prerendered]
	.map((f) => f.path)
	.filter((path) => !path.split('/').pop()!.startsWith('.'))
	.map(url);

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
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

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

	event.respondWith(
		// ignoreVary: module scripts are requested with an Origin header that the cached copy lacks.
		caches.match(req, { ignoreVary: true }).then(
			(hit) =>
				hit ??
				fetch(req).then(async (res) => {
					// Puzzle collection files: keep a copy for offline play.
					if (res.ok && target.pathname.includes('/puzzles/')) {
						(await caches.open(CACHE)).put(req, res.clone());
					}
					return res;
				})
		)
	);
});
