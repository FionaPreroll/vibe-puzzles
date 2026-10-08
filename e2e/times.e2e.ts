import { expect, test } from '@playwright/test';

// Tetroid 6×6 Normal #496678832 from the bundled bank, and its shaded cells.
const PUZZLE = '/tetroid?v=6n&id=496678832';
const SOLUTION = '101111111000100101111111100001100000';
const PRECISE = /\b\d\d:\d\d\.\d{3}\b/;

test('a quick solve shows milliseconds only once it is done', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
		// Catch what "Share my time" would hand to the messenger.
		Object.defineProperty(navigator, 'share', {
			value: async (data: ShareData) => {
				(window as unknown as { shared: ShareData }).shared = data;
			}
		});
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const timer = page.locator('span[aria-label="Timer"]');

	// The first rect is the 6×6 grid itself; a click shades a cell.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 6;
	for (const [i, c] of [...SOLUTION].entries()) {
		if (c !== '1') continue;
		// While playing the clock shows whole seconds only.
		await expect(timer).toHaveText(/^\d\d:\d\d$/);
		await page.mouse.click(
			grid.x + ((i % 6) + 0.5) * cell,
			grid.y + (Math.floor(i / 6) + 0.5) * cell
		);
	}

	await expect(timer).toHaveText(PRECISE);
	await expect(page.getByRole('status').first()).toContainText(PRECISE);
	await page.getByRole('button', { name: 'Share my time' }).click();
	const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared);
	expect(shared.text).toMatch(PRECISE);
	expect(shared.text).toContain((await timer.textContent())!.trim());
});
