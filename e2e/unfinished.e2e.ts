import { expect, test, type Page } from '@playwright/test';

/** Every puzzle type keeps one game; nothing may replace a started one without asking. */

const PUZZLE = '/tetroid?v=6n&id=496678832';
const OTHER = 496678848; // another 6×6 Normal puzzle

const puzzleId = (page: Page) => page.locator('.font-mono.select-all');

/** Whether the saved 6×6 game has any shaded cell. */
const savedProgress = (page: Page) =>
	page.evaluate(() => {
		const saved = JSON.parse(localStorage.getItem('vp:save:tetroid:6n') ?? 'null');
		return !!saved?.state.marks.some((m: number) => m !== 0);
	});

async function shadeFirstCell(page: Page) {
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	const box = (await board.boundingBox())!;
	await page.mouse.click(box.x + box.width / 12, box.y + box.height / 12);
	await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
}

/** Answer the confirmation in the app's dialog; returns its text. */
async function answerDialog(page: Page, accept: boolean): Promise<string> {
	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toBeVisible({ timeout: 30_000 });
	const text = (await dialog.textContent()) ?? '';
	// The safe choice has the focus.
	await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
	// The buttons: Close (✕), Cancel and the action.
	await (
		accept ? dialog.getByRole('button').last() : dialog.getByRole('button', { name: 'Cancel' })
	).click();
	await expect(dialog).toBeHidden();
	return text;
}

test.beforeEach(({ page }) => {
	// The app asks in its own dialog, never with the browser's.
	page.on('dialog', (dialog) => {
		throw new Error(`unexpected browser dialog: ${dialog.message()}`);
	});
});

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:tutorialSeen:sudoku', 'true');
	});
});

test('"New puzzle" asks before it throws a started game away', async ({ page }) => {
	await page.goto(PUZZLE);
	await expect(puzzleId(page)).toHaveText('496,678,832', { timeout: 30_000 });
	await shadeFirstCell(page);

	await page.getByRole('button', { name: 'New puzzle' }).click();
	expect(await answerDialog(page, false)).toContain('unfinished game');
	await expect(puzzleId(page)).toHaveText('496,678,832');
	expect(await savedProgress(page)).toBe(true);

	// The keyboard shortcut asks too.
	await page.keyboard.press('+');
	await answerDialog(page, true);
	await expect(puzzleId(page)).not.toHaveText('496,678,832', { timeout: 30_000 });
});

test('a link to another puzzle asks before it replaces a started game', async ({ page }) => {
	await page.goto(PUZZLE);
	await expect(puzzleId(page)).toHaveText('496,678,832', { timeout: 30_000 });
	await shadeFirstCell(page);

	await page.goto(`/tetroid?id=${OTHER}`);
	expect(await answerDialog(page, false)).toContain('replaces your unfinished game');
	// Declined: the started game continues.
	await expect(puzzleId(page)).toHaveText('496,678,832', { timeout: 30_000 });
	expect(await savedProgress(page)).toBe(true);

	// Opening it by ID asks as well; accepted, the other puzzle opens.
	await page.getByRole('textbox', { name: 'Open puzzle by ID' }).fill(String(OTHER));
	await page.getByRole('button', { name: 'Open', exact: true }).click();
	await answerDialog(page, true);
	await expect(puzzleId(page)).toHaveText(OTHER.toLocaleString('en-US'), { timeout: 30_000 });
});

test('Shift+0 on a German keyboard ("=") erases in Sudoku and keeps the game', async ({ page }) => {
	await page.goto('/sudoku?v=9n');
	await expect(puzzleId(page)).toBeVisible({ timeout: 30_000 });
	const id = await puzzleId(page).textContent();

	// Put a digit into the first empty cell.
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	const text = async () => (await board.locator('text').allTextContents()).join('');
	await expect(board.locator('text').first()).toBeVisible();
	const before = await text();
	const box = (await board.boundingBox())!;
	const cell = (box.width - 6) / 9;
	await page.mouse.click(box.x + 3 + cell / 2, box.y + 3 + cell / 2);
	for (let k = 0; k < 81 && (await text()) === before; k++) {
		await page.keyboard.press('7');
		if ((await text()) === before) await page.keyboard.press('ArrowRight');
	}
	expect(await text()).not.toBe(before);

	// What a German keyboard sends for Shift+0.
	await page.evaluate(() =>
		document.body.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: '=',
				code: 'Digit0',
				shiftKey: true,
				bubbles: true,
				cancelable: true
			})
		)
	);
	await expect.poll(text).toBe(before);
	await page.waitForTimeout(500);
	await expect(puzzleId(page)).toHaveText(id!);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
