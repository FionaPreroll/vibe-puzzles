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

test('Loop has its daily puzzle on the home page, and no early-access badge', async ({ page }) => {
	await page.goto('/');
	const card = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('heading', { name: 'Loop' }) });
	await expect(card.getByRole('link', { name: /Daily puzzle waiting/ })).toBeVisible();
	await expect(card.getByRole('link', { name: 'Play' })).toBeVisible();
	await expect(card.getByText('Early access')).toHaveCount(0);
});

test('every size is playable: a link to 10×10 opens it', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:loop', 'true'));
	await page.goto('/loop?v=10n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await expect(page).toHaveURL(/v=10n/);
	await expect(page.getByRole('application', { name: 'Puzzle board' })).toBeVisible();
	for (const name of ['10×10 Normal', '15×15 Hard', '20×20 Normal', '25×30 Hard']) {
		await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
	}
	await expect(page.getByRole('button', { name: /coming soon/ })).toHaveCount(0);
});

test('a collection puzzle is solved by drawing its loop', { tag: '@webkit' }, async ({ page }) => {
	await page.goto(`/loop?v=5n&id=${id}`);
	const board = page.getByRole('application', { name: 'Puzzle board' });
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

test('the hint tints where to look first, then highlights the edges that follow', async ({
	page
}) => {
	await page.goto(`/loop?v=5n&id=${id}`);
	const board = page.getByRole('application', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	const spotlight = board.locator('g.spotlight > *');
	const area = board.locator('g.area > *');
	await page.getByRole('button', { name: 'Hint', exact: true }).click();
	await expect(page.getByRole('status')).not.toBeEmpty();
	await expect(spotlight).toHaveCount(0);
	expect(await area.count()).toBeGreaterThan(0);
	await page.getByRole('button', { name: 'Show the step' }).click();
	expect(await spotlight.count()).toBeGreaterThan(0);
	// Lines first: the step draws a line, even on an empty board.
	await expect(page.getByRole('status')).toContainText(/draw (the lines?|them)/i);
});
