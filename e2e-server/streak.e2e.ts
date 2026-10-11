import { expect, test, type Browser, type Page } from '@playwright/test';
import { solveTetroid } from '../src/lib/games/tetroid/solver';
import type { TetroidPuzzle } from '../src/lib/games/tetroid/rules';

/** A device of the player: a browser context that skips the first-visit tutorial. */
async function device(browser: Browser): Promise<Page> {
	const page = await (await browser.newContext()).newPage();
	await page.goto('/');
	await page.evaluate(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
	return page;
}

/** Register on `phone` and link `laptop` with the sync code. */
async function link(phone: Page, laptop: Page) {
	await phone.goto('/player');
	await phone.getByPlaceholder('Name').fill(`Streak ${Date.now() % 100000}`);
	await phone.getByRole('button', { name: 'Start' }).click();
	await phone.getByRole('button', { name: 'Show' }).click();
	const code = (await phone.locator('code').textContent())!.trim();
	await laptop.goto('/player');
	await laptop.getByPlaceholder('xxxx-xxxx-xxxx-xxxx').fill(code);
	await laptop.getByRole('button', { name: 'Link device' }).click();
	await expect(laptop.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

/** Solve today's Tetroid daily puzzle on the board, as a player would. */
async function solveDaily(page: Page) {
	await page.goto('/tetroid?v=daily');
	const board = page.getByRole('grid', { name: 'Puzzle board' }).first();
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const puzzle = await page.evaluate(() => {
		const key = Object.keys(localStorage).find((k) => k.startsWith('vp:save:tetroid:daily:2'))!;
		return JSON.parse(localStorage.getItem(key)!).puzzle;
	});
	const [solution] = solveTetroid(puzzle as TetroidPuzzle, { limit: 1 }).solutions;
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 10;
	for (const i of [...solution].flatMap((shaded, i) => (shaded ? [i] : []))) {
		await page.mouse.click(
			grid.x + ((i % 10) + 0.5) * cell,
			grid.y + (Math.floor(i / 10) + 0.5) * cell
		);
	}
	await expect(page.getByRole('button', { name: 'Share success' })).toBeVisible();
}

test('the daily streak goes on from whichever device the player solves on', async ({ browser }) => {
	const phone = await device(browser);
	const laptop = await device(browser);
	await link(phone, laptop);

	// Yesterday's daily puzzle was solved on the laptop.
	await laptop.evaluate(() => {
		const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
		localStorage.setItem(
			'vp:stats:tetroid:daily',
			JSON.stringify({ solved: 1, lastPeriod: yesterday, periodStreak: 1 })
		);
	});
	await laptop.goto('/');
	await expect(laptop.getByText('Streak 1').first()).toBeVisible();

	// Today's on the phone, which tells the server: the day, and (shortly after) the solved game.
	const put = (what: string) =>
		phone.waitForResponse(
			(r) => r.url().includes(`/api/saves/${what}`) && r.request().method() === 'PUT'
		);
	const told = Promise.all([put('periods'), put('save%3Atetroid%3Adaily')]);
	await solveDaily(phone);
	await told;

	// The laptop learns of it: the streak goes on, and the puzzle shows solved there.
	await laptop.reload();
	await expect(laptop.getByText('Streak 2').first()).toBeVisible({ timeout: 15_000 });
	await laptop.goto('/tetroid?v=daily');
	await expect(laptop.getByRole('button', { name: 'Share success' })).toBeVisible({
		timeout: 30_000
	});
	await laptop.getByRole('button', { name: 'More actions' }).click();
	await expect(laptop.getByRole('button', { name: 'Start over' })).toHaveCount(0);
});
