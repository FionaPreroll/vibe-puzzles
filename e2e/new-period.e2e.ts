import { expect, test } from '@playwright/test';

for (const [label, viewport] of [
	['wide', { width: 1280, height: 800 }],
	['phone', { width: 390, height: 844 }]
] as const) {
	test(`${label}: at midnight UTC the open daily puzzle points to the new one`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.clock.install({ time: new Date('2026-10-12T23:59:30Z') });
		await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
		await page.goto('/tetroid?v=daily');
		await expect(page.getByRole('application', { name: 'Puzzle board' })).toBeVisible({
			timeout: 30_000
		});
		const id = page.locator('.font-mono.select-all');
		const yesterday = await id.textContent();
		const next = page.getByRole('button', { name: 'New puzzle' });
		await expect(next).not.toHaveClass(/btn-primary/);

		await page.clock.fastForward('01:00');
		const notice = page.getByText('The new daily puzzle is out. This one is from yesterday.');
		await expect(notice.first()).toBeVisible();
		const today = page.getByRole('button', { name: "Today's puzzle" });
		await expect(today).toHaveClass(/btn-primary/);

		await today.click();
		await expect(id).not.toHaveText(yesterday ?? '');
		await expect(next).toBeVisible();
		await expect(next).not.toHaveClass(/btn-primary/);
		await expect(notice).toHaveCount(0);
		await expect(page).toHaveURL(/v=daily/);
	});
}
