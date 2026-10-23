import { expect, test, type Page } from '@playwright/test';

/**
 * Widescreen on screens in landscape: the board alone in its column, as tall as the screen, and
 * everything else in a panel on the right or the left that folds into a strip. The default is the
 * panel on the left on touch screens and smaller desktop screens, the standard layout on large
 * desktop screens; the settings offer all three. The other browser tests use the standard layout
 * (`playwright.config.ts`).
 */
const PUZZLE = '/tetroid?v=6n&id=496678832';

async function openPuzzle(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="application"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	return board;
}

async function pickLayout(page: Page, name: string) {
	await page.getByRole('button', { name: 'Settings' }).first().click();
	await page.getByRole('radio', { name, exact: true }).check();
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
		await expect(page.getByRole('group', { name: 'Layout in landscape' })).toHaveCount(0);
	});
});

test.describe('phone on its side', () => {
	test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

	test('hides the header bar and keeps the controls compact', async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('vp:layout', '"left"'));
		const board = await openPuzzle(page);
		const nav = page.getByRole('navigation', { name: 'Main' });
		await expect(nav).not.toBeInViewport();
		await expect(board).toBeInViewport({ ratio: 1 });
		expect((await board.boundingBox())!.y).toBeLessThan(40);
		// Every button in the play bar has room for its name.
		const panel = page.getByRole('complementary', { name: 'Tetroid menu' });
		const crowded = () =>
			panel.evaluate((el) =>
				[...el.querySelectorAll<HTMLElement>('.play-btn')].filter(
					(b) => b.scrollWidth > b.clientWidth
				)
			);
		expect(await crowded()).toHaveLength(0);

		// The header comes down from the panel's menu button, and goes away on a tap elsewhere.
		await panel.getByRole('button', { name: 'Menu', exact: true }).click();
		await expect(nav).toBeInViewport();
		await page.touchscreen.tap(830, 380);
		await expect(nav).not.toBeInViewport();

		// Folded: the play bar's icons in two columns, still with their names.
		await page.getByRole('button', { name: 'Collapse controls' }).click();
		await expect.poll(async () => (await box(page, 'aside')).width).toBeLessThan(120);
		await expect(panel.getByRole('button', { name: 'Hint', exact: true })).toBeInViewport();
		await panel.getByRole('button', { name: 'Menu', exact: true }).click();
		await expect(nav).toBeInViewport();
	});
});

test.describe('by default', () => {
	/** Without a choice of layout, as for a new player. */
	const noChoice = (page: Page) => page.addInitScript(() => localStorage.removeItem('vp:layout'));

	/** The panel is on the left of the board. */
	async function expectPanelLeft(page: Page) {
		const board = page.locator('.overflow-x-auto svg[role="application"]');
		await expect(page.getByRole('button', { name: 'Collapse controls' })).toBeVisible();
		await expect
			.poll(async () => {
				const p = await box(page, 'aside');
				return p.x + p.width < (await board.boundingBox())!.x;
			})
			.toBe(true);
		await expect(board).toBeInViewport({ ratio: 1 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
	}

	test.describe('large desktop screen', () => {
		const size = { width: 1920, height: 1080 };
		test.use({ viewport: size, screen: size });

		test('keeps the standard layout', async ({ page }) => {
			await noChoice(page);
			await openPuzzle(page);
			await expect(page.getByRole('button', { name: 'Collapse panel' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Collapse controls' })).toHaveCount(0);
			await page.getByRole('button', { name: 'Settings' }).first().click();
			const layouts = page.getByRole('group', { name: 'Layout in landscape' });
			await expect(
				layouts.getByRole('radio', { name: 'Use game default (Standard)' })
			).toBeChecked();
			await page.keyboard.press('Escape');

			// A layout picked holds; the game's default can be picked again.
			await pickLayout(page, 'Widescreen, controls on the left');
			await expect(page.getByRole('button', { name: 'Collapse controls' })).toBeVisible();
			await pickLayout(page, 'Use game default (Standard)');
			await expect(page.getByRole('button', { name: 'Collapse panel' })).toBeVisible();
			expect(await page.evaluate(() => localStorage.getItem('vp:layout'))).toBe('"auto"');
		});
	});

	test.describe('smaller desktop screen', () => {
		const size = { width: 1440, height: 900 };
		test.use({ viewport: { width: 1440, height: 780 }, screen: size });

		test('is widescreen with the controls on the left', async ({ page }) => {
			await noChoice(page);
			await openPuzzle(page);
			await expectPanelLeft(page);
			await expectNoScroll(page);
			await page.getByRole('button', { name: 'Settings' }).first().click();
			const layouts = page.getByRole('group', { name: 'Layout in landscape' });
			await expect(
				layouts.getByRole('radio', { name: 'Use game default (Widescreen, controls on the left)' })
			).toBeChecked();
		});
	});

	for (const [name, width, height] of [
		['tablet in landscape', 1180, 820],
		['large tablet in landscape', 1366, 1024],
		['phone in landscape', 844, 390]
	] as const) {
		test.describe(name, () => {
			test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

			test('is widescreen with the controls on the left', async ({ page }) => {
				await noChoice(page);
				await openPuzzle(page);
				await expectPanelLeft(page);
				await page.getByRole('button', { name: 'Settings' }).first().click();
				await expect(page.getByRole('group', { name: 'Touch input' })).toBeVisible();
				await expect(page.getByRole('group', { name: 'Layout in landscape' })).toBeVisible();
			});
		});
	}

	test.describe('turning a phone', () => {
		test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

		test('goes widescreen on its side and back upright, with the game kept', async ({ page }) => {
			await noChoice(page);
			const board = await openPuzzle(page);
			await expect(page.getByRole('button', { name: 'Puzzle types and rules' })).toBeVisible();
			const b = (await board.boundingBox())!;
			await page.touchscreen.tap(b.x + b.width / 12, b.y + b.height / 12);
			const undo = page.getByRole('button', { name: 'Undo' }).filter({ visible: true });
			await expect(undo).toBeEnabled();

			await page.setViewportSize({ width: 844, height: 390 });
			await expectPanelLeft(page);
			await expect(undo).toBeEnabled();

			await page.setViewportSize({ width: 390, height: 844 });
			await expect(page.getByRole('button', { name: 'Puzzle types and rules' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Collapse controls' })).toHaveCount(0);
			await expect(undo).toBeEnabled();
			await expect(page.getByRole('navigation', { name: 'Main' })).toBeInViewport();
		});
	});
});
