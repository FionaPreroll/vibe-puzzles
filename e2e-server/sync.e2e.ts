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
async function savedGame(
	page: Page
): Promise<{ puzzle: unknown; puzzleId: number; ticket?: string } | null> {
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
	await expect(page.getByRole('application', { name: 'Puzzle board' }).first()).toBeVisible({
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
	const board = phone.getByRole('application', { name: 'Puzzle board' }).first();
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
	const lbox = (await laptop
		.getByRole('application', { name: 'Puzzle board' })
		.first()
		.boundingBox())!;
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
	await expect(page.getByText('The server cannot be reached right now.')).toBeVisible();
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

/** Two devices of one new player: the first registers, the second links with its sync code. */
async function pair(browser: Browser, name: string): Promise<[Page, Page]> {
	const a = await device(browser);
	const b = await device(browser);
	await a.goto('/player');
	await a.getByPlaceholder('Name').fill(`${name} ${Date.now() % 100000}`);
	await a.getByRole('button', { name: 'Start' }).click();
	await a.getByRole('button', { name: 'Show' }).click();
	const code = (await a.locator('code').textContent())!.trim();
	await b.goto('/player');
	await b.getByPlaceholder('xxxx-xxxx-xxxx-xxxx').fill(code);
	await b.getByRole('button', { name: 'Link device' }).click();
	await expect(b.getByRole('button', { name: 'Sign out' })).toBeVisible();
	return [a, b];
}

/** Shade the given cells of the board, 6x6 unless `size` says otherwise. */
async function shade(page: Page, cells: [number, number][], size = 6) {
	const board = page.getByRole('application', { name: 'Puzzle board' }).first();
	await expect(board).toBeVisible({ timeout: 30_000 });
	const box = (await board.boundingBox())!;
	const cell = box.width / size;
	for (const [r, c] of cells) {
		await page.mouse.click(box.x + (c + 0.5) * cell, box.y + (r + 0.5) * cell);
	}
}

const savePut = (r: { url(): string; request(): { method(): string } }) =>
	r.url().includes('/api/saves/save') && r.request().method() === 'PUT';

test('a game played offline reaches the other device once back online', async ({ browser }) => {
	const [phone, laptop] = await pair(browser, 'Train');
	await phone.goto('/tetroid?v=6n');
	await shade(phone, [[0, 0]]);
	await phone.waitForResponse(savePut);

	// The connection drops: the moves wait in the outbox.
	await phone.context().setOffline(true);
	await phone.evaluate(() => window.dispatchEvent(new Event('offline')));
	await shade(phone, [
		[2, 3],
		[5, 5]
	]);
	await expect
		.poll(() =>
			phone.evaluate(() => Object.keys(JSON.parse(localStorage['vp:outbox'] ?? '{}').saves ?? {}))
		)
		.toEqual(['save:tetroid:6n']);
	await expect(phone.getByRole('button', { name: /^Connection: No connection/ })).toBeVisible();
	const cells = await shadedCells(phone);
	expect(cells).toHaveLength(3);

	// Back online: sent without a reload.
	const pushed = phone.waitForResponse(savePut);
	await phone.context().setOffline(false);
	await phone.evaluate(() => window.dispatchEvent(new Event('online')));
	await pushed;
	await expect.poll(() => phone.evaluate(() => localStorage['vp:outbox'] ?? null)).toBeNull();

	await laptop.goto('/tetroid?v=6n');
	await expect(laptop.getByRole('status')).toHaveText('Continued your game from another device.', {
		timeout: 15_000
	});
	expect(await shadedCells(laptop)).toEqual(cells);
});

test('offline mode sends nothing until "Sync now"', async ({ browser }) => {
	const [phone, laptop] = await pair(browser, 'Quiet');
	await phone.goto('/tetroid?v=6n');
	await shade(phone, [[0, 0]]);
	await phone.waitForResponse(savePut);

	await phone.getByRole('button', { name: /^Connection: Online/ }).click();
	await phone.getByRole('dialog', { name: 'Connection' }).getByLabel('Offline mode').check();
	await phone.keyboard.press('Escape');
	await expect(phone.getByRole('button', { name: 'Connection: Offline mode' })).toBeVisible();

	const api: string[] = [];
	phone.on('request', (r) => {
		if (r.url().includes('/api/')) api.push(r.url());
	});
	await shade(phone, [[2, 3]]);
	// Longer than the pause before an upload; a reload keeps offline mode.
	await phone.waitForTimeout(2500);
	await phone.reload();
	await expect(phone.getByRole('application', { name: 'Puzzle board' }).first()).toBeVisible({
		timeout: 30_000
	});
	await shade(phone, [[5, 5]]);
	await phone.waitForTimeout(2500);
	expect(api).toEqual([]);
	const cells = await shadedCells(phone);
	expect(cells).toHaveLength(3);

	await phone.getByRole('button', { name: 'Connection: Offline mode' }).click();
	const menu = phone.getByRole('dialog', { name: 'Connection' });
	await expect(menu.getByText('1 change waiting for the server')).toBeVisible();
	const pushed = phone.waitForResponse(savePut);
	await menu.getByRole('button', { name: 'Sync now' }).click();
	await pushed;
	await expect(menu.getByText(/^Last synced at/)).toBeVisible();
	await expect(menu.getByText('1 change waiting for the server')).toBeHidden();
	await expect(menu.getByLabel('Offline mode')).toBeChecked();

	await laptop.goto('/tetroid?v=6n');
	await expect(laptop.getByRole('status')).toHaveText('Continued your game from another device.', {
		timeout: 15_000
	});
	expect(await shadedCells(laptop)).toEqual(cells);
});

test('a move made right before leaving the game reaches the other device', async ({ browser }) => {
	const [phone, laptop] = await pair(browser, 'Leaving');
	await phone.goto('/tetroid?v=6n');
	await shade(phone, [[0, 0]]);
	await phone.waitForResponse(savePut);

	// One more move, and the page is left before the pause before its upload is over.
	const pushed = phone.waitForResponse(savePut);
	await shade(phone, [[2, 3]]);
	await phone.goto('/');
	await pushed;
	const cells = await shadedCells(phone);
	expect(cells).toHaveLength(2);

	await laptop.goto('/tetroid?v=6n');
	await expect(laptop.getByRole('status')).toHaveText('Continued your game from another device.', {
		timeout: 15_000
	});
	expect(await shadedCells(laptop)).toEqual(cells);
});

test('moves taken back on one device are taken back on the other', async ({ browser }) => {
	const [phone, laptop] = await pair(browser, 'Undo');
	await phone.goto('/tetroid?v=6n');
	await shade(phone, [[0, 0]]);
	await phone.waitForResponse(savePut);
	await laptop.goto('/tetroid?v=6n');
	await expect(laptop.getByRole('status')).toHaveText('Continued your game from another device.', {
		timeout: 15_000
	});
	expect(await shadedCells(laptop)).toHaveLength(1);

	// The phone takes the move back: the untouched game goes to the server too.
	const pushed = phone.waitForResponse(savePut);
	await phone.getByRole('button', { name: 'Undo' }).first().click();
	await pushed;
	expect(await shadedCells(phone)).toEqual([]);

	// Back on the page, the laptop takes it back as well.
	await laptop.reload();
	await expect(laptop.getByRole('status')).toHaveText(
		'Your moves were taken back on another device.',
		{ timeout: 15_000 }
	);
	expect(await shadedCells(laptop)).toEqual([]);
});

test('a puzzle from a link goes on where the other device left it', async ({ browser }) => {
	const [phone, laptop] = await pair(browser, 'Shared');
	const id = 496678848;
	await phone.goto(`/tetroid?id=${id}`);
	await shade(phone, [[0, 0]]);
	await phone.waitForResponse(savePut);
	const cells = await shadedCells(phone);
	expect(cells).toHaveLength(1);

	// The laptop opens the same link for the first time: the game goes on there.
	await laptop.goto(`/tetroid?id=${id}`);
	await expect(laptop.getByRole('status')).toHaveText('Continued your game from another device.', {
		timeout: 15_000
	});
	expect(await savedGame(laptop)).toMatchObject({ puzzleId: id });
	expect(await shadedCells(laptop)).toEqual(cells);
});

const savePull = (r: { url(): string; request(): { method(): string } }) =>
	r.url().includes('/api/saves/save') && r.request().method() === 'GET';

test('a game given up for a new puzzle does not come back', async ({ browser }) => {
	const [phone, laptop] = await pair(browser, 'Fresh');
	await phone.goto('/tetroid?v=6n');
	await shade(phone, [[0, 0]]);
	await phone.waitForResponse(savePut);
	const given = (await savedGame(phone))!;

	// "New puzzle" asks before it throws the game away; the new one goes to the server at once.
	const pushed = phone.waitForResponse(savePut);
	await phone.getByRole('button', { name: 'New puzzle' }).click();
	const dialog = phone.getByRole('alertdialog');
	await expect(dialog).toContainText('unfinished game');
	await dialog.getByRole('button').last().click();
	await pushed;
	const fresh = (await savedGame(phone))!;
	expect(fresh.ticket).not.toBe(given.ticket);

	// Back on the page, the new puzzle stays.
	const pulled = phone.waitForResponse(savePull);
	await phone.reload();
	await pulled;
	await phone.waitForTimeout(500);
	await expect(phone.getByText('Continued your game from another device.')).toHaveCount(0);
	expect(await savedGame(phone)).toMatchObject({ ticket: fresh.ticket });
	expect(await shadedCells(phone)).toEqual([]);

	// Nor does the other device continue the given-up game.
	const lpulled = laptop.waitForResponse(savePull);
	await laptop.goto('/tetroid?v=6n');
	await lpulled;
	await laptop.waitForTimeout(500);
	await expect(laptop.getByText('Continued your game from another device.')).toHaveCount(0);
	expect((await savedGame(laptop))?.ticket).not.toBe(given.ticket);
	expect(await shadedCells(laptop)).toEqual([]);
});

test('a game a link replaced does not come back', async ({ browser }) => {
	const [phone] = await pair(browser, 'Link');
	await phone.goto('/tetroid?v=6n');
	await shade(phone, [[0, 0]]);
	await phone.waitForResponse(savePut);

	// A link to another 6x6 puzzle asks before it replaces the game, then asks the server.
	const other = 496678848;
	const pulled = phone.waitForResponse(savePull);
	await phone.goto(`/tetroid?id=${other}`);
	const dialog = phone.getByRole('alertdialog');
	await expect(dialog).toContainText('replaces your unfinished game', { timeout: 30_000 });
	await dialog.getByRole('button').last().click();
	await pulled;
	await phone.waitForTimeout(500);
	await expect(phone.getByText('Continued your game from another device.')).toHaveCount(0);
	expect(await savedGame(phone)).toMatchObject({ puzzleId: other });
	expect(await shadedCells(phone)).toEqual([]);
});
