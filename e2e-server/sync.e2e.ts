import { expect, test, type Browser, type Page } from '@playwright/test';

/** Two browser contexts act as two devices of the same player. */
async function device(browser: Browser): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	// Skip the first-visit tutorial.
	await page.goto('/');
	await page.evaluate(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"local"');
	});
	return page;
}

/** The saved 6x6 Tetroid game: its puzzle, ticket (if the server issued it) and shaded cells. */
async function savedGame(page: Page): Promise<{ puzzle: unknown; ticket?: string } | null> {
	return page.evaluate(() => JSON.parse(localStorage.getItem('vp:save:tetroid:6n') ?? 'null'));
}

async function shadedCells(page: Page): Promise<number[]> {
	return page.evaluate(() => {
		const save = JSON.parse(localStorage.getItem('vp:save:tetroid:6n') ?? 'null');
		return save ? save.state.marks.flatMap((m: number, i: number) => (m === 1 ? [i] : [])) : [];
	});
}

/**
 * Open the game's settings. The button is part of the prerendered page, so a click before the
 * page has hydrated does nothing: wait for the board, which only shows once the app runs.
 */
async function openSettings(page: Page) {
	await expect(page.getByRole('grid', { name: 'Puzzle board' }).first()).toBeVisible({
		timeout: 30_000
	});
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.locator('dialog[open]')).toBeVisible();
}

test('a game continues on a second device linked with the sync code', async ({ browser }) => {
	const phone = await device(browser);
	const laptop = await device(browser);

	// Phone: register and read the sync code.
	await phone.goto('/player');
	await phone.getByPlaceholder('Name').fill(`Sync ${Date.now() % 100000}`);
	await phone.getByRole('button', { name: 'Start' }).click();
	await phone.getByRole('button', { name: 'Show' }).click();
	const code = (await phone.locator('code').textContent())!.trim();
	expect(code).toMatch(/^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/);

	// Laptop: link with the code.
	await laptop.goto('/player');
	await laptop.getByPlaceholder('xxxx-xxxx-xxxx-xxxx').fill(code);
	await laptop.getByRole('button', { name: 'Link device' }).click();
	await expect(laptop.getByRole('button', { name: 'Sign out' })).toBeVisible();

	// Phone: start a puzzle and shade three cells.
	await phone.goto('/tetroid?v=6n');
	const board = phone.getByRole('grid', { name: 'Puzzle board' }).first();
	await expect(board).toBeVisible({ timeout: 30_000 });
	const box = (await board.boundingBox())!;
	const cell = box.width / 6;
	for (const [r, c] of [
		[0, 0],
		[2, 3],
		[5, 5]
	]) {
		await phone.mouse.click(box.x + (c + 0.5) * cell, box.y + (r + 0.5) * cell);
	}
	// The server hands out the puzzle with a ticket and keeps its ID secret until it is solved.
	const phoneGame = (await savedGame(phone))!;
	expect(phoneGame.ticket).toEqual(expect.any(String));
	const phoneCells = await shadedCells(phone);
	expect(phoneCells).toHaveLength(3);
	// Saves are pushed shortly after the last move.
	await phone.waitForResponse(
		(r) => r.url().includes('/api/saves/') && r.request().method() === 'PUT'
	);

	// Laptop: the same game opens there.
	await laptop.goto('/tetroid?v=6n');
	await expect(laptop.getByRole('status')).toHaveText('Continued your game from another device.', {
		timeout: 15_000
	});
	expect(await savedGame(laptop)).toMatchObject({
		puzzle: phoneGame.puzzle,
		ticket: phoneGame.ticket
	});
	expect(await shadedCells(laptop)).toEqual(phoneCells);

	// Laptop: one more move, then the phone picks it up when it comes back to the page.
	const lbox = (await laptop.getByRole('grid', { name: 'Puzzle board' }).first().boundingBox())!;
	const lcell = lbox.width / 6;
	await laptop.mouse.click(lbox.x + 3.5 * lcell, lbox.y + 0.5 * lcell);
	await laptop.waitForResponse(
		(r) => r.url().includes('/api/saves/') && r.request().method() === 'PUT'
	);
	await phone.reload();
	await expect.poll(() => shadedCells(phone)).toEqual([...phoneCells, 3].sort((a, b) => a - b));
});

test('settings follow the player to another device', async ({ browser }) => {
	const a = await device(browser);
	const b = await device(browser);
	await a.goto('/player');
	await a.getByPlaceholder('Name').fill('Settings');
	await a.getByRole('button', { name: 'Start' }).click();
	await a.getByRole('button', { name: 'Show' }).click();
	const code = (await a.locator('code').textContent())!.trim();
	await b.goto('/player');
	await b.getByPlaceholder('xxxx-xxxx-xxxx-xxxx').fill(code);
	await b.getByRole('button', { name: 'Link device' }).click();
	await expect(b.getByRole('button', { name: 'Sign out' })).toBeVisible();

	await a.goto('/tetroid?v=6n');
	await openSettings(a);
	await a.getByLabel('Show board coordinates').check();
	await a.waitForResponse(
		(r) => r.url().includes('/api/saves/settings') && r.request().method() === 'PUT'
	);

	await b.goto('/tetroid?v=6n');
	await openSettings(b);
	await expect(b.getByLabel('Show board coordinates')).toBeChecked();
});

test('a device that started offline uses the server once it is back', async ({ browser }) => {
	const page = await device(browser);
	// No answer from the server, as when the app is opened without a connection.
	await page.route('**/api/health', (route) => route.abort('internetdisconnected'));
	await page.goto('/player');
	await expect(page.getByText('This deployment has no server')).toBeVisible();
	await page.unroute('**/api/health');
	await page.evaluate(() => window.dispatchEvent(new Event('online')));
	await page.getByPlaceholder('Name').fill('Offline');
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

	// A setting changed while offline reaches the server after reconnecting, without a reload.
	await page.route('**/api/health', (route) => route.abort('internetdisconnected'));
	await page.goto('/tetroid?v=6n');
	await openSettings(page);
	await page.getByLabel('Show board coordinates').check();
	await page.unroute('**/api/health');
	const pushed = page.waitForResponse(
		(r) => r.url().includes('/api/saves/settings') && r.request().method() === 'PUT'
	);
	await page.evaluate(() => window.dispatchEvent(new Event('online')));
	await pushed;
});
