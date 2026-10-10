import { expect, test } from '@playwright/test';

// Tetroid 6×6 Normal #496678832 from the bundled bank, and its shaded cells.
const PUZZLE = '/tetroid?v=6n&id=496678832';
const SOLUTION = '101111111000100101111111100001100000';

test('the hint first tints where to look, then points at the step, and at a wrong mark', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	const spotlight = board.locator('g.spotlight > *');
	const area = board.locator('g.area > *');
	const status = page.getByRole('status');

	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(status).toContainText('tinted region');
	await expect(spotlight).toHaveCount(0);
	expect(await area.count()).toBeGreaterThan(0);
	// The message offers the step itself, as a second press of Hint does.
	await page.getByRole('button', { name: 'Show the step' }).click();
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
	await expect(area).toHaveCount(0);
	// A wrong mark is shown at once.
	await page.keyboard.press('h');
	await expect(status).toHaveText('The highlighted marks do not match the solution.');
	await expect(spotlight).toHaveCount(1);
});

test.describe('320 px wide', () => {
	test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

	test('the play bar at the bottom keeps undo, redo, the tools and the hint in one row', async ({
		page
	}) => {
		await page.addInitScript(() => {
			localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
			localStorage.setItem('vp:puzzleSource', '"bank"');
		});
		await page.goto(PUZZLE);
		const board = page.locator('.overflow-x-auto svg[role="grid"]');
		await expect(board).toBeVisible({ timeout: 30_000 });
		const names = ['Undo', 'Redo', 'Cycle', 'Black', 'Cross', 'Blank', 'Hint'];
		const boxes = await Promise.all(
			names.map(
				async (name) => (await page.getByRole('button', { name, exact: true }).boundingBox())!
			)
		);
		for (const [i, box] of boxes.entries()) {
			expect(box.y, names[i]).toBe(boxes[0].y);
			expect(box.x + box.width, names[i]).toBeLessThanOrEqual(320);
		}
		// Below the board, not on it.
		const grid = (await board.boundingBox())!;
		expect(boxes[0].y).toBeGreaterThan(grid.y + grid.height);

		await page.getByRole('button', { name: 'Hint', exact: true }).click();
		expect(await board.locator('g.area > *').count()).toBeGreaterThan(0);
		await page.getByRole('button', { name: 'Show the step' }).click();
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
	await expect(status).toContainText('In the tinted box, one of the missing digits');
	await expect(board.locator('g.area > *')).toHaveCount(9);
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
	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(status).toContainText('fits only in the highlighted cell');

	await page.goto('/sudoku?v=c5e');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await expect(board.locator('text').first()).toBeVisible();
	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(status).toContainText('tinted');
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
	await expect(status).toContainText('Look at the tinted cells.');
	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(status).toContainText('draw lines there');
	expect(await spotlight.count()).toBeGreaterThan(0);

	// Drawing the first highlighted line clears the hint; the next one is another step.
	const edge = (await spotlight.first().boundingBox())!;
	await page.mouse.click(edge.x + edge.width / 2, edge.y + edge.height / 2);
	await expect(spotlight).toHaveCount(0);
	await page.keyboard.press('h');
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

test('turning hints off mid-game hides the hint, and sharing tells how many were used', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
		// Catch what "Share success" would hand to the messenger.
		Object.defineProperty(navigator, 'share', {
			value: async (data: ShareData) => {
				(window as unknown as { shared: ShareData }).shared = data;
			}
		});
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	const spotlight = board.locator('g.spotlight > *');
	// Where to look, then the step: one hint.
	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(page.getByRole('button', { name: 'Show the step' })).toBeVisible();
	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(spotlight).toHaveCount(2);

	await page.getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('checkbox', { name: 'Hide the hint button' }).check();
	await page.keyboard.press('Escape');
	await expect(spotlight).toHaveCount(0);
	await expect(board.locator('g.area > *')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Hint' })).toHaveCount(0);

	// Solve it: the hint still counts.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 6;
	for (const [i, c] of [...SOLUTION].entries()) {
		if (c !== '1') continue;
		await page.mouse.click(
			grid.x + ((i % 6) + 0.5) * cell,
			grid.y + (Math.floor(i / 6) + 0.5) * cell
		);
	}
	await page.getByRole('button', { name: 'Share success' }).click();
	const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared);
	expect(shared.text).toContain(', with 1 hint. Can you do it without?');
});

test('painting wrong digits red counts as a hint, and the settings say so', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:sudoku', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
		Object.defineProperty(navigator, 'share', {
			value: async (data: ShareData) => {
				(window as unknown as { shared: ShareData }).shared = data;
			}
		});
	});
	// Calcudoku 5×5 Easy #513322150 from the bundled collection, and its only solution.
	await page.goto('/sudoku?v=c5e&id=513322150');
	const solution = '1254321354452315341234125';
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	await expect(board.locator('g.cages text').first()).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Settings' }).click();
	const setting = page.getByRole('checkbox', { name: 'Paint wrong digits red' });
	await expect(setting).toHaveAccessibleDescription(/^Counts as a hint/);
	// Other settings carry no such note.
	await expect(
		page.getByRole('checkbox', { name: 'Highlight errors' })
	).toHaveAccessibleDescription('');
	await setting.check();
	await page.keyboard.press('Escape');

	const box = (await board.boundingBox())!;
	const cell = (box.width - 6) / 5;
	for (const [i, d] of [...solution].entries()) {
		await page.mouse.click(
			box.x + 3 + ((i % 5) + 0.5) * cell,
			box.y + 3 + (Math.floor(i / 5) + 0.5) * cell
		);
		await page.keyboard.press(d);
	}
	await page.getByRole('button', { name: 'Share success' }).click();
	const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared);
	expect(shared.text).toContain(', with 1 hint. Can you do it without?');
});
