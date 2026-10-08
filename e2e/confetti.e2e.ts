import { expect, test } from '@playwright/test';

// Tetroid 6×6 Normal #496678832 from the bundled bank, and its shaded cells.
const PUZZLE = '/tetroid?v=6n&id=496678832';
const SOLUTION = '101111111000100101111111100001100000';

test('the win animation colours the regions and throws confetti, then clears', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');

	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 6;
	for (const [i, c] of [...SOLUTION].entries()) {
		if (c !== '1') continue;
		await page.mouse.click(
			grid.x + ((i % 6) + 0.5) * cell,
			grid.y + (Math.floor(i / 6) + 0.5) * cell
		);
	}

	// Every cell gets its region's colour; the six regions use several colours.
	const tint = board.locator('.celebrate-regions rect');
	await expect(tint).toHaveCount(36);
	const fills = await tint.evaluateAll((rects) => rects.map((r) => r.getAttribute('fill')));
	expect(new Set(fills).size).toBeGreaterThan(2);
	await expect(page.locator('.solved-burst .confetti')).toHaveCount(36);
	await expect(page.locator('.solved-burst span')).toHaveCount(12);

	// Then the board is back to normal.
	await expect(tint).toHaveCount(0, { timeout: 5000 });
	await expect(page.locator('.solved-burst')).toHaveCount(0);
});
