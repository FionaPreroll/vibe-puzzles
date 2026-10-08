import { expect, test } from '@playwright/test';

// Tetroid 6×6 Normal #496678832 from the bundled bank, and its shaded cells.
const PUZZLE = '/tetroid?v=6n&id=496678832';
const SOLUTION = '101111111000100101111111100001100000';

test('a new puzzle right after solving ends the celebration', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');

	// The first rect is the 6×6 grid itself; a click shades a cell.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 6;
	for (const [i, c] of [...SOLUTION].entries()) {
		if (c !== '1') continue;
		await page.mouse.click(
			grid.x + ((i % 6) + 0.5) * cell,
			grid.y + (Math.floor(i / 6) + 0.5) * cell
		);
	}
	const glow = page.locator('.solved-glow');
	await expect(glow).toHaveCount(1);

	await page.getByRole('button', { name: 'New puzzle' }).click();
	await expect(page.locator('.font-mono.select-all')).not.toHaveText('496,678,832');
	// The celebration is over at once and stays over.
	await expect(glow).toHaveCount(0);
	await expect(page.locator('.solved-burst')).toHaveCount(0);
	await page.waitForTimeout(2500);
	await expect(glow).toHaveCount(0);
});
