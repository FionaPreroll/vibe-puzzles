import { expect, test } from '@playwright/test';
import { colours as palette } from '../src/lib/core/palette';

// Pinwheel 7×7 Normal #1027244002 from the bundled bank and its solution lines, as 0/1 per
// horizontal edge (row-major, 8 rows of 7) and vertical edge (7 rows of 8).
const PUZZLE = '/pinwheel?v=7n&id=1027244002';
const H = '00000001111110000011100101110000011110111100000010000000';
const V = '00001110001111100011110000101100001011000111011001110110';

test('solving hides the dots inside the galaxies', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:pinwheel', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const dots = board.locator(`g[fill="${palette.dot}"] circle`);
	await expect(dots).toHaveCount(64);

	// The first rect is the 7×7 grid; a click on an edge draws its line.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 7;
	const edges = [
		...[...H].flatMap((c, k) => (c === '1' ? [[(k % 7) + 0.5, Math.floor(k / 7)]] : [])),
		...[...V].flatMap((c, k) => (c === '1' ? [[k % 8, Math.floor(k / 8) + 0.5]] : []))
	];
	for (const [x, y] of edges.slice(0, -1)) {
		await page.mouse.click(grid.x + x * cell, grid.y + y * cell);
	}
	// Not solved yet: every dot is still there.
	await expect(dots).toHaveCount(64);

	const [x, y] = edges[edges.length - 1];
	await page.mouse.click(grid.x + x * cell, grid.y + y * cell);
	await expect(page.getByRole('button', { name: 'Share success' })).toBeVisible();
	// Five dots lie inside galaxies with no line at them (three of them under centres).
	await expect(dots).toHaveCount(59);
});
