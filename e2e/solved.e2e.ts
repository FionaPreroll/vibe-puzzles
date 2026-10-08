import { expect, test, type Page } from '@playwright/test';

// Tetroid 6×6 Normal #496678832 from the bundled bank, and its shaded cells.
const PUZZLE = '/tetroid?v=6n&id=496678832';
const SOLUTION = '101111111000100101111111100001100000';

/** Board, page and focus measurements that should not change when the puzzle gets solved. */
function measure(page: Page) {
	return page.evaluate(() => {
		const area = document.querySelector('.overflow-x-auto')!;
		const svg = area.querySelector('svg')!;
		const box = svg.getBoundingClientRect();
		return {
			board: { x: box.x, y: box.y, width: box.width, height: box.height },
			page: document.documentElement.scrollHeight,
			areaScrolls: area.scrollWidth > area.clientWidth || area.scrollHeight > area.clientHeight,
			boardFocused: document.activeElement === svg,
			boardOutline: getComputedStyle(svg).outlineStyle
		};
	});
}

for (const [width, height, locale] of [
	[360, 740, 'de-DE'],
	[375, 667, 'de-DE'],
	[390, 844, 'en-US']
] as const) {
	test.describe(`${width}×${height} ${locale}`, () => {
		test.use({ viewport: { width, height }, isMobile: true, hasTouch: true, locale });

		test('the board never scrolls inside its area', async ({ page }) => {
			for (const path of ['/pinwheel?v=5n', '/tetroid?v=6n']) {
				await page.addInitScript(() => {
					for (const g of ['tetroid', 'pinwheel']) {
						localStorage.setItem(`vp:tutorialSeen:${g}`, 'true');
					}
					localStorage.setItem('vp:puzzleSource', '"bank"');
				});
				await page.goto(path);
				await expect(page.locator('.overflow-x-auto svg[role="grid"]')).toBeVisible({
					timeout: 30_000
				});
				expect((await measure(page)).areaScrolls).toBe(false);
			}
		});

		test('solving keeps the board and the page as they were', async ({ page }) => {
			await page.addInitScript(() => {
				localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
				localStorage.setItem('vp:puzzleSource', '"bank"');
			});
			await page.goto(PUZZLE);
			const board = page.locator('.overflow-x-auto svg[role="grid"]');
			await expect(board).toBeVisible({ timeout: 30_000 });
			await page.waitForLoadState('networkidle');

			// The first rect is the 6×6 grid itself, inside the board's padding.
			const grid = (await board.locator('rect').first().boundingBox())!;
			const cell = grid.width / 6;
			const cells = [...SOLUTION].flatMap((c, i) => (c === '1' ? [i] : []));
			const tap = (i: number) =>
				page.touchscreen.tap(
					grid.x + ((i % 6) + 0.5) * cell,
					grid.y + (Math.floor(i / 6) + 0.5) * cell
				);
			for (const i of cells.slice(0, -1)) await tap(i);
			const before = await measure(page);
			expect(before.boardFocused).toBe(true);

			await tap(cells[cells.length - 1]);
			await expect(page.getByRole('button', { name: /^(New puzzle|Neues Rätsel)$/ })).toHaveClass(
				/btn-primary/
			);
			// Wait out the celebration.
			await page.waitForTimeout(2000);
			const after = await measure(page);
			expect(after.board).toEqual(before.board);
			expect(after.page).toBe(before.page);
			expect(after.areaScrolls).toBe(false);
			// A tapped board shows no focus ring.
			expect(after.boardOutline).toBe('none');
		});
	});
}
