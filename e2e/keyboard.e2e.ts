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
	const board = page.getByRole('grid', { name: 'Puzzle board' });

	// A note in the first empty cell, found with the arrow keys.
	await page.keyboard.press('ArrowRight');
	const notes = board.locator('g.notes');
	for (let k = 0; k < 81 && !(await notes.count()); k++) {
		await page.keyboard.press('Shift+Digit1');
		if (!(await notes.count())) await page.keyboard.press('ArrowRight');
	}
	await expect(notes).toHaveCount(1);

	// Shift+0 is "=" there, which is also the new puzzle shortcut.
	await page.evaluate(() => {
		const init = { key: '=', code: 'Digit0', shiftKey: true, bubbles: true, cancelable: true };
		document.body.dispatchEvent(new KeyboardEvent('keydown', init));
	});
	await expect(notes).toHaveCount(0);
	await expect(page.getByRole('dialog')).toBeHidden();
	await expect(id).toHaveText(before!);
});
