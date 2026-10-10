import { expect, test, type Page } from '@playwright/test';

/** The Halloween look: on by the calendar from 1 October to 1 November, or by choice. */

// No look chosen yet, unlike the rest of the suite (see playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });

const OCTOBER = new Date(2026, 9, 15, 12);
const MARCH = new Date(2027, 2, 15, 12);
const CREAM = 'rgb(255, 248, 241)';

const root = (page: Page) => page.locator('html');
const themeSelect = (page: Page) => page.getByRole('combobox', { name: 'Theme' });

test('the calendar picks Halloween in October; the player can switch it off and back', async ({
	page
}) => {
	await page.clock.setFixedTime(OCTOBER);
	await page.goto('/');
	await expect(root(page)).toHaveAttribute('data-theme', 'halloween');
	await expect(themeSelect(page).locator('option:checked')).toHaveText('Automatic (Halloween)');
	await expect(page.getByText('Trick or puzzle?')).toBeVisible();

	await themeSelect(page).selectOption('classic');
	await expect(root(page)).not.toHaveAttribute('data-theme');
	await expect(page.getByText('Trick or puzzle?')).toBeHidden();
	await page.reload();
	await expect(root(page)).not.toHaveAttribute('data-theme');
	await expect(themeSelect(page)).toHaveValue('classic');

	await themeSelect(page).selectOption('auto');
	await expect(root(page)).toHaveAttribute('data-theme', 'halloween');
});

test('outside the season the look stays classic unless the player picks Halloween', async ({
	page
}) => {
	await page.clock.setFixedTime(MARCH);
	await page.goto('/');
	await expect(themeSelect(page).locator('option:checked')).toHaveText('Automatic (Classic)');
	await expect(root(page)).not.toHaveAttribute('data-theme');

	await themeSelect(page).selectOption('halloween');
	await expect(root(page)).toHaveAttribute('data-theme', 'halloween');
	await page.reload();
	await expect(root(page)).toHaveAttribute('data-theme', 'halloween');
});

test('the look is in place before the app starts', async ({ page }) => {
	await page.clock.setFixedTime(OCTOBER);
	await page.route('**/_app/**/*.js', (route) => route.abort());
	await page.goto('/about');
	await expect(root(page)).toHaveAttribute('data-theme', 'halloween');
	expect(await root(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(CREAM);
});

for (const night of [false, true]) {
	test.describe(night ? 'by night' : 'by day', () => {
		test.use({ colorScheme: night ? 'dark' : 'light' });

		test('the home page has its decorations and no sideways scrolling', async ({ page }) => {
			await page.addInitScript(() => localStorage.setItem('vp:look', '"halloween"'));
			for (const width of [360, 1280]) {
				await page.setViewportSize({ width, height: 800 });
				await page.goto('/');
				await expect(
					page.getByText(night ? 'Puzzles by moonlight' : 'Trick or puzzle?')
				).toBeVisible();
				await expect(
					page.getByText(night ? 'Trick or puzzle?' : 'Puzzles by moonlight')
				).toBeHidden();
				await expect(page.locator('li.panel svg.halloween-swing')).toBeVisible();
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
			}
		});
	});
}

// Pinwheel 7×7 Normal #1027244002 from the bundled bank and its solution lines, as in
// galaxy-dots.e2e.ts.
const PINWHEEL = '/pinwheel?v=7n&id=1027244002';
const H = '00000001111110000011100101110000011110111100000010000000';
const V = '00001110001111100011110000101100001011000111011001110110';

/** Draws all solution lines but the last; returns a function that draws that one. */
async function almostSolve(page: Page) {
	await page.goto(PINWHEEL);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 7;
	const edges = [
		...[...H].flatMap((c, k) => (c === '1' ? [[(k % 7) + 0.5, Math.floor(k / 7)]] : [])),
		...[...V].flatMap((c, k) => (c === '1' ? [[k % 8, Math.floor(k / 8) + 0.5]] : []))
	];
	const draw = ([x, y]: number[]) => page.mouse.click(grid.x + x * cell, grid.y + y * cell);
	for (const edge of edges.slice(0, -1)) await draw(edge);
	return { board, last: () => draw(edges[edges.length - 1]) };
}

test.describe('Pinwheel', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('vp:look', '"halloween"');
			localStorage.setItem('vp:tutorialSeen:pinwheel', 'true');
			localStorage.setItem('vp:puzzleSource', '"bank"');
		});
	});

	test('the centres are pumpkins that light up once solved, with pumpkins flying', async ({
		page
	}) => {
		const { board, last } = await almostSolve(page);
		await expect(board.locator('.pumpkin')).toHaveCount(20);
		await expect(board.locator('circle[stroke-width="2"]')).toHaveCount(0);
		// Black holes are off: no galaxy gives itself away before the end.
		await expect(board.locator('.pumpkin.lit')).toHaveCount(0);

		await last();
		await expect(board.locator('.pumpkin.lit')).toHaveCount(20);
		await expect(page.locator('.halloween-burst .flyer')).toHaveCount(16);
		await expect(page.locator('.halloween-burst .flap')).toHaveCount(0);
		await expect(page.locator('.solved-burst')).toHaveCount(0);
		await expect(page.locator('.halloween-burst')).toHaveCount(0, { timeout: 5000 });
		// The printed board keeps its plain circles.
		await expect(page.locator('.print-only .pumpkin')).toHaveCount(0);
	});

	test.describe('by night', () => {
		test.use({ colorScheme: 'dark' });

		test('with black holes on, each pumpkin lights up with its galaxy; bats fly', async ({
			page
		}) => {
			await page.addInitScript(() =>
				localStorage.setItem(
					'vp:settings:pinwheel',
					JSON.stringify({ values: { blackHoles: true }, updatedAt: 1 })
				)
			);
			const { board, last } = await almostSolve(page);
			await expect(board.locator('.pumpkin.lit')).toHaveCount(18);
			await last();
			await expect(board.locator('.pumpkin.lit')).toHaveCount(20);
			await expect(page.locator('.halloween-burst .flap')).toHaveCount(16);
		});
	});
});
