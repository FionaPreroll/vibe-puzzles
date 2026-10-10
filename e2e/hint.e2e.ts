import { expect, test } from '@playwright/test';

// Tetroid 6×6 Normal #496678832 from the bundled bank, and its shaded cells.
const PUZZLE = '/tetroid?v=6n&id=496678832';
const SOLUTION = '101111111000100101111111100001100000';

test('the hint points at the next step, and at a wrong mark', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	const spotlight = board.locator('g.spotlight > *');
	const status = page.getByRole('status');

	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(spotlight).toHaveCount(2);
	await expect(status).toContainText('Every tetromino left in this region covers');

	// A wrong mark: the hint names it instead of a step. The move also clears the old hint.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 6;
	const wrong = SOLUTION.indexOf('0');
	await page.mouse.click(
		grid.x + ((wrong % 6) + 0.5) * cell,
		grid.y + (Math.floor(wrong / 6) + 0.5) * cell
	);
	await expect(spotlight).toHaveCount(0);
	await page.keyboard.press('h');
	await expect(status).toHaveText('The highlighted marks do not match the solution.');
	await expect(spotlight).toHaveCount(1);
});

test.describe('320 px wide', () => {
	test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

	test('the hint sits in the "more" menu, so the toolbar keeps one row', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
			localStorage.setItem('vp:puzzleSource', '"bank"');
		});
		await page.goto(PUZZLE);
		const board = page.locator('.overflow-x-auto svg[role="grid"]');
		await expect(board).toBeVisible({ timeout: 30_000 });
		const undo = (await page.getByRole('button', { name: 'Undo' }).boundingBox())!;
		const zoom = (await page.getByRole('button', { name: 'Zoom' }).boundingBox())!;
		expect(undo.y).toBe(zoom.y);
		await expect(page.getByRole('button', { name: 'Hint' })).toBeHidden();

		await page.getByRole('button', { name: 'More' }).click();
		await page.getByRole('group', { name: 'More' }).getByRole('button', { name: 'Hint' }).click();
		await expect(board.locator('g.spotlight > *')).toHaveCount(2);
	});
});

test('the Sudoku and Calcudoku hints name the digit and its cell', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:sudoku', 'true'));
	await page.goto('/sudoku?v=9e');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	await expect(board.locator('text').first()).toBeVisible();
	const spotlight = board.locator('g.spotlight > *');
	const status = page.getByRole('status');

	await page.keyboard.press('h');
	await expect(status).toContainText('fits only in the highlighted cell');
	const digit = (await status.textContent())!.match(/In its box, (\d)/)![1];
	await expect(spotlight).toHaveCount(1);

	// Entering that digit in the highlighted cell is right: the next hint is another step.
	const cell = (await spotlight.boundingBox())!;
	await page.mouse.click(cell.x + cell.width / 2, cell.y + cell.height / 2);
	await page.keyboard.press(digit);
	await expect(spotlight).toHaveCount(0);
	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(status).toContainText('fits only in the highlighted cell');

	await page.goto('/sudoku?v=c5e');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await expect(board.locator('text').first()).toBeVisible();
	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(spotlight).toHaveCount(1);
	await expect(status).toContainText('the highlighted cell');
});

test('the Pinwheel hint points at edges that need a line', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:pinwheel', 'true'));
	await page.goto('/pinwheel?v=5n');
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible();
	const spotlight = board.locator('g.spotlight > *');
	const status = page.getByRole('status');

	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(status).toContainText('draw lines there');
	expect(await spotlight.count()).toBeGreaterThan(0);

	// Drawing the first highlighted line clears the hint; the next one is another step.
	const edge = (await spotlight.first().boundingBox())!;
	await page.mouse.click(edge.x + edge.width / 2, edge.y + edge.height / 2);
	await expect(spotlight).toHaveCount(0);
	await page.keyboard.press('h');
	await expect(status).toContainText('draw lines there');
});

test('a setting hides the hint button and its key', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
		localStorage.setItem(
			'vp:settings:tetroid',
			JSON.stringify({ values: { hideHint: true }, updatedAt: 1 })
		);
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Hint' })).toHaveCount(0);
	await page.keyboard.press('h');
	await expect(board.locator('g.spotlight > *')).toHaveCount(0);
	await expect(page.getByRole('status')).toHaveText('');
});
