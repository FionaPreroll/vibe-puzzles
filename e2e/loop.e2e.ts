import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { edgeKey, type LoopPuzzle } from '../src/lib/games/loop/rules';
import { solveLoop } from '../src/lib/games/loop/solver';

// The first 5×5 Normal puzzle of the bundled collection, and its loop.
const { id, puzzle } = JSON.parse(readFileSync('static/puzzles/loop/5n/0000.json', 'utf8'))
	.puzzles[0] as { id: number; puzzle: LoopPuzzle };
const solution = [...solveLoop(puzzle).solutions[0]].flatMap((v, e) =>
	v === 1 ? [edgeKey(puzzle, e)] : []
);

test('Loop is marked as early access on the home page and in its menu', async ({ page }) => {
	await page.goto('/');
	const card = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('heading', { name: 'Loop' }) });
	await expect(card.getByText('Early access')).toBeVisible();
	// Its daily puzzle is not out yet.
	await expect(card.getByText('Daily puzzle waiting')).toHaveCount(0);
	await expect(card.getByRole('link', { name: 'Play' })).toBeVisible();
	await page.goto('/loop');
	await expect(page.getByRole('heading', { name: /Loop/ }).getByText('Early access')).toBeVisible();
});

test('announced types are greyed out, and a link to one opens 5×5 Normal', async ({ page }) => {
	await page.goto('/loop?v=7n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await expect(page).toHaveURL(/v=5n/);
	await expect(page.getByRole('button', { name: '5×5 Normal', exact: true })).toBeEnabled();
	await expect(page.getByRole('button', { name: '7×7 Normal: coming soon' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Daily: coming soon' })).toBeDisabled();
});

test('a collection puzzle is solved by drawing its loop', async ({ page }) => {
	await page.goto(`/loop?v=5n&id=${id}`);
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	// The first rect is the 5×5 grid itself, inside the board's padding.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 5;
	for (const key of solution) {
		const [kind, i, j] = key.split(':');
		const [x, y] = kind === 'h' ? [Number(j) + 0.5, Number(i)] : [Number(j), Number(i) + 0.5];
		await page.mouse.click(grid.x + x * cell, grid.y + y * cell);
	}
	await expect(board.locator('[data-line]')).toHaveCount(solution.length);
	await expect(page.getByText(/Solved in/).first()).toBeVisible();
});
