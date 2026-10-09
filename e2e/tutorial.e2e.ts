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

test('the home page links both Sudoku tutorials, and Calcudoku has its own', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'New here? Learn Calcudoku in a minute' }).click();
	await expect(page).toHaveURL(/\/sudoku\/tutorial\/calc$/);
	await expect(page.getByRole('heading', { name: 'Calcudoku tutorial' })).toBeVisible();
	const next = page.getByRole('button', { name: 'Next' });
	const pad = page.getByRole('toolbar', { name: 'Number pad' });
	const box = (await page.getByRole('grid', { name: 'Puzzle board' }).boundingBox())!;
	const cell = (box.width - 6) / 4;
	const enter = async (i: number, d: number) => {
		await page.mouse.click(
			box.x + 3 + ((i % 4) + 0.5) * cell,
			box.y + 3 + (Math.floor(i / 4) + 0.5) * cell
		);
		await pad.getByRole('button', { name: String(d), exact: true }).click();
	};

	await next.click();
	await next.click();
	// The single cell, then the "3−" cage.
	await expect(next).toBeDisabled();
	await enter(3, 4);
	await expect(page.getByText('Done: one cell, one digit.')).toBeVisible();
	await next.click();
	await enter(6, 4);
	await enter(7, 1);
	await expect(page.getByText(/the 1 goes on the right/)).toBeVisible();
	await next.click();
	// Notes for the "7+" cage.
	await expect(next).toBeDisabled();
	await page.getByRole('button', { name: 'Note' }).click();
	for (const i of [8, 9]) for (const d of [3, 4]) await enter(i, d);
	await expect(page.getByText('Good: the order will come out later.')).toBeVisible();
	await next.click();

	// The rest: 1234 / 2341 / 3412 / 4123.
	await page.getByRole('button', { name: 'Digit' }).click();
	const solution = [1, 2, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2, 4, 1, 2, 3];
	for (const i of [0, 1, 2, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15]) await enter(i, solution[i]);
	await expect(page.getByText('Well done!')).toBeVisible();
	await page.getByRole('link', { name: 'Play a real puzzle' }).click();
	await expect(page).toHaveURL(/\/sudoku\?v=c5e$/);

	// The solved Calcudoku tutorial leaves the home page; the Sudoku one stays.
	await page.goto('/');
	await expect(
		page.getByRole('link', { name: 'New here? Learn Sudoku in a minute' })
	).toBeVisible();
	await expect(page.getByRole('link', { name: /Learn Calcudoku/ })).toHaveCount(0);
});

test('a Calcudoku game links the Calcudoku tutorial', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:sudoku', 'true'));
	await page.goto('/sudoku?v=c5e');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole('link', { name: 'Tutorial', exact: true }).first()).toHaveAttribute(
		'href',
		/\/sudoku\/tutorial\/calc$/
	);
});

test('the Sudoku tutorial finds the missing digit in a row, a box and a column', async ({
	page
}) => {
	await page.goto('/sudoku/tutorial');
	const next = page.getByRole('button', { name: 'Next' });
	const pad = page.getByRole('toolbar', { name: 'Number pad' });
	const box = (await page.getByRole('grid', { name: 'Puzzle board' }).boundingBox())!;
	const cell = (box.width - 6) / 4;
	const enter = async (i: number, d: number) => {
		await page.mouse.click(
			box.x + 3 + ((i % 4) + 0.5) * cell,
			box.y + 3 + (Math.floor(i / 4) + 0.5) * cell
		);
		await pad.getByRole('button', { name: String(d), exact: true }).click();
	};

	await expect(page.getByText('Step 1 of 5')).toBeVisible();
	await next.click();
	// Row, box, column: each waits for its digit.
	for (const [i, d, done] of [
		[2, 3, /Right: a 3/],
		[4, 3, /the box needed its 3/],
		[8, 2, /find the one missing digit/]
	] as const) {
		await expect(next).toBeDisabled();
		await enter(i, d);
		await expect(page.getByText(done)).toBeVisible();
		await next.click();
	}
	await expect(page.getByText('Step 5 of 5')).toBeVisible();
	for (const [i, d] of [
		[7, 2],
		[11, 3],
		[13, 3]
	]) {
		await enter(i, d);
	}
	await expect(page.getByText('Well done!')).toBeVisible();
});
