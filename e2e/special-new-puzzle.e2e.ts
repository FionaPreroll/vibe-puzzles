import { expect, test } from '@playwright/test';

test('"New puzzle" on the daily puzzle continues with the regular type of its size', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:pinwheel', 'true'));
	await page.goto('/pinwheel?v=daily');
	await expect(page.locator('.overflow-x-auto svg[role="grid"]')).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'New puzzle' }).click();
	await expect(page).toHaveURL(/pinwheel\?v=10h$/);
	await expect(page.getByRole('button', { name: '10×10 Hard' })).toHaveAttribute(
		'aria-current',
		'true'
	);
});
