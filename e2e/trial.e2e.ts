import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { LoopPuzzle } from '../src/lib/games/loop/rules';

// The first 5×5 Normal Loop of the bundled collection: trials work the same in every game.
const { id } = JSON.parse(readFileSync('static/puzzles/loop/5n/0000.json', 'utf8')).puzzles[0] as {
	id: number;
	puzzle: LoopPuzzle;
};

async function open(page: Page) {
	await page.goto(`/loop?v=5n&id=${id}`);
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 5;
	/** Draw the line on top of cell (0, j). */
	const draw = (j: number) => page.mouse.click(grid.x + (j + 0.5) * cell, grid.y);
	return { board, draw };
}

test('a trial draws its lines in its own colour, until it is kept', async ({ page }) => {
	const { board, draw } = await open(page);
	await draw(0);
	await page.getByRole('button', { name: 'Try', exact: true }).click();
	const row = page.getByRole('group', { name: /Trial/ }).first();
	await expect(row).toBeVisible();
	await draw(1);
	await draw(2);
	await expect(board.locator('[data-line]')).toHaveCount(3);
	await expect(board.locator('[data-trial]')).toHaveCount(2);
	// It survives a reload.
	await page.reload();
	await expect(board.locator('[data-trial]')).toHaveCount(2, { timeout: 30_000 });
	await page.getByRole('button', { name: 'Keep', exact: true }).first().click();
	await expect(board.locator('[data-trial]')).toHaveCount(0);
	await expect(board.locator('[data-line]')).toHaveCount(3);
	await expect(row).toBeHidden();
});

test('discarding a trial goes back to where it began, also with the keyboard', async ({ page }) => {
	const { board, draw } = await open(page);
	await draw(0);
	await page.keyboard.press('t');
	await draw(1);
	await expect(board.locator('[data-trial]')).toHaveCount(1);
	await page.keyboard.press('Shift+T');
	await expect(board.locator('[data-line]')).toHaveCount(1);
	await expect(board.locator('[data-trial]')).toHaveCount(0);
	// The trial's line does not come back with undo.
	await page.getByRole('button', { name: 'Discard', exact: true }).waitFor({ state: 'detached' });
	await page.keyboard.press('z');
	await expect(board.locator('[data-line]')).toHaveCount(0);
});
