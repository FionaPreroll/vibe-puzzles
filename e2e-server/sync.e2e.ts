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

async function shadedCells(page: Page): Promise<number[]> {
	return page.evaluate(() => {
		const save = JSON.parse(localStorage.getItem('vp:save:tetroid:6n') ?? 'null');
		return save ? save.state.marks.flatMap((m: number, i: number) => (m === 1 ? [i] : [])) : [];
	});
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
	const phoneId = await phone.locator('.select-all').first().textContent();
	const phoneCells = await shadedCells(phone);
	expect(phoneCells).toHaveLength(3);
	// Saves are pushed shortly after the last move.
	await phone.waitForResponse(
		(r) => r.url().includes('/api/saves/') && r.request().method() === 'PUT'
	);

	// Laptop: the same game opens there.
	await laptop.goto('/tetroid?v=6n');
	await expect(laptop.getByText('Continued your game from another device.')).toBeVisible({
		timeout: 15_000
	});
	await expect(laptop.locator('.select-all').first()).toHaveText(phoneId!);
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
	await a.getByRole('button', { name: 'Settings' }).click();
	await a.getByLabel('Show board coordinates').check();
	await a.waitForResponse(
		(r) => r.url().includes('/api/saves/settings') && r.request().method() === 'PUT'
	);

	await b.goto('/tetroid?v=6n');
	await b.getByRole('button', { name: 'Settings' }).click();
	await expect(b.getByLabel('Show board coordinates')).toBeChecked();
});
