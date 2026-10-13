import { expect, test, type Page } from '@playwright/test';

/**
 * Widescreen, a choice in the settings on wide screens: the board alone in its column, as tall as
 * the screen, and everything else in a panel on the right or the left that folds into a strip.
 */
const PUZZLE = '/tetroid?v=6n&id=496678832';

async function openPuzzle(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	return board;
}

async function pickLayout(page: Page, name: string) {
	await page.getByRole('button', { name: 'Settings' }).first().click();
	await page.getByRole('radio', { name }).check();
	await page.keyboard.press('Escape');
}

const box = async (page: Page, selector: string) =>
	(await page.locator(selector).first().boundingBox())!;

/** The page ends within the screen, footer included. */
async function expectNoScroll(page: Page) {
	await expect(page.getByRole('link', { name: 'About' })).toBeInViewport();
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight))
		.toBeLessThanOrEqual(0);
}

test.describe('desktop', () => {
	test.use({ viewport: { width: 1920, height: 1080 } });

	test('the board takes the screen height, with the controls on either side', async ({ page }) => {
		const board = await openPuzzle(page);
		const standard = (await board.boundingBox())!;
		const panel = page.getByRole('complementary', { name: 'Tetroid menu' });

		await pickLayout(page, 'Widescreen, controls on the right');
		await expect(page.getByRole('button', { name: 'Collapse controls' })).toBeVisible();
		await expect.poll(async () => (await board.boundingBox())!.height).toBeGreaterThan(800);
		const right = (await board.boundingBox())!;
		expect(right.height).toBeGreaterThan(standard.height + 200);
		expect(right.x + right.width).toBeLessThan((await panel.boundingBox())!.x);
		// The panel holds the play bar, the puzzle's ID and the puzzle types.
		await expect(panel.getByRole('button', { name: 'Undo' })).toBeVisible();
		await expect(panel.getByText('496,678,832')).toBeVisible();
		await expect(panel.getByRole('navigation', { name: 'Puzzle type' })).toBeVisible();
		await expectNoScroll(page);

		await pickLayout(page, 'Widescreen, controls on the left');
		await expect
			.poll(async () => {
				const p = (await panel.boundingBox())!;
				return p.x + p.width < (await board.boundingBox())!.x;
			})
			.toBe(true);
		await expectNoScroll(page);

		// Remembered on this device.
		await page.reload();
		await expect(board).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole('button', { name: 'Collapse controls' })).toBeVisible();
		const p = await box(page, 'aside');
		expect(p.x).toBeLessThan((await board.boundingBox())!.x);

		await pickLayout(page, 'Standard');
		await expect(page.getByRole('button', { name: 'Collapse controls' })).toBeHidden();
		await expect(page.getByRole('button', { name: 'Collapse panel' })).toBeVisible();
		await expect.poll(async () => (await board.boundingBox())!.height).toBe(standard.height);
	});

	test('the panel folds into a strip with the play bar, and stays folded', async ({ page }) => {
		const board = await openPuzzle(page);
		await pickLayout(page, 'Widescreen, controls on the right');
		const wide = (await box(page, 'aside')).width;

		await page.getByRole('button', { name: 'Collapse controls' }).click();
		await expect.poll(async () => (await box(page, 'aside')).width).toBeLessThan(100);
		expect(wide).toBeGreaterThan(300);
		const strip = page.getByRole('complementary', { name: 'Tetroid menu' });
		await expect(strip.getByRole('button', { name: 'Hint', exact: true })).toBeVisible();
		await expect(strip.getByRole('button', { name: 'Settings' })).toBeVisible();
		await expectNoScroll(page);

		// Messages and hints show beside the strip.
		await strip.getByRole('button', { name: 'Hint', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Show the step' })).toBeVisible();
		const note = await box(page, '.hint-note');
		expect(note.x + note.width).toBeLessThanOrEqual((await box(page, 'aside')).x);

		await page.reload();
		await expect(board).toBeVisible({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Expand controls' }).click();
		await expect.poll(async () => (await box(page, 'aside')).width).toBe(wide);
	});
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	test('keeps its own layout and offers no widescreen', async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('vp:layout', '"right"'));
		await openPuzzle(page);
		await expect(page.getByRole('button', { name: 'Puzzle types and rules' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Collapse controls' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Settings' }).click();
		await expect(page.getByRole('group', { name: 'Touch input' })).toBeVisible();
		await expect(page.getByRole('group', { name: 'Layout on wide screens' })).toHaveCount(0);
	});
});
