import { expect, test } from '@playwright/test';

test('home lists the games', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Tetroid' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Pinwheel' })).toBeVisible();
});

for (const game of ['tetroid', 'pinwheel']) {
	test(`${game} generates and renders a board`, async ({ page }) => {
		await page.goto(`/${game}?v=${game === 'tetroid' ? '6n' : '5n'}`);
		await expect(page.getByText(/Puzzle ID/i)).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole('grid', { name: 'Puzzle board' }).first()).toBeVisible();
	});
}

test('the first visit opens the tutorial, which can be solved', async ({ page }) => {
	await page.goto('/tetroid');
	await expect(page).toHaveURL(/\/tetroid\/tutorial$/);
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	const box = (await board.boundingBox())!;
	const cell = box.width / 5;
	// The remaining tetrominoes: L top right, S on the right, I at the bottom.
	for (const [r, c] of [
		[0, 2],
		[0, 3],
		[0, 4],
		[1, 2],
		[1, 4],
		[2, 3],
		[2, 4],
		[3, 3],
		[4, 0],
		[4, 1],
		[4, 2],
		[4, 3]
	]) {
		await page.mouse.click(box.x + (c + 0.5) * cell, box.y + (r + 0.5) * cell);
	}
	await expect(page.getByText('Well done!')).toBeVisible();
	await page.getByRole('link', { name: 'Play a real puzzle' }).click();
	await expect(page.getByText(/Puzzle ID/i)).toBeVisible({ timeout: 30_000 });
});

test('switches to German', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
	await expect(page.getByRole('heading', { name: /Logikrätsel/ })).toBeVisible();
});
