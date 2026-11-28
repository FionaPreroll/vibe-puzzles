import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { collectionRevisions } from '../scripts/revisions';

test('home lists the games', { tag: '@webkit' }, async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Tetroid' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Pinwheel' })).toBeVisible();
});

const SMALLEST: Record<string, string> = { tetroid: '6n', bridges: '7n' };
for (const game of ['tetroid', 'pinwheel', 'loop', 'pipes', 'bridges', 'pixels']) {
	test(`${game} generates and renders a board`, { tag: '@webkit' }, async ({ page }) => {
		await page.goto(`/${game}?v=${SMALLEST[game] ?? '5n'}`);
		await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole('application', { name: 'Puzzle board' }).first()).toBeVisible();
	});
}

test(
	'the first visit opens the tutorial, which can be solved',
	{ tag: '@webkit' },
	async ({ page }) => {
		await page.goto('/tetroid');
		await expect(page).toHaveURL(/\/tetroid\/tutorial$/);
		const board = page.getByRole('application', { name: 'Puzzle board' });
		const box = (await board.boundingBox())!;
		const cell = box.width / 5;
		// The remaining tetrominoes: L top right, S on the right, I at the bottom.
		for (const [r, c] of [
			[0, 2],
			[0, 3],
			[0, 4],
			[1, 2],
			[1, 4],
			[2, 3],
			[2, 4],
			[3, 3],
			[4, 0],
			[4, 1],
			[4, 2],
			[4, 3]
		]) {
			await page.mouse.click(box.x + (c + 0.5) * cell, box.y + (r + 0.5) * cell);
		}
		await expect(page.getByText('Well done!')).toBeVisible();
		await page.getByRole('link', { name: 'Play a real puzzle' }).click();
		await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	}
);

test('switches to German', async ({ page }) => {
	await page.goto('/');
	// A choice made before the page has hydrated goes unnoticed.
	await page.waitForLoadState('networkidle');
	await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
	await expect(page.getByRole('heading', { name: /Logikrätsel/ })).toBeVisible();
});

test(
	'a Pinwheel line dragged from a clicked edge keeps that edge',
	{ tag: '@webkit' },
	async ({ page }) => {
		await page.goto('/pinwheel/tutorial');
		const board = page.getByRole('application', { name: 'Puzzle board' });
		// The tutorial's board is prerendered: a drag before the page has hydrated goes unnoticed.
		await page.waitForLoadState('networkidle');
		const box = (await board.boundingBox())!;
		const cell = box.width / 5;
		// Press on the edge between dots (3,0) and (3,1), left of its middle, and drag right to (3,2).
		const y = box.y + 3 * cell;
		await page.mouse.move(box.x + 0.5 * cell, y);
		await page.mouse.down();
		for (const x of [0.7, 0.9, 1.1, 1.4, 1.7, 2.1]) await page.mouse.move(box.x + x * cell, y);
		await page.mouse.up();
		await expect(board.locator('[data-line="h:3:0"]')).toHaveCount(1);
		await expect(board.locator('[data-line="h:3:1"]')).toHaveCount(1);
	}
);

test('works offline after the first visit', async ({ page, context }) => {
	await page.goto('/');
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
		}
	});
	await context.setOffline(true);
	await page.goto('/tetroid?v=6n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole('application', { name: 'Puzzle board' })).toBeVisible();
	await context.setOffline(false);
});

test("a new service worker removes this app's old caches and keeps other apps' caches", async ({
	page
}) => {
	const controlled = () =>
		page.evaluate(async () => {
			await navigator.serviceWorker.ready;
			if (!navigator.serviceWorker.controller) {
				await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
			}
		});
	await page.goto('/');
	await controlled();
	// Another app on the same origin (all GitHub Pages sites of an account share one), and a cache
	// of an older version of this app.
	await page.evaluate(async () => {
		await (await caches.open('other-app-v1')).put('/other', new Response('kept'));
		await (await caches.open('vibe-puzzles-0')).put('/old', new Response('gone'));
		await (await navigator.serviceWorker.getRegistration())!.unregister();
	});
	// The page registers the worker again, which installs and activates as a new version would.
	await page.reload();
	await controlled();
	await expect
		.poll(() => page.evaluate(() => caches.keys()))
		.toEqual(expect.not.arrayContaining(['vibe-puzzles-0']));
	expect(await page.evaluate(() => caches.keys())).toContain('other-app-v1');
});

test('caches a collection file when it is first used, not on install', async ({
	page,
	context
}) => {
	await page.goto('/');
	await page.evaluate(async () => {
		localStorage.setItem('vp:puzzleSource', '"bank"');
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
		}
	});
	const cached = () =>
		page.evaluate(async () => {
			const urls: Record<string, string[]> = {};
			for (const name of await caches.keys()) {
				const keys = await (await caches.open(name)).keys();
				urls[name] = keys
					.map((r) => new URL(r.url).pathname)
					.filter((p) => p.includes('/puzzles/'));
			}
			return urls;
		});
	// The install leaves the collection out.
	expect(Object.values(await cached()).flat()).toEqual([]);

	await page.goto('/tetroid?v=8n');
	await expect(page.getByText('(from the puzzle collection)')).toBeVisible({ timeout: 10_000 });
	// Only the one chunk the puzzle came from: a random pick needs no index.
	await expect
		.poll(async () => (await cached())['vibe-puzzles-collection'])
		.toEqual([expect.stringMatching(/^\/puzzles\/tetroid\/8n\/\d{4}\.json$/)]);
	const [chunk] = (await cached())['vibe-puzzles-collection'];

	// Offline, the service worker answers with the cached file; a file that was never needed is
	// missing (the game then generates the puzzle on the device).
	await context.setOffline(true);
	const loads = (path: string) =>
		page.evaluate(
			(p) =>
				fetch(p).then(
					(r) => r.ok,
					() => false
				),
			path
		);
	expect(await loads(chunk)).toBe(true);
	expect(await loads('/puzzles/tetroid/8n/index.json')).toBe(false);
	await context.setOffline(false);
});

test('a collection file cached by an older version is replaced before a puzzle is picked from it', async ({
	page,
	context
}) => {
	await page.goto('/');
	await page.evaluate(async () => {
		localStorage.setItem('vp:puzzleSource', '"bank"');
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
		}
	});
	const path = '/puzzles/pixels/5n/0000.json';
	const revision = collectionRevisions('static').pixels['5n'];
	const ids = (JSON.parse(readFileSync(`static${path}`, 'utf8')).puzzles as { id: number }[]).map(
		(p) => p.id
	);
	// What an older version cached: a puzzle this collection took out.
	const old = {
		version: 2,
		game: 'pixels',
		variant: '5n',
		puzzles: [
			{
				id: 799749296,
				puzzle: {
					width: 5,
					height: 5,
					rows: [[], [], [1, 1], [1], []],
					cols: [[2], [], [], [], [1]]
				}
			}
		]
	};
	const cacheOld = (headers: Record<string, string> = {}) =>
		page.evaluate(
			async ({ path, old, headers }) => {
				const cache = await caches.open('vibe-puzzles-collection');
				await cache.put(path, Response.json(old, { headers }));
			},
			{ path, old, headers }
		);
	const cached = () =>
		page.evaluate(async (path) => {
			const hit = await caches.match(path);
			return {
				revision: hit?.headers.get('X-Collection-Revision'),
				ids: ((await hit?.json())?.puzzles as { id: number }[]).map((p) => p.id)
			};
		}, path);
	const load = (url: string) =>
		page.evaluate(
			async (url) =>
				((await (await fetch(url)).json()).puzzles as { id: number }[]).map((p) => p.id),
			url
		);

	await cacheOld();
	await page.goto('/pixels?v=5n');
	await expect(page.getByText('(from the puzzle collection)')).toBeVisible({ timeout: 10_000 });
	const shown = await page.locator('.font-mono.select-all').first().textContent();
	expect(ids).toContain(Number(shown!.replaceAll(',', '')));
	expect(await cached()).toEqual({ revision, ids });

	// A copy of this revision is used as it is, without asking the network.
	await cacheOld({ 'X-Collection-Revision': revision });
	expect(await load(`${path}?r=${revision}`)).toEqual([799749296]);
	// Without a connection, a copy of another revision is better than none.
	await cacheOld({ 'X-Collection-Revision': 'older' });
	await context.setOffline(true);
	expect(await load(`${path}?r=${revision}`)).toEqual([799749296]);
	await context.setOffline(false);
	expect(await load(`${path}?r=${revision}`)).toEqual(ids);
	expect(await cached()).toEqual({ revision, ids });
});

test('has an install manifest', async ({ request }) => {
	const manifest = await (await request.get('/manifest.webmanifest')).json();
	expect(manifest.icons.length).toBeGreaterThan(1);
	for (const icon of manifest.icons) expect((await request.get(`/${icon.src}`)).ok()).toBe(true);
	// Browsers that colour the installed app's bars from the manifest alone (Firefox) keep them
	// black, so that they never glare at night.
	expect(manifest.theme_color).toBe('#000000');
	expect(manifest.background_color).toBe('#000000');
});

test('plays a puzzle from the collection when chosen', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => localStorage.setItem('vp:puzzleSource', '"bank"'));
	await page.goto('/tetroid?v=20h');
	await expect(page.getByText('(from the puzzle collection)')).toBeVisible({ timeout: 10_000 });
	await expect(page.getByRole('application', { name: 'Puzzle board' })).toBeVisible();
});

test('the zoom popover closes on a press outside it or on Escape', async ({ page }) => {
	await page.goto('/tetroid?v=6n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	const button = page.getByRole('button', { name: 'Zoom' });
	const slider = page.getByRole('slider', { name: 'Zoom' });

	await button.click();
	await expect(slider).toBeVisible();
	// Using the slider keeps it open.
	await slider.focus();
	await slider.press('ArrowRight');
	await expect(slider).toBeVisible();
	await page
		.getByText(/Puzzle ID/i)
		.first()
		.click();
	await expect(slider).toBeHidden();

	await button.click();
	await expect(slider).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(slider).toBeHidden();
	// The button still toggles it.
	await button.click();
	await button.click();
	await expect(slider).toBeHidden();
});
