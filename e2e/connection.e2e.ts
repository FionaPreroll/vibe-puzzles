import { expect, test } from '@playwright/test';

// The preview has no server: its health check gets "not found".

test('the connection menu switches offline mode and the update check', async ({ page }) => {
	await page.goto('/');
	const button = page.getByRole('button', { name: /^Connection: / });
	await expect(button).toHaveAccessibleName('Connection: Online');
	await button.click();
	const menu = page.getByRole('dialog', { name: 'Connection' });
	await expect(menu.getByText('This version has no server')).toBeVisible();
	// Without a server there is nothing to sync.
	await expect(menu.getByRole('button', { name: 'Sync now' })).toHaveCount(0);
	await expect(menu.getByLabel('Check for updates')).toBeChecked();

	await menu.getByLabel('Offline mode').check();
	await menu.getByLabel('Check for updates').uncheck();
	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();
	await expect(button).toBeFocused();
	await expect(page.getByRole('button', { name: 'Connection: Offline mode' })).toBeVisible();

	// Kept on this device, and nothing asks the server any more.
	const api: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes('/api/')) api.push(r.url());
	});
	await page.reload();
	await page.getByRole('button', { name: 'Connection: Offline mode' }).click();
	await expect(menu.getByLabel('Offline mode')).toBeChecked();
	await expect(menu.getByLabel('Check for updates')).not.toBeChecked();
	await page.goto('/player');
	await expect(page.getByText('Offline mode is on.')).toBeVisible();
	expect(api).toEqual([]);

	// A press outside closes the menu.
	await page.getByRole('button', { name: 'Connection: Offline mode' }).click();
	await expect(menu).toBeVisible();
	await page.getByRole('heading', { name: 'Player' }).click();
	await expect(menu).toBeHidden();
});

test('"Check now" looks for a new version', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: /^Connection: / }).click();
	const menu = page.getByRole('dialog', { name: 'Connection' });
	const asked = page.waitForRequest((r) => r.url().includes('/_app/version.json'));
	await menu.getByRole('button', { name: 'Check now' }).click();
	await asked;
	await expect(menu.getByText('This is the newest version.')).toBeVisible();
});

test('the connection button fits on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 740 });
	await page.goto('/');
	const button = page.getByRole('button', { name: /^Connection: / });
	await expect(button).toBeInViewport({ ratio: 1 });
	await button.click();
	await expect(page.getByRole('dialog', { name: 'Connection' })).toBeInViewport({ ratio: 1 });
});
