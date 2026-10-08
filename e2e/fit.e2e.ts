import { expect, test } from '@playwright/test';

// Phones in both languages, and a desktop screen tall enough for the side panel. (Smaller
// phones like 375×667 keep a minimum board size and may scroll a little.)
for (const [width, height, locale, mobile] of [
	[360, 740, 'de-DE', true],
	[390, 844, 'en-US', true],
	[412, 915, 'de-DE', true],
	[1920, 1080, 'en-US', false]
] as const) {
	test.describe(`${width}×${height} ${locale}`, () => {
		test.use({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale });

		for (const path of ['/tetroid?v=6n', '/pinwheel?v=5n']) {
			test(`${path} fits the screen down to the About line`, async ({ page }) => {
				await page.addInitScript(() => {
					for (const g of ['tetroid', 'pinwheel'])
						localStorage.setItem(`vp:tutorialSeen:${g}`, 'true');
					localStorage.setItem('vp:puzzleSource', '"bank"');
				});
				await page.goto(path);
				await expect(page.locator('.overflow-x-auto svg[role="grid"]')).toBeVisible({
					timeout: 30_000
				});
				await page.waitForLoadState('networkidle');
				const about = page.getByRole('link', { name: /^(About|Über)$/ });
				await expect(about).toBeInViewport();
				// Nothing to scroll: the page ends within the screen.
				await expect
					.poll(() =>
						page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
					)
					.toBeLessThanOrEqual(0);
			});
		}
	});
}
