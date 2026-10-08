import { expect, test } from '@playwright/test';
import { board, percentile, prepare, random } from './helpers';

/**
 * Performance budgets on the largest boards: how fast a game page shows its board, how fast a
 * move shows up, and that dragging never blocks the page. PERF_BUDGET_SCALE (default 1) relaxes
 * the budgets on slow machines.
 */
const SCALE = Number(process.env.PERF_BUDGET_SCALE ?? 1);
const BUDGET = {
	/** Navigation start to the board on screen. */
	boardMs: 3000 * SCALE,
	/** Pointer down to the next frame after the board changed, 95th percentile. */
	moveP95Ms: 100 * SCALE,
	/** Longest main-thread task while dragging across the board. */
	longestTaskMs: 200 * SCALE
};

for (const path of ['/tetroid?v=20h', '/pinwheel?v=15h']) {
	test(`${path} stays within its performance budgets`, async ({ page }) => {
		await prepare(page);
		await page.goto(path);
		// Milliseconds since navigation start when the board is first there (polled per frame).
		const boardMs = await page.evaluate(
			() =>
				new Promise<number>((resolve) => {
					const poll = () =>
						document.querySelector('.overflow-x-auto svg[role="grid"]')
							? resolve(performance.now())
							: requestAnimationFrame(poll);
					poll();
				})
		);
		await expect(board(page)).toBeVisible();
		await page.waitForLoadState('networkidle');

		// Time every move from pointer down until the frame after the board changed.
		await page.evaluate(() => {
			const w = window as unknown as { lat: number[]; tasks: number[] };
			w.lat = [];
			w.tasks = [];
			const svg = document.querySelector('.overflow-x-auto svg[role="grid"]')!;
			let start = 0;
			window.addEventListener('pointerdown', () => (start = performance.now()), true);
			new MutationObserver(() => {
				if (!start) return;
				const t0 = start;
				start = 0;
				requestAnimationFrame(() => w.lat.push(performance.now() - t0));
			}).observe(svg, { subtree: true, childList: true, attributes: true, characterData: true });
			new PerformanceObserver((list) => {
				for (const e of list.getEntries()) w.tasks.push(e.duration);
			}).observe({ type: 'longtask' });
		});

		const rnd = random(7);
		const box = (await board(page).boundingBox())!;
		const at = (fx: number, fy: number) => ({
			x: box.x + fx * box.width,
			y: box.y + fy * box.height
		});
		for (let i = 0; i < 40; i++) {
			const p = at(0.05 + rnd() * 0.9, 0.05 + rnd() * 0.9);
			await page.mouse.click(p.x, p.y);
		}
		// Long drags corner to corner and across.
		for (const [a, b] of [
			[at(0.03, 0.03), at(0.97, 0.97)],
			[at(0.97, 0.03), at(0.03, 0.97)],
			[at(0.03, 0.5), at(0.97, 0.5)]
		]) {
			await page.mouse.move(a.x, a.y);
			await page.mouse.down();
			await page.mouse.move(b.x, b.y, { steps: 60 });
			await page.mouse.up();
		}
		await page.waitForTimeout(500);

		const { lat, tasks } = await page.evaluate(() => {
			const w = window as unknown as { lat: number[]; tasks: number[] };
			return { lat: w.lat, tasks: w.tasks };
		});
		const result = {
			boardMs: Math.round(boardMs),
			moves: lat.length,
			moveP50Ms: Math.round(percentile(lat, 50)),
			moveP95Ms: Math.round(percentile(lat, 95)),
			longestTaskMs: Math.round(Math.max(0, ...tasks))
		};
		console.log(path, JSON.stringify(result));
		await test.info().attach('performance.json', {
			body: JSON.stringify({ path, result, budget: BUDGET }, null, 2),
			contentType: 'application/json'
		});

		expect(result.moves).toBeGreaterThan(20);
		expect(result.boardMs).toBeLessThan(BUDGET.boardMs);
		expect(result.moveP95Ms).toBeLessThan(BUDGET.moveP95Ms);
		expect(result.longestTaskMs).toBeLessThan(BUDGET.longestTaskMs);
	});
}
