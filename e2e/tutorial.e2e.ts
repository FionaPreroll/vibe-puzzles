import { expect, test, type Page } from '@playwright/test';

/** Clicks the middle of an edge of the 5×5 tutorial board (padding: a fifth of a cell). */
async function clickEdge(page: Page, kind: 'h' | 'v', i: number, j: number) {
	const box = (await page.getByRole('grid', { name: 'Puzzle board' }).boundingBox())!;
	const cell = box.width / 5.4;
	const [r, c] = kind === 'h' ? [i, j + 0.5] : [i + 0.5, j];
	await page.mouse.click(box.x + (0.2 + c) * cell, box.y + (0.2 + r) * cell);
}

test('the Pinwheel tutorial separates reading from tasks on the board', async ({ page }) => {
	await page.goto('/pinwheel/tutorial');
	const next = page.getByRole('button', { name: 'Next' });

	// Steps 1 and 2 are only read: no task, and Next works right away.
	await expect(page.getByText('Step 1 of 7')).toBeVisible();
	await expect(page.getByText('Your turn')).toHaveCount(0);
	await expect(page.getByText('Try it on the board.')).toHaveCount(0);
	await next.click();
	await next.click();

	// Step 3 is a task: Next waits until the top-left cell is closed off.
	await expect(page.getByText('Step 3 of 7')).toBeVisible();
	await expect(page.getByText('Your turn')).toBeVisible();
	await expect(next).toBeDisabled();
	await clickEdge(page, 'v', 0, 1);
	await expect(next).toBeDisabled();
	await clickEdge(page, 'h', 1, 0);
	await expect(page.getByText('Done: one circle, one region.')).toBeVisible();
	await next.click();

	// "Show me" does the next three tasks.
	for (const n of [4, 5, 6]) {
		await expect(page.getByText(`Step ${n} of 7`)).toBeVisible();
		await expect(next).toBeDisabled();
		await page.getByRole('button', { name: 'Show me' }).click();
		await expect(page.getByRole('button', { name: 'Show me' })).toHaveCount(0);
		await next.click();
	}

	// The last step: the player finishes the board alone.
	await expect(page.getByText('Step 7 of 7')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Show me' })).toHaveCount(0);
	for (const [kind, i, j] of [
		['h', 3, 0],
		['h', 4, 1],
		['h', 4, 2],
		['h', 4, 4],
		['v', 3, 1],
		['v', 3, 2],
		['v', 3, 4],
		['v', 4, 1],
		['v', 4, 3]
	] as const) {
		await clickEdge(page, kind, i, j);
	}
	await expect(page.getByText('Well done!')).toBeVisible();
});

test('the Tetroid tutorial teaches one rule per step', async ({ page }) => {
	await page.goto('/tetroid/tutorial');
	const next = page.getByRole('button', { name: 'Next' });
	const box = (await page.getByRole('grid', { name: 'Puzzle board' }).boundingBox())!;
	// 3 px padding around a 5×5 grid.
	const cell = (box.width - 6) / 5;
	const click = (i: number) =>
		page.mouse.click(
			box.x + 3 + ((i % 5) + 0.5) * cell,
			box.y + 3 + (Math.floor(i / 5) + 0.5) * cell
		);

	await expect(page.getByText('Step 1 of 5')).toBeVisible();
	await expect(page.getByText('Your turn')).toHaveCount(0);
	await next.click();

	// The four cells of the top-right region.
	await expect(next).toBeDisabled();
	for (const i of [2, 3, 4, 7]) await click(i);
	await expect(page.getByText('Done: that tetromino is an L.')).toBeVisible();
	await next.click();

	// Two crosses where a 2×2 block would be completed.
	await expect(next).toBeDisabled();
	await page.getByRole('button', { name: 'Cross' }).click();
	for (const i of [8, 10]) await click(i);
	await expect(page.getByText(/these cells stay empty/)).toBeVisible();
	await next.click();

	// Read only, then the free finish: an S on the right and an I at the bottom.
	await next.click();
	await expect(page.getByText('Step 5 of 5')).toBeVisible();
	await page.getByRole('button', { name: 'Black' }).click();
	for (const i of [9, 13, 14, 18, 20, 21, 22, 23]) await click(i);
	await expect(page.getByText('Well done!')).toBeVisible();
});
