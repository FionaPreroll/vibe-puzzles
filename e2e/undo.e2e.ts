import { expect, test } from '@playwright/test';

for (const [label, viewport] of [
	['wide', { width: 1280, height: 800 }],
	['phone', { width: 390, height: 844 }]
] as const) {
	test(`${label}: undoing the last step on the button's icon leaves later moves alone`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.addInitScript(() => {
			localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
			localStorage.setItem('vp:puzzleSource', '"bank"');
		});
		await page.goto('/tetroid?v=6n&id=496678832');
		const board = page.getByRole('grid', { name: 'Puzzle board' });
		await expect(board).toBeVisible({ timeout: 30_000 });
		await page.waitForLoadState('networkidle');
		const grid = (await board.locator('rect').first().boundingBox())!;
		const cell = grid.width / 6;
		const click = (x: number, y: number) =>
			page.mouse.click(grid.x + (x + 0.5) * cell, grid.y + (y + 0.5) * cell);
		const undo = page.getByRole('button', { name: 'Undo' }).filter({ visible: true });

		await click(0, 0);
		await expect(undo).toBeEnabled();
		// Pressing undoes the only step, which disables the button while it is still held; it is
		// let go on its icon.
		const icon = (await undo.locator('svg').boundingBox())!;
		await page.mouse.move(icon.x + icon.width / 2, icon.y + icon.height / 2);
		await page.mouse.down();
		await expect(undo).toBeDisabled();
		await page.mouse.up();

		// A new move with the pointer still on the button (as when playing by touch or keyboard)
		// stays past the repeat delay.
		await board.focus();
		// The first arrow shows the cursor on the first cell.
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Space');
		await expect(undo).toBeEnabled();
		await page.waitForTimeout(1000);
		await expect(undo).toBeEnabled();
	});
}
