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
	await expect(themeSelect(page).locator('option:checked')).toHaveText('Halloween (automatic)');
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
	await expect(themeSelect(page).locator('option:checked')).toHaveText('Classic (automatic)');
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
				// A spider has eight legs.
				await expect(page.locator('li.panel svg.halloween-swing g[fill="none"] path')).toHaveCount(
					8
				);
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
			}
		});
	});
}

test.describe('on a small phone in German', () => {
	test.use({ viewport: { width: 360, height: 740 }, locale: 'de-DE' });

	test('the theme switch keeps the footer one line high, so boards keep their size', async ({
		page
	}) => {
		await page.clock.setFixedTime(OCTOBER);
		await page.goto('/about');
		const select = page.getByRole('combobox', { name: 'Design' });
		await expect(select.locator('option:checked')).toHaveText('Halloween (automatisch)');
		const footer = page.locator('footer');
		const height = await footer.evaluate(
			(el) => el.getBoundingClientRect().height - parseFloat(getComputedStyle(el).paddingBottom)
		);
		expect(height).toBeLessThanOrEqual(16);
	});
});

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

for (const night of [false, true]) {
	test(`${night ? 'by night' : 'by day'}, the spider beside the board hangs from the header`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.addInitScript((night) => {
			localStorage.setItem('vp:look', '"halloween"');
			localStorage.setItem('vp:night', JSON.stringify(night));
			localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
			localStorage.setItem('vp:puzzleSource', '"bank"');
		}, night);
		await page.goto('/tetroid?v=6n&id=496678832');
		await expect(page.getByRole('grid', { name: 'Puzzle board' }).first()).toBeVisible({
			timeout: 30_000
		});
		await page.waitForLoadState('networkidle');
		// Measured without the swing, which tilts the thread a little.
		await page.addStyleTag({ content: '[data-spider] { animation: none !important; }' });
		const header = (await page.locator('header').first().boundingBox())!;
		const spider = page.locator('[data-spider]');
		await expect(spider).toBeVisible();
		const thread = (await spider.boundingBox())!;
		const stage = (await page.locator('.board-stage').boundingBox())!;
		expect(Math.abs(thread.y - (header.y + header.height))).toBeLessThan(1.5);
		// Beside the stage, down to its upper part.
		expect(thread.x + thread.width).toBeLessThan(stage.x);
		expect(thread.y + thread.height).toBeGreaterThan(stage.y + 40);
		expect(thread.y + thread.height).toBeLessThan(stage.y + stage.height / 2);
	});
}
