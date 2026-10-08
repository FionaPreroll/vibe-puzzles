import { expect, test } from '@playwright/test';

test('the About page lists every shipped library with its licence text', async ({ page }) => {
	await page.goto('/about');
	const section = page.locator('section', { has: page.getByRole('heading', { name: 'Licences' }) });
	for (const name of ['svelte', '@sveltejs/kit', 'devalue', 'clsx', 'tailwindcss']) {
		const link = section.getByRole('link', { name, exact: true });
		await expect(link).toHaveAttribute('href', /^https:\/\//);
		// The text is folded away until asked for, and holds the copyright notice.
		const summary = section.getByText(`Licence text of ${name}`, { exact: true });
		const text = summary.locator('xpath=following-sibling::pre');
		await expect(text).toBeHidden();
		await summary.click();
		await expect(text).toBeVisible();
		await expect(text).toContainText(/MIT License|Permission is hereby granted/);
		await expect(text).toContainText('Copyright');
	}
});

test('the backup schema link opens the JSON schema', async ({ page }) => {
	await page.goto('/about');
	await page.getByRole('link', { name: 'File format (JSON Schema)' }).click();
	await expect(page).toHaveURL(/\/backup\.schema\.json$/);
	await expect(page.locator('body')).toContainText('"$schema"');
});
