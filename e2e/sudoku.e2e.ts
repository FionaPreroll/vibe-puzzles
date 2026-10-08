import { expect, test, type Page } from '@playwright/test';

/** Click the centre of cell (r, c) of a size×size board. */
async function clickCell(page: Page, size: number, r: number, c: number) {
	const box = (await page.getByRole('grid', { name: 'Puzzle board' }).boundingBox())!;
	// The board has a 3 px margin around the grid.
	const cell = (box.width - 6) / size;
	await page.mouse.click(box.x + 3 + (c + 0.5) * cell, box.y + 3 + (r + 0.5) * cell);
}

test('the Sudoku tutorial can be solved with the number pad', async ({ page }) => {
	await page.goto('/sudoku');
	await expect(page).toHaveURL(/\/sudoku\/tutorial$/);
	const pad = page.getByRole('toolbar', { name: 'Number pad' });
	// Solution: 1234 / 3412 / 2143 / 4321; the empty cells and their digits.
	const moves: [number, number, number][] = [
		[0, 2, 3],
		[1, 0, 3],
		[1, 3, 2],
		[2, 0, 2],
		[2, 3, 3],
		[3, 1, 3]
	];
	for (const [r, c, d] of moves) {
		await clickCell(page, 4, r, c);
		await pad.getByRole('button', { name: String(d), exact: true }).click();
	}
	await expect(page.getByText('Well done!')).toBeVisible();
});

test('Sudoku takes digits and notes from the keyboard and keeps them', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:sudoku', 'true'));
	await page.goto('/sudoku?v=9n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	const board = page.getByRole('grid', { name: 'Puzzle board' });

	// Find an empty cell: arrow keys walk the board from the top-left cell.
	const text = async () => (await board.locator('text').allTextContents()).join('');
	await expect(board.locator('text').first()).toBeVisible();
	const before = await text();
	await clickCell(page, 9, 0, 0);
	let entered = false;
	for (let k = 0; k < 81 && !entered; k++) {
		await page.keyboard.press('7');
		entered = (await text()) !== before;
		if (!entered) await page.keyboard.press('ArrowRight');
	}
	expect(entered).toBe(true);
	// The same digit again clears it; Shift+digits add notes.
	await page.keyboard.press('7');
	expect(await text()).toBe(before);
	await page.keyboard.press('Shift+Digit1');
	await page.keyboard.press('Shift+Digit5');
	await expect(board.locator('g.notes text')).toHaveText(['1', '5']);

	// The game is saved: notes survive a reload.
	await page.reload();
	await expect(board.locator('g.notes text')).toHaveText(['1', '5'], { timeout: 30_000 });
});
