import { expect, test, type Page } from '@playwright/test';

/**
 * Two tabs of the same game share one save in local storage. Neither may roll the other's
 * progress back, and each shows what the other played.
 */

const PUZZLE = '/tetroid?v=6n&id=496678832';
const SLOT = 'vp:save:tetroid:6n';

const board = (page: Page) => page.getByRole('grid', { name: 'Puzzle board' });
const puzzleId = (page: Page) => page.locator('.font-mono.select-all');

/** Shaded cells of the saved game. */
const savedMarks = (page: Page) =>
	page.evaluate((slot) => {
		const saved = JSON.parse(localStorage.getItem(slot) ?? 'null');
		return (saved?.state.marks as number[] | undefined)?.filter((m) => m !== 0).length ?? 0;
	}, SLOT);

/** Click the cell in `row`, `col` of the 6×6 board. */
async function click(page: Page, row: number, col: number) {
	const box = (await board(page).boundingBox())!;
	await page.mouse.click(
		box.x + ((col + 0.5) * box.width) / 6,
		box.y + ((row + 0.5) * box.height) / 6
	);
}

/** The page is hidden and shown again, as when switching tabs. */
async function hideAndShow(page: Page, visible: boolean) {
	await page.evaluate((visible) => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => (visible ? 'visible' : 'hidden')
		});
		document.dispatchEvent(new Event('visibilitychange'));
	}, visible);
}

test.beforeEach(async ({ context }) => {
	await context.addInitScript(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
});

test('a second tab neither rolls back nor hides the progress of the first', async ({ context }) => {
	const a = await context.newPage();
	await a.goto(PUZZLE);
	await expect(puzzleId(a)).toHaveText('496,678,832', { timeout: 30_000 });
	const b = await context.newPage();
	await b.goto('/tetroid?v=6n');
	await expect(puzzleId(b)).toHaveText('496,678,832', { timeout: 30_000 });

	// Played in the first tab.
	await click(a, 0, 0);
	await click(a, 0, 1);
	await expect.poll(() => savedMarks(a)).toBe(2);

	// The second tab shows it, and leaving it (switching away, closing) keeps it.
	await expect(b.getByRole('status')).toHaveText('Continued your game from another tab.');
	await hideAndShow(b, false);
	await b.close({ runBeforeUnload: true });
	expect(await savedMarks(a)).toBe(2);

	// Played on in the second tab, the first follows.
	const c = await context.newPage();
	await c.goto('/tetroid?v=6n');
	await expect.poll(() => savedMarks(c)).toBe(2);
	await click(c, 1, 0);
	await expect.poll(() => savedMarks(c)).toBe(3);
	await hideAndShow(a, false);
	expect(await savedMarks(a)).toBe(3);
	await a.reload();
	await expect(puzzleId(a)).toHaveText('496,678,832', { timeout: 30_000 });
	expect(await savedMarks(a)).toBe(3);
});

test('a stale tab that missed the change does not overwrite it when it leaves', async ({
	context
}) => {
	const a = await context.newPage();
	await a.goto(PUZZLE);
	await expect(puzzleId(a)).toHaveText('496,678,832', { timeout: 30_000 });
	await click(a, 0, 0);
	await expect.poll(() => savedMarks(a)).toBe(1);

	// Another tab writes the slot without this tab hearing about it (no storage event).
	await a.evaluate((slot) => {
		const saved = JSON.parse(localStorage.getItem(slot)!);
		saved.state.marks = saved.state.marks.map((_: number, i: number) => (i < 3 ? 1 : 0));
		saved.updatedAt += 1000;
		localStorage.setItem(slot, JSON.stringify(saved));
	}, SLOT);
	await hideAndShow(a, false);
	expect(await savedMarks(a)).toBe(3);
});
