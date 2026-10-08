import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

type Point = { x: number; y: number };

/** A quick swipe between two page points, as raw touch events. */
async function swipe(page: Page, a: Point, b: Point) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
	for (let s = 1; s <= 4; s++) {
		const p = { x: a.x + ((b.x - a.x) * s) / 4, y: a.y + ((b.y - a.y) * s) / 4 };
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// The first swipes leave marks along a row (a line; shaded, then crossed cells). The last
// swipe starts right on one of them, which it then redraws under the finger.
for (const [game, variant, id, row, prep, mark] of [
	['pinwheel', '5n', 612979536, 0.405, 1, 'path[data-line]'],
	['tetroid', '6n', 496678832, 0.08, 2, 'path[stroke="#dc2626"]']
] as const) {
	test(`a touch drag on ${game} that starts on a mark reaches the game state`, async ({ page }) => {
		await page.addInitScript((g) => {
			localStorage.setItem(`vp:tutorialSeen:${g}`, 'true');
			localStorage.setItem('vp:puzzleSource', '"bank"');
		}, game);
		await page.goto(`/${game}?v=${variant}&id=${id}`);
		const board = page.getByRole('grid', { name: 'Puzzle board' });
		await expect(board).toBeVisible({ timeout: 30_000 });
		// Touch handlers are attached once the page has hydrated.
		await page.waitForLoadState('networkidle');
		const box = (await board.boundingBox())!;
		const at = (fx: number, fy: number) => ({
			x: box.x + fx * box.width,
			y: box.y + fy * box.height
		});

		for (let i = 0; i < prep; i++) await swipe(page, at(0.08, row), at(0.92, row));
		const m = (await board.locator(mark).first().boundingBox())!;
		const start = { x: m.x + m.width / 2, y: m.y + m.height / 2 };
		const before = await board.innerHTML();
		await swipe(page, start, { x: start.x, y: start.y + box.height * 0.4 });
		const shown = await board.innerHTML();
		expect(shown).not.toBe(before);

		// What is shown is what was saved: the move reached the game state.
		await page.reload();
		await page.waitForLoadState('networkidle');
		expect(await board.innerHTML()).toBe(shown);
	});
}
