import { expect, test } from '@playwright/test';

for (const [label, viewport, isMobile] of [
	['wide', { width: 1280, height: 800 }, false],
	['phone', { width: 390, height: 844 }, true]
] as const) {
	test.describe(label, () => {
		test.use({ viewport, isMobile, hasTouch: isMobile });

		test('the zoom slider stays in place while it is dragged', async ({ page }) => {
			await page.addInitScript(() => {
				localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
				localStorage.setItem('vp:puzzleSource', '"bank"');
			});
			await page.goto('/tetroid?v=6n&id=496678832');
			await expect(page.getByRole('grid', { name: 'Puzzle board' })).toBeVisible({
				timeout: 30_000
			});
			await page.waitForLoadState('networkidle');
			await page.getByRole('button', { name: 'Zoom' }).click();
			const slider = page.getByRole('slider', { name: 'Zoom' });
			const start = (await slider.boundingBox())!;

			// Drag from the thumb (at 100%) to the right end: the board grows, and the slider must not
			// move with it, or the value jumps back and forth under the pointer.
			const y = start.y + start.height / 2;
			const from = start.x + ((100 - 30) / (300 - 30)) * start.width;
			await page.mouse.move(from, y);
			await page.mouse.down();
			const drag = async (a: number, b: number) => {
				const values: number[] = [];
				for (let i = 1; i <= 20; i++) {
					await page.mouse.move(a + ((b - a) * i) / 20, y);
					const box = (await slider.boundingBox())!;
					expect(Math.abs(box.x - start.x)).toBeLessThan(1);
					expect(Math.abs(box.y - start.y)).toBeLessThan(1);
					values.push(Number(await slider.inputValue()));
				}
				return values;
			};
			const right = start.x + start.width - 2;
			const up = await drag(from, right);
			expect(up).toEqual([...up].sort((a, b) => a - b));
			expect(up.at(-1)).toBeGreaterThan(250);
			// And back down, the board shrinking again.
			const down = await drag(right, start.x + 2);
			expect(down).toEqual([...down].sort((a, b) => b - a));
			expect(down.at(-1)).toBeLessThan(50);
			await page.mouse.up();
		});
	});
}
