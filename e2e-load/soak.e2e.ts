import { expect, test } from '@playwright/test';
import { board, metrics, prepare, random } from './helpers';

/**
 * A long session in one tab: moves, drags, undo/redo, new puzzles and switching games, the way
 * someone plays for an hour. Afterwards memory, DOM and listeners must not have kept growing,
 * nothing may have thrown and saved games must stay small.
 *
 * SOAK_ACTIONS sets the length (default 600); SOAK_SEED repeats a run.
 */
const ACTIONS = Number(process.env.SOAK_ACTIONS ?? 600);
const SEED = Number(process.env.SOAK_SEED ?? 20261008);
const GAMES = ['tetroid', 'pinwheel'];

test(`a session of ${ACTIONS} actions stays healthy`, async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => {
		// Without the optional server, API calls fail; that is expected here.
		if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
			errors.push(m.text());
		}
	});
	await prepare(page);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Performance.enable');
	const rnd = random(SEED);
	const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

	let game = 0;
	await page.goto(`/${GAMES[game]}?v=10n`);
	await expect(board(page)).toBeVisible({ timeout: 30_000 });

	const point = async () => {
		const box = (await board(page).boundingBox())!;
		return {
			x: box.x + (0.05 + rnd() * 0.9) * box.width,
			y: box.y + (0.05 + rnd() * 0.9) * box.height
		};
	};
	const puzzleId = () => page.locator('.font-mono.select-all').textContent();

	let baseline: Awaited<ReturnType<typeof metrics>> | null = null;
	const samples: {
		action: number;
		game: string;
		heapMB: number;
		nodes: number;
		listeners: number;
	}[] = [];
	for (let action = 1; action <= ACTIONS; action++) {
		if (action % 150 === 0) {
			// Switch games through the app, so boards mount and unmount.
			game = 1 - game;
			await page.getByRole('navigation', { name: 'Main' }).getByRole('link').first().click();
			await page.locator(`main a[href$="/${GAMES[game]}"]`).first().click();
			await expect(board(page)).toBeVisible({ timeout: 30_000 });
		} else if (action % 30 === 0) {
			const before = await puzzleId();
			await page.getByRole('button', { name: 'New puzzle' }).click();
			await expect(page.locator('.font-mono.select-all')).not.toHaveText(before ?? '', {
				timeout: 30_000
			});
		} else {
			const kind = pick(['click', 'click', 'drag', 'drag', 'undo', 'redo']);
			if (kind === 'click') {
				const p = await point();
				await page.mouse.click(p.x, p.y, { button: rnd() < 0.2 ? 'right' : 'left' });
			} else if (kind === 'drag') {
				const [a, b] = [await point(), await point()];
				await page.mouse.move(a.x, a.y);
				await page.mouse.down();
				await page.mouse.move(b.x, b.y, { steps: 8 });
				await page.mouse.up();
			} else {
				const button = page.getByRole('button', { name: kind === 'undo' ? 'Undo' : 'Redo' });
				if (await button.isEnabled()) await button.click();
			}
		}
		if (action === 100) baseline = await metrics(cdp);
		if (action % 50 === 0) samples.push({ action, game: GAMES[game], ...(await metrics(cdp)) });
	}

	// Back on the first game, as at the baseline, before the final measurement.
	if (game !== 0) {
		await page.getByRole('navigation', { name: 'Main' }).getByRole('link').first().click();
		await page.locator(`main a[href$="/${GAMES[0]}"]`).first().click();
		await expect(board(page)).toBeVisible({ timeout: 30_000 });
	}
	const end = await metrics(cdp);
	const storage = await page.evaluate(() =>
		Object.keys(localStorage).reduce(
			(n, k) => n + k.length + (localStorage.getItem(k)?.length ?? 0),
			0
		)
	);
	for (const s of samples) console.log(JSON.stringify(s));
	console.log(JSON.stringify({ baseline, end, storage }));
	await test.info().attach('soak.json', {
		body: JSON.stringify({ baseline, end, storage, samples }, null, 2),
		contentType: 'application/json'
	});

	expect(errors).toEqual([]);
	// Some growth is caches and lazily loaded code; a leak grows with every action.
	expect(end.heapMB).toBeLessThan(baseline!.heapMB * 1.5 + 5);
	expect(end.nodes).toBeLessThan(baseline!.nodes * 1.5 + 500);
	expect(end.listeners).toBeLessThan(baseline!.listeners * 1.5 + 100);
	// Saved games and settings stay far below the browser's 5 MB storage limit.
	expect(storage).toBeLessThan(1_000_000);
});
