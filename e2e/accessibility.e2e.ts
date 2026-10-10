import { expect, test, type Page } from '@playwright/test';

/** Dialogs, messages, menus and touch targets (issue #44). */

const PUZZLE = '/tetroid?v=6n&id=496678832';

test.beforeEach(async ({ page }) => {
	page.on('dialog', (dialog) => {
		throw new Error(`unexpected browser dialog: ${dialog.message()}`);
	});
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem(
			'vp:settings:tetroid',
			// Without automatic submitting, so "Done" is there to check an unsolved board.
			JSON.stringify({ values: { showCheckpoints: true, autoSubmit: false }, updatedAt: 1 })
		);
	});
});

async function openPuzzle(page: Page) {
	await page.goto(PUZZLE);
	await expect(page.locator('.font-mono.select-all')).toHaveText('496,678,832', {
		timeout: 30_000
	});
}

test('deleting a checkpoint asks first, with the × and with a right click', async ({ page }) => {
	await openPuzzle(page);
	const checkpoints = page.getByRole('group', { name: 'Checkpoints' });
	await checkpoints.getByRole('button', { name: 'Save' }).click();
	const first = checkpoints.getByRole('button', { name: '1', exact: true });
	await expect(first).toBeVisible();
	const dialog = page.getByRole('alertdialog', { name: 'Delete checkpoint 1?' });

	await first.click({ button: 'right' });
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(first).toBeVisible();

	await checkpoints.getByRole('button', { name: 'Delete checkpoint 1' }).click();
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(first).toBeHidden();
});

test('a question asked right after an answer stays open', async ({ page }) => {
	await openPuzzle(page);
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	const box = (await board.boundingBox())!;
	await page.mouse.click(box.x + box.width / 12, box.y + box.height / 12);
	await page.getByRole('button', { name: 'New puzzle' }).click();
	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toBeVisible();
	// Cancel, then "+" before the browser has reported the dialog closed.
	await page.evaluate(() => {
		document.querySelector<HTMLElement>('[role=alertdialog] .btn')!.click();
		setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' })));
	});
	await page.waitForTimeout(500);
	await expect(dialog).toBeVisible();
});

test('"?" lists the keyboard shortcuts', async ({ page }) => {
	await openPuzzle(page);
	await page.keyboard.press('?');
	const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('New puzzle')).toBeVisible();
	// The tools with their keys.
	await expect(dialog.getByText('Cycle')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	// Also from the rules.
	await page.getByRole('button', { name: 'Keyboard shortcuts (?)' }).click();
	await expect(dialog).toBeVisible();
});

test('the home page shows when the next daily puzzle comes', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText(/^New daily puzzle in \d+( h \d\d)? min, at /).first()).toBeVisible();
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('an error stays until it is tapped away', async ({ page }) => {
		await openPuzzle(page);
		// The live region is there before any message.
		const live = page.getByRole('status');
		await expect(live).toHaveCount(1);
		await expect(live).toHaveText('');

		await page.getByRole('button', { name: 'Done' }).click();
		await expect(live).toHaveText('Not solved yet. Keep going!');
		const toast = page.getByRole('button', { name: /^Not solved yet/ });
		await expect(toast).toBeVisible();
		await page.waitForTimeout(5000);
		await expect(toast).toBeVisible();
		await toast.tap();
		await expect(toast).toBeHidden();
	});

	test('the drawer keeps the focus and gives it back', async ({ page }) => {
		await openPuzzle(page);
		const opener = page.getByRole('button', { name: 'Puzzle types and rules' });
		await opener.click();
		const drawer = page.getByRole('complementary', { name: 'Tetroid menu' });
		await expect(drawer.getByRole('button', { name: 'Close menu' })).toBeFocused();
		// Shift+Tab from the first control goes round to the last one in the drawer.
		await page.keyboard.press('Shift+Tab');
		await expect(drawer.getByRole('link').last()).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(drawer).toBeHidden();
		await expect(opener).toBeFocused();
	});

	test('touch targets are large enough', async ({ page }) => {
		await openPuzzle(page);
		await page
			.getByRole('group', { name: 'Checkpoints' })
			.getByRole('button', { name: 'Save' })
			.click();
		for (const name of ['Delete checkpoint 1', 'Zoom']) {
			const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
			expect(box.width, name).toBeGreaterThanOrEqual(32);
			expect(box.height, name).toBeGreaterThanOrEqual(32);
		}
	});
});
