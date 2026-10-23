import { expect, test, type Page } from '@playwright/test';
import { solveTetroid } from '../src/lib/games/tetroid/solver';
import type { TetroidPuzzle } from '../src/lib/games/tetroid/rules';

/** Solve the current Tetroid special puzzle of `kind` on the board, as a player would. */
async function solveSpecial(page: Page, kind = 'daily', size = 10) {
	const board = page.getByRole('application', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const puzzle = await page.evaluate((kind) => {
		const key = Object.keys(localStorage).find((k) => k.startsWith(`vp:save:tetroid:${kind}:2`))!;
		return JSON.parse(localStorage.getItem(key)!).puzzle;
	}, kind);
	const [solution] = solveTetroid(puzzle as TetroidPuzzle, { limit: 1 }).solutions;
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / size;
	const cells = [...solution].flatMap((shaded, i) => (shaded ? [i] : []));
	for (const i of cells) {
		await page.mouse.click(
			grid.x + ((i % size) + 0.5) * cell,
			grid.y + (Math.floor(i / size) + 0.5) * cell
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
	await solveSpecial(page);
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
	await expect(page.getByRole('application', { name: 'Puzzle board' })).toBeVisible({
		timeout: 30_000
	});
	await more.click();
	await expect(page.getByRole('button', { name: 'Start over' })).toBeVisible();
});

for (const [kind, size] of [
	['daily', 10],
	['weekly', 15],
	['monthly', 20]
] as const) {
	test(`the menu ticks the ${kind} puzzle as soon as it is solved`, async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto(`/tetroid?v=${kind}`);
		const label = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[kind];
		const button = page
			.getByRole('navigation', { name: 'Puzzle type' })
			.getByRole('button', { name: label, exact: true });
		await expect(button).toHaveAttribute('aria-current', 'true', { timeout: 30_000 });
		await expect(button).not.toContainText('✓');
		await solveSpecial(page, kind, size);
		// Without a reload.
		await expect(button).toContainText('✓');
	});
}
