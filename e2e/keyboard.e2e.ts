import { expect, test, type Page } from '@playwright/test';

/** The marks of the saved Tetroid game of type `variant`, one per cell. */
async function marks(page: Page, variant: string): Promise<number[]> {
	return page.evaluate((key) => {
		const save = JSON.parse(localStorage.getItem(key) ?? 'null');
		return save ? save.state.marks : [];
	}, `vp:save:tetroid:${variant}`);
}

test('the board gets each key first, the shortcuts only the ones it leaves', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
	await page.goto('/tetroid?v=6n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	// Keys are handled once the page has hydrated and the puzzle is in.
	await page.waitForLoadState('networkidle');

	// The first arrow puts the cursor on the top-left cell, Space shades it.
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Space');
	await expect.poll(async () => (await marks(page, '6n'))[0]).toBe(1);
	// The board leaves "z" to the page: undo.
	await page.keyboard.press('z');
	await expect.poll(async () => (await marks(page, '6n'))[0]).toBe(0);

	// While a dialog is open, the cursor stays put.
	await page.keyboard.press('?');
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await page.keyboard.press('Space');
	await expect.poll(async () => (await marks(page, '6n'))[0]).toBe(1);
	expect((await marks(page, '6n')).filter(Boolean)).toHaveLength(1);
});

test('Shift+0 on a German keyboard erases a Sudoku cell and nothing else', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:sudoku', 'true'));
	await page.goto('/sudoku?v=9n');
	const id = page.getByText(/Puzzle ID/i).first();
	await expect(id).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const before = await id.textContent();
	const board = page.getByRole('application', { name: 'Puzzle board' });

	// A note in the first empty cell, found with the arrow keys.
	await page.keyboard.press('ArrowRight');
	const notes = board.locator('g.notes');
	for (let k = 0; k < 81 && !(await notes.count()); k++) {
		await page.keyboard.press('Shift+Digit1');
		if (!(await notes.count())) await page.keyboard.press('ArrowRight');
	}
	await expect(notes).toHaveCount(1);
	await expect(page.getByTestId('board-speech')).toHaveText(/^Row 1, column \d: notes 1$/);

	// Shift+0 is "=" there, which is also the new puzzle shortcut.
	await page.evaluate(() => {
		const init = { key: '=', code: 'Digit0', shiftKey: true, bubbles: true, cancelable: true };
		document.body.dispatchEvent(new KeyboardEvent('keydown', init));
	});
	await expect(notes).toHaveCount(0);
	await expect(page.getByRole('dialog')).toBeHidden();
	await expect(id).toHaveText(before!);
});

test('Ctrl or Shift alone leaves the Tetroid cell at the cursor as it is', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
	await page.goto('/tetroid?v=6n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');

	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Space');
	await expect.poll(async () => (await marks(page, '6n'))[0]).toBe(1);
	// Shift held to see the group under the mouse, or Ctrl held for a click: no move at the cursor.
	await page.keyboard.press('Shift');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Control');
	// A move further down saves the board.
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Space');
	await expect.poll(async () => (await marks(page, '6n'))[12]).toBe(1);
	expect((await marks(page, '6n')).slice(0, 7)).toEqual([1, 0, 0, 0, 0, 0, 0]);

	// With the arrows, Shift sets crosses and Ctrl shades, from the cell the cursor leaves.
	await page.keyboard.down('Shift');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.up('Shift');
	await expect.poll(async () => (await marks(page, '6n')).slice(12, 14)).toEqual([2, 2]);
	await page.keyboard.down('Control');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.up('Control');
	await expect.poll(async () => (await marks(page, '6n')).slice(12, 16)).toEqual([2, 1, 1, 1]);
});

test('Ctrl with the arrows draws Loop and Pinwheel lines from the dot the cursor leaves', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:loop', 'true');
		localStorage.setItem('vp:tutorialSeen:pinwheel', 'true');
	});
	// In this Pinwheel, the edges below the top row of cells may take lines.
	for (const path of ['/loop?v=5n', '/pinwheel?v=7n&id=1027244002']) {
		await page.goto(path);
		await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
		await page.waitForLoadState('networkidle');
		const board = page.getByRole('application', { name: 'Puzzle board' });
		const line = (key: string) => board.locator(`[data-line="${key}"]`);

		// The cursor shows on the top-left dot and goes down one; with Ctrl held, right along the
		// dots. The lines show at once and stay when Ctrl goes up.
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('ArrowDown');
		await page.keyboard.down('Control');
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await expect(line('h:1:1')).toHaveCount(1);
		await page.keyboard.up('Control');
		await expect(line('h:1:0')).toHaveCount(1);
		await expect(line('h:1:1')).toHaveCount(1);
		// A screen reader says where the cursor is, and the lines there.
		await expect(page.getByTestId('board-speech')).toHaveText(
			/^Dot in row 2, column 3\. Lines: left(\. |$)/
		);

		// Escape drops the move under way.
		await page.keyboard.down('Control');
		await page.keyboard.press('ArrowRight');
		await expect(line('h:1:2')).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(line('h:1:2')).toHaveCount(0);
		await page.keyboard.up('Control');
		await expect(line('h:1:2')).toHaveCount(0);
		await expect(line('h:1:1')).toHaveCount(1);
	}
});

test('switching to another window while drawing with the keys drops the move', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:loop', 'true'));
	await page.goto('/loop?v=5n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const lines = page.getByRole('application', { name: 'Puzzle board' }).locator('[data-line]');

	await page.keyboard.press('ArrowRight');
	await page.keyboard.down('Control');
	await page.keyboard.press('ArrowRight');
	await expect(lines).toHaveCount(1);
	// Another window takes the focus while Ctrl is down: the line goes.
	await page.evaluate(() => window.dispatchEvent(new Event('blur')));
	await expect(lines).toHaveCount(0);
	// Neither letting go of Ctrl nor pressing it again draws it.
	await page.keyboard.up('Control');
	await page.keyboard.press('Control');
	await expect(lines).toHaveCount(0);

	// The cursor stays, and draws again.
	await page.keyboard.down('Control');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.up('Control');
	await expect(lines).toHaveCount(1);
	await expect(lines).toHaveAttribute('data-line', 'v:0:1');
});
