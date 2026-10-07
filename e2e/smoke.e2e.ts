import { expect, test } from '@playwright/test';

test('home lists the games', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: /Tetroid/ }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: /Pinwheel/ }).first()).toBeVisible();
});

for (const game of ['tetroid', 'pinwheel']) {
	test(`${game} generates and renders a board`, async ({ page }) => {
		await page.goto(`/${game}`);
		await expect(page.getByText(/Puzzle ID/i)).toBeVisible({ timeout: 30_000 });
		await expect(page.locator('svg rect').first()).toBeVisible();
	});
}
