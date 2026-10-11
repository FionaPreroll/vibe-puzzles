import { expect, test, type Page } from '@playwright/test';
import { solveTetroid } from '../src/lib/games/tetroid/solver';
import type { TetroidPuzzle } from '../src/lib/games/tetroid/rules';

/** Solve today's Tetroid daily puzzle on the board, as a player would. */
async function solveDaily(page: Page) {
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const puzzle = await page.evaluate(() => {
		const key = Object.keys(localStorage).find((k) => k.startsWith('vp:save:tetroid:daily:2'))!;
		return JSON.parse(localStorage.getItem(key)!).puzzle;
	});
	const [solution] = solveTetroid(puzzle as TetroidPuzzle, { limit: 1 }).solutions;
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 10;
	const cells = [...solution].flatMap((shaded, i) => (shaded ? [i] : []));
	for (const i of cells) {
		await page.mouse.click(
			grid.x + ((i % 10) + 0.5) * cell,
			grid.y + (Math.floor(i / 10) + 0.5) * cell
		);
	}
	await expect(page.getByRole('button', { name: 'Share success' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
});

test('a solved daily puzzle stays solved: it opens solved and cannot start over', async ({
	page
}) => {
	await page.goto('/tetroid?v=daily');
	await solveDaily(page);
	const more = page.getByRole('button', { name: 'More actions' });
	await more.click();
	await expect(page.getByRole('button', { name: 'Share board' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0);
	await page.keyboard.press('Escape');

	// Back on another day's visit: still solved, with its time, not a fresh board.
	await page.reload();
	await expect(page.getByRole('button', { name: 'Share success' })).toBeVisible({
		timeout: 30_000
	});
	await expect(page.getByRole('button', { name: 'Undo' }).first()).toBeDisabled();
	await more.click();
	await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0);

	// Any other puzzle keeps it.
	await page.keyboard.press('Escape');
	await page.goto('/tetroid?v=6n');
	await expect(page.getByRole('grid', { name: 'Puzzle board' })).toBeVisible({ timeout: 30_000 });
	await more.click();
	await expect(page.getByRole('button', { name: 'Start over' })).toBeVisible();
});
