import { expect, test, type Page } from '@playwright/test';
import { colours as palette } from '../src/lib/core/palette';

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
	['tetroid', '6n', 496678832, 0.08, 2, `path[stroke="${palette.cross}"]`]
] as const) {
	test(`a touch drag on ${game} that starts on a mark reaches the game state`, async ({ page }) => {
		await page.addInitScript((g) => {
			localStorage.setItem(`vp:tutorialSeen:${g}`, 'true');
			localStorage.setItem('vp:puzzleSource', '"bank"');
		}, game);
		await page.goto(`/${game}?v=${variant}&id=${id}`);
		const board = page.getByRole('application', { name: 'Puzzle board' });
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

test('holding a circle of an open region, then sliding, shows the symmetry helper', async ({
	page
}) => {
	await page.goto('/pinwheel/tutorial');
	const board = page.getByRole('application', { name: 'Puzzle board' });
	await page.waitForLoadState('networkidle');
	const box = (await board.boundingBox())!;
	const cell = box.width / 5.4;
	const at = (r: number, c: number) => ({
		x: box.x + (0.2 + c) * cell,
		y: box.y + (0.2 + r) * cell
	});
	const lit = board.locator(`rect[fill="${palette.selection}"]`);
	const cdp = await page.context().newCDPSession(page);
	// The circle between cells (1,2) and (2,2); held past the lock delay, as its region is open.
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(2, 2.5)] });
	await page.waitForTimeout(600);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(1.5, 1.5)] });
	// The cell under the finger and its partner across the circle.
	await expect(lit).toHaveCount(2);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await expect(lit).toHaveCount(0);
});

/** Two fingers moving together from `from` to `to`, as raw touch events. */
async function twoFingers(page: Page, from: [Point, Point], to: [Point, Point]) {
	const cdp = await page.context().newCDPSession(page);
	const step = (s: number) =>
		from.map((a, id) => ({
			id,
			x: a.x + ((to[id].x - a.x) * s) / 5,
			y: a.y + ((to[id].y - a.y) * s) / 5
		}));
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: step(0) });
	for (let s = 1; s <= 5; s++) {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: step(s) });
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('two fingers scroll a board zoomed past the screen, and pinch to zoom it', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:pinwheel', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
		localStorage.setItem('vp:boardZoom:pinwheel:5n', '2');
	});
	await page.goto('/pinwheel?v=5n&id=612979536');
	const board = page.getByRole('application', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const area = board.locator('xpath=ancestor::div[contains(@class, "overflow-x-auto")]');
	const view = async () => ({
		x: await area.evaluate((el) => el.scrollLeft),
		y: await page.evaluate(() => scrollY)
	});
	const lines = board.locator('path[data-line]');
	const drawn = await lines.count();
	const start = await view();

	// Up and to the left, across cell edges that one finger would draw on.
	await twoFingers(
		page,
		[
			{ x: 150, y: 450 },
			{ x: 250, y: 450 }
		],
		[
			{ x: 70, y: 370 },
			{ x: 170, y: 370 }
		]
	);
	const moved = await view();
	expect(moved.x - start.x).toBeCloseTo(80, -1);
	expect(moved.y - start.y).toBeCloseTo(80, -1);
	await expect(lines).toHaveCount(drawn);

	// Apart: the zoom grows to its most, and the spot between the fingers stays between them.
	const spot = async () => {
		const box = (await board.boundingBox())!;
		return { fx: (200 - box.x) / box.width, fy: (450 - box.y) / box.height, width: box.width };
	};
	const before = await spot();
	await twoFingers(
		page,
		[
			{ x: 150, y: 450 },
			{ x: 250, y: 450 }
		],
		[
			{ x: 80, y: 450 },
			{ x: 320, y: 450 }
		]
	);
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('vp:boardZoom:pinwheel:5n')))
		.toBe('3');
	const after = await spot();
	expect(after.width / before.width).toBeCloseTo(1.5, 1);
	expect(after.fx).toBeCloseTo(before.fx, 1);
	expect(after.fy).toBeCloseTo(before.fy, 1);
	await expect(lines).toHaveCount(drawn);
});
