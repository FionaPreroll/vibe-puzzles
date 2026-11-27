import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { FILLED, type PixelsPuzzle } from '../src/lib/games/pixels/rules';
import { solvePixels } from '../src/lib/games/pixels/solver';

// The first 5×5 Normal puzzle of the bundled collection.
const bank = JSON.parse(readFileSync('static/puzzles/pixels/5n/0000.json', 'utf8')).puzzles as {
	id: number;
	puzzle: PixelsPuzzle;
}[];
const { id, puzzle } = bank[0];
const W = puzzle.width;
const [solution] = solvePixels(puzzle, 1).solutions;
const filled = Array.from(solution.keys()).filter((c) => solution[c] === FILLED);

async function open(page: Page) {
	await page.addInitScript(() => localStorage.setItem('vp:puzzleSource', '"bank"'));
	await page.goto(`/pixels?v=5n&id=${id}`);
	const board = page.getByRole('application', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	// The first rect is the grid, right of the rows' numbers and below the columns' numbers.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / W;
	const at = (c: number) =>
		[grid.x + ((c % W) + 0.5) * cell, grid.y + (Math.floor(c / W) + 0.5) * cell] as const;
	return {
		board,
		at,
		click: (c: number, options?: { button: 'right' }) => page.mouse.click(...at(c), options),
		drag: async (from: number, to: number) => {
			await page.mouse.move(...at(from));
			await page.mouse.down();
			await page.mouse.move(...at(to), { steps: 10 });
			await page.mouse.up();
		},
		fill: (c: number) => board.locator(`[data-filled="${c}"]`),
		cross: (c: number) => board.locator(`[data-cross="${c}"]`)
	};
}

test('Pixels is listed in early access, with its daily puzzle and no tutorial', async ({
	page
}) => {
	await page.goto('/');
	const card = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('heading', { name: 'Pixels' }) });
	await expect(card.getByText('Early access')).toBeVisible();
	await expect(card.getByRole('link', { name: 'Learn Pixels' })).toHaveCount(0);
	await expect(card.getByRole('link', { name: /Daily puzzle/ })).toBeVisible();
});

test('every size is playable: a link to 25×25 Hard opens it', async ({ page }) => {
	await page.goto('/pixels?v=25h');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await expect(page).toHaveURL(/v=25h/);
	await expect(page.getByRole('application', { name: 'Puzzle board' })).toBeVisible();
	for (const name of ['5×5 Normal', '15×15 Hard', '20×20 Normal', '25×25 Hard', 'Monthly 25×25']) {
		await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
	}
	await expect(page.getByRole('button', { name: /Soon$/ })).toHaveCount(0);
});

test(
	'a collection puzzle is solved by filling its picture',
	{ tag: '@webkit' },
	async ({ page }) => {
		const { board, click } = await open(page);
		await expect(page.getByText('Early access').first()).toBeVisible();
		for (const c of filled) await click(c);
		await expect(board.locator('[data-filled]')).toHaveCount(filled.length);
		await expect(page.getByText(/Solved in/).first()).toBeVisible();
	}
);

test('a click fills a cell and clears it; the right button crosses it out', async ({ page }) => {
	const { fill, cross, click } = await open(page);
	await click(0);
	await expect(fill(0)).toHaveCount(1);
	await click(0);
	await expect(fill(0)).toHaveCount(0);

	// The right button crosses instead of opening the browser's menu.
	await page.evaluate(() =>
		window.addEventListener('contextmenu', (e) => {
			(window as unknown as { menu: boolean }).menu = !e.defaultPrevented;
		})
	);
	await click(0, { button: 'right' });
	await expect(cross(0)).toHaveCount(1);
	expect(await page.evaluate(() => (window as unknown as { menu: boolean }).menu)).toBe(false);
	// A click on the cross fills the cell.
	await click(0);
	await expect(cross(0)).toHaveCount(0);
	await expect(fill(0)).toHaveCount(1);

	const undo = page.getByRole('button', { name: 'Undo' }).filter({ visible: true });
	await undo.click();
	await expect(cross(0)).toHaveCount(1);
});

test('a drag along a row fills the cells on the way and leaves crosses alone', async ({ page }) => {
	const { board, fill, cross, click, drag } = await open(page);
	await click(2, { button: 'right' });
	await drag(0, 4);
	for (const c of [0, 1, 3, 4]) await expect(fill(c)).toHaveCount(1);
	await expect(cross(2)).toHaveCount(1);
	// It runs along the row it started in, even when the pointer strays a little.
	await drag(W + 4, 2 * W + 1);
	await expect(board.locator('[data-filled]')).toHaveCount(4 + 4);
	// From a filled cell, a drag clears the filled ones.
	await drag(4, 0);
	await expect(board.locator('[data-filled]')).toHaveCount(4);
	await expect(cross(2)).toHaveCount(1);
});

test('the keys fill and cross out cells under the cursor', async ({ page }) => {
	const { board, fill, cross } = await open(page);
	const speech = page.getByTestId('board-speech');
	const clue = (n: number[]) => n.join(' ') || '0';
	await board.focus();
	// The first arrow shows the cursor on the first cell.
	await page.keyboard.press('ArrowRight');
	await expect(speech).toHaveText(
		`Row 1, column 1: empty. Row: ${clue(puzzle.rows[0])}. Column: ${clue(puzzle.cols[0])}`
	);
	await page.keyboard.press('Space');
	await expect(fill(0)).toHaveCount(1);
	await expect(speech).toContainText('Row 1, column 1: filled.');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Shift+Space');
	await expect(cross(1)).toHaveCount(1);
	await expect(speech).toContainText('Row 1, column 2: crossed out.');

	// One row down, Ctrl with the arrows fills the cells on the way when it is let go.
	await page.keyboard.press('ArrowDown');
	await page.keyboard.down('Control');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await expect(fill(W + 1)).toHaveCount(1);
	await page.keyboard.up('Control');
	for (const c of [W + 1, W + 2, W + 3]) await expect(fill(c)).toHaveCount(1);
});

test('the numbers of a line turn grey once its blocks are in place', async ({ page }) => {
	const { board, click } = await open(page);
	const row = puzzle.rows.findIndex((clue) => clue.length > 0);
	const number = board.locator(`[data-clue="r:${row}"]`).first();
	const ink = await number.getAttribute('fill');
	for (const c of filled.filter((c) => Math.floor(c / W) === row)) await click(c);
	await expect(number).not.toHaveAttribute('fill', ink!);
});

test('the hint tints where to look, then points at the cells', async ({ page }) => {
	const { board } = await open(page);
	const status = page.getByRole('status');
	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(status).toContainText(/Look at (row|column) \d/);
	expect(await board.locator('g.area > *').count()).toBeGreaterThan(0);
	await page.getByRole('button', { name: 'Show the step' }).click();
	await expect(status).toContainText(/So (fill|the highlighted)/);
	expect(await board.locator('g.spotlight > *').count()).toBeGreaterThan(0);
});
