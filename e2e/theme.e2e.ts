import { expect, test, type Locator, type Page } from '@playwright/test';

const LIGHT = 'rgb(255, 255, 255)';
const DARK = 'rgb(28, 25, 23)';

/** The board's background as the browser paints it (its first rect). */
const background = (board: Locator) =>
	board
		.locator('rect')
		.first()
		.evaluate((el) => getComputedStyle(el).fill);

/** Share of near-white pixels in a PNG data URL. */
function lightShare(page: Page, url: string) {
	return page.evaluate(async (src) => {
		const img = new Image();
		img.src = src;
		await img.decode();
		const canvas = document.createElement('canvas');
		canvas.width = img.width;
		canvas.height = img.height;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0);
		const data = ctx.getImageData(0, 0, img.width, img.height).data;
		let light = 0;
		for (let k = 0; k < data.length; k += 4)
			if (Math.min(data[k], data[k + 1], data[k + 2]) > 230) light++;
		return light / (data.length / 4);
	}, url);
}

test.use({ colorScheme: 'dark' });

test('the board follows night mode; screenshots and prints stay light', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
	await page.goto('/tetroid?v=6n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	const board = page.getByRole('grid', { name: 'Puzzle board' });

	// No choice made yet: the system's dark scheme applies, to the page and the board.
	await expect(page.locator('html')).toHaveClass(/\bdark\b/);
	expect(await background(board)).toBe(DARK);

	await page.getByRole('button', { name: 'Share board' }).click();
	const image = page.getByRole('link', { name: 'Screenshot (PNG)' });
	expect(await lightShare(page, (await image.getAttribute('href'))!)).toBeGreaterThan(0.5);

	await page.emulateMedia({ media: 'print' });
	expect(await background(page.locator('.print-only svg'))).toBe(LIGHT);
	await page.emulateMedia({ media: 'screen' });

	// The player's choice beats the system's, also after a reload.
	await page.getByRole('button', { name: 'Switch to day mode' }).click();
	expect(await background(board)).toBe(LIGHT);
	await page.reload();
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
	expect(await background(board)).toBe(LIGHT);
});

test('night mode is in place before the app starts', async ({ page }) => {
	await page.route('**/_app/**/*.js', (route) => route.abort());
	await page.goto('/about');
	await expect(page.locator('html')).toHaveClass(/\bdark\b/);
	expect(
		await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
	).not.toBe(LIGHT);
});

test('the daily puzzle link stays readable on hover at night', async ({ page }) => {
	await page.goto('/');
	const daily = page.getByRole('link', { name: /Daily puzzle waiting/ }).first();
	await daily.hover();
	const ratio = await daily.evaluate((el) => {
		const style = getComputedStyle(el);
		// Tailwind's colours are oklch(); a canvas pixel gives them as sRGB.
		const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
		const luminance = (colour: string) => {
			ctx.clearRect(0, 0, 1, 1);
			ctx.fillStyle = colour;
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
				const c = v / 255;
				return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		const [hi, lo] = [luminance(style.color), luminance(style.backgroundColor)].sort(
			(a, b) => b - a
		);
		return (hi + 0.05) / (lo + 0.05);
	});
	expect(ratio).toBeGreaterThanOrEqual(4.5);
});
