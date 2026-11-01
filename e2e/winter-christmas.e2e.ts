import { expect, test, type Page } from '@playwright/test';

/**
 * The winter and the Christmas look: by the calendar winter from 2 November, Christmas from 1 to
 * 27 December, winter again until the end of January; or by choice.
 */

// No look chosen yet, unlike the rest of the suite (see playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });

const NOVEMBER = new Date(2026, 10, 15, 12);
const ADVENT = new Date(2026, 11, 10, 12);
const AFTER_CHRISTMAS = new Date(2026, 11, 28, 12);
const FEBRUARY = new Date(2027, 1, 2, 12);

const root = (page: Page) => page.locator('html');
const themeSelect = (page: Page) => page.getByRole('combobox', { name: 'Theme' });

/**
 * Opens the home page, or reloads it, and waits until the app runs: a look picked before that
 * goes unnoticed. The look itself shows earlier, set by app.html, and the daily puzzle links only
 * once the app runs.
 */
async function openHome(page: Page, reload = false) {
	await (reload ? page.reload() : page.goto('/'));
	await expect(page.getByRole('link', { name: /Daily puzzle waiting/ }).first()).toBeVisible();
}

test('the calendar picks winter in November, Christmas in December and winter after it', async ({
	page
}) => {
	for (const [now, look, label, tagline] of [
		[NOVEMBER, 'winter', 'Winter (automatic)', 'Let it snow, let it solve'],
		[ADVENT, 'christmas', 'Christmas (automatic)', 'Merry puzzling!'],
		[AFTER_CHRISTMAS, 'winter', 'Winter (automatic)', 'Let it snow, let it solve']
	] as const) {
		await page.clock.setFixedTime(now);
		await page.goto('/');
		await expect(root(page)).toHaveAttribute('data-theme', look);
		await expect(themeSelect(page).locator('option:checked')).toHaveText(label);
		await expect(page.getByText(tagline)).toBeVisible();
	}

	await page.clock.setFixedTime(FEBRUARY);
	await page.goto('/');
	await expect(root(page)).not.toHaveAttribute('data-theme');
	await expect(themeSelect(page).locator('option:checked')).toHaveText('Classic (automatic)');
});

test('in December the player can pick winter or the classic look instead', async ({ page }) => {
	await page.clock.setFixedTime(ADVENT);
	await openHome(page);
	await themeSelect(page).selectOption('winter');
	await expect(root(page)).toHaveAttribute('data-theme', 'winter');
	await expect(page.getByText('Merry puzzling!')).toBeHidden();
	await openHome(page, true);
	await expect(root(page)).toHaveAttribute('data-theme', 'winter');
	await expect(themeSelect(page)).toHaveValue('winter');

	await themeSelect(page).selectOption('classic');
	await expect(root(page)).not.toHaveAttribute('data-theme');
	await themeSelect(page).selectOption('auto');
	await expect(root(page)).toHaveAttribute('data-theme', 'christmas');
});

test('the look is in place before the app starts', async ({ page }) => {
	await page.route('**/_app/**/*.js', (route) => route.abort());
	for (const [now, look, background] of [
		[NOVEMBER, 'winter', 'rgb(243, 248, 253)'],
		[ADVENT, 'christmas', 'rgb(252, 247, 239)']
	] as const) {
		await page.clock.setFixedTime(now);
		await page.goto('/about');
		await expect(root(page)).toHaveAttribute('data-theme', look);
		expect(await root(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
			background
		);
	}
});

const TAGLINES = {
	winter: ['Let it snow, let it solve', 'Puzzles under the northern lights'],
	christmas: ['Merry puzzling!', 'Puzzles by fairy light']
} as const;

for (const look of ['winter', 'christmas'] as const) {
	for (const night of [false, true]) {
		test.describe(`${look} by ${night ? 'night' : 'day'}`, () => {
			test.use({ colorScheme: night ? 'dark' : 'light' });
			test.beforeEach(async ({ page }) => {
				await page.addInitScript((look) => {
					localStorage.setItem('vp:look', `"${look}"`);
					localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
					localStorage.setItem('vp:puzzleSource', '"bank"');
				}, look);
			});

			test('the home page has its decorations and no sideways scrolling', async ({ page }) => {
				const [day, nightLine] = TAGLINES[look];
				for (const width of [360, 1280]) {
					await page.setViewportSize({ width, height: 800 });
					await page.goto('/');
					await expect(page.getByText(night ? nightLine : day)).toBeVisible();
					await expect(page.getByText(night ? day : nightLine)).toBeHidden();
					// The scene beside the title, the decoration under the header and the logo.
					await expect(page.locator(`section > .${look}-only svg:visible`).first()).toBeVisible();
					await expect(page.locator(`header .${look}-only`).last()).toBeVisible();
					await expect(page.locator(`header a span.${look}-only svg:visible`)).toHaveCount(1);
					expect(
						await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
					).toBe(true);
				}
			});

			test('solving a puzzle sets off its own win animation', async ({ page }) => {
				await page.goto('/tetroid?v=6n&id=496678832');
				const board = page.getByRole('application', { name: 'Puzzle board' }).first();
				await expect(board).toBeVisible({ timeout: 30_000 });
				await page.waitForLoadState('networkidle');
				const grid = (await board.locator('rect').first().boundingBox())!;
				const cell = grid.width / 6;
				for (const [i, c] of [...'101111111000100101111111100001100000'].entries()) {
					if (c === '1')
						await page.mouse.click(
							grid.x + ((i % 6) + 0.5) * cell,
							grid.y + (Math.floor(i / 6) + 0.5) * cell
						);
				}
				await expect(page.locator('.solved-glow')).toHaveCount(1);
				await expect(page.locator(`.${look}-burst .flyer`)).toHaveCount(18);
				if (look === 'christmas')
					await expect(page.locator('.christmas-burst .light')).toHaveCount(night ? 9 : 0);
				await expect(page.locator('.solved-burst')).toHaveCount(0);
				await expect(page.locator(`.${look}-burst`)).toHaveCount(0, { timeout: 5000 });
			});
		});
	}
}

/** Opens a Tetroid board on a wide screen, with room for decorations beside it. */
async function openWideBoard(page: Page, look: 'winter' | 'christmas') {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript((look) => {
		localStorage.setItem('vp:look', `"${look}"`);
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	}, look);
	await page.goto('/tetroid?v=6n&id=496678832');
	await expect(page.getByRole('application', { name: 'Puzzle board' }).first()).toBeVisible({
		timeout: 30_000
	});
	await page.waitForLoadState('networkidle');
}

test('at Christmas a bauble hangs from the header beside a wide board', async ({ page }) => {
	await openWideBoard(page, 'christmas');
	// Measured without the swing, which tilts the thread a little.
	await page.addStyleTag({ content: '[data-bauble] { animation: none !important; }' });
	const header = (await page.locator('header').first().boundingBox())!;
	const bauble = page.locator('[data-bauble]');
	await expect(bauble).toBeVisible();
	await expect(page.locator('.winter-snowfall')).toBeHidden();
	const thread = (await bauble.boundingBox())!;
	const stage = (await page.locator('.board-stage').boundingBox())!;
	expect(Math.abs(thread.y - (header.y + header.height))).toBeLessThan(1.5);
	// Right of the stage, down to its upper part.
	expect(thread.x).toBeGreaterThan(stage.x + stage.width);
	expect(thread.y + thread.height).toBeGreaterThan(stage.y + 40);
	expect(thread.y + thread.height).toBeLessThan(stage.y + stage.height / 2);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('in winter snow falls beside a wide board', async ({ page }) => {
	await openWideBoard(page, 'winter');
	await expect(page.locator('.winter-snowfall')).toBeVisible();
	await expect(page.locator('[data-bauble]')).toBeHidden();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test.describe('on a small phone in German', () => {
	test.use({ viewport: { width: 360, height: 740 }, locale: 'de-DE' });

	test('the theme switch keeps the footer one line high, so boards keep their size', async ({
		page
	}) => {
		for (const [now, label] of [
			[NOVEMBER, 'Winter (automatisch)'],
			[ADVENT, 'Weihnacht (automatisch)']
		] as const) {
			await page.clock.setFixedTime(now);
			await page.goto('/about');
			const select = page.getByRole('combobox', { name: 'Design' });
			await expect(select.locator('option:checked')).toHaveText(label);
			const footer = page.locator('footer');
			const height = await footer.evaluate(
				(el) => el.getBoundingClientRect().height - parseFloat(getComputedStyle(el).paddingBottom)
			);
			expect(height).toBeLessThanOrEqual(16);
		}
	});
});
