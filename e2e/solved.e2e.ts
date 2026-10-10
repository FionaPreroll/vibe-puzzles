import { expect, test, type Page } from '@playwright/test';

// Tetroid 6×6 Normal #496678832 from the bundled bank, and its shaded cells.
const PUZZLE = '/tetroid?v=6n&id=496678832';
const SOLUTION = '101111111000100101111111100001100000';

/** Board, page and focus measurements that should not change when the puzzle gets solved. */
function measure(page: Page) {
	return page.evaluate(() => {
		const area = document.querySelector('.overflow-x-auto')!;
		const svg = area.querySelector('svg[role="grid"]')!;
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
			await expect(
				page.getByRole('button', { name: /^(Share success|Erfolg teilen)$/ })
			).toBeVisible();
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

// Pinwheel 7×7 Normal #1027244002 from the bundled bank and its solution lines, as in
// galaxy-dots.e2e.ts. Its stage is wide enough that the ID and two buttons once fitted on one
// line, until solving added a third.
const PINWHEEL = '/pinwheel?v=7n&id=1027244002';
const H = '00000001111110000011100101110000011110111100000010000000';
const V = '00001110001111100011110000101100001011000111011001110110';

/** Records the boxes of the board and its stage on every frame, until `stop` is called. */
async function watchBoard(page: Page) {
	await page.evaluate(() => {
		const w = window as unknown as { boardBoxes: string[]; watching: boolean };
		w.boardBoxes = [];
		w.watching = true;
		const box = (el: Element) => {
			const r = el.getBoundingClientRect();
			return [r.x, r.y, r.width, r.height].map((n) => n.toFixed(1)).join(',');
		};
		const tick = () => {
			const board = document.querySelector('svg[role="grid"]')!;
			const stage = document.querySelector('.board-stage')!;
			w.boardBoxes.push(`board ${box(board)} stage ${box(stage)} scroll ${window.scrollY}`);
			if (w.watching) requestAnimationFrame(tick);
		};
		tick();
	});
	return async () => {
		const boxes = await page.evaluate(() => {
			const w = window as unknown as { boardBoxes: string[]; watching: boolean };
			w.watching = false;
			return w.boardBoxes;
		});
		return [...new Set(boxes)];
	};
}

for (const [label, viewport, locale] of [
	['wide', { width: 1280, height: 800 }, 'en-US'],
	['narrower wide', { width: 1024, height: 768 }, 'de-DE'],
	['phone', { width: 390, height: 844 }, 'en-US']
] as const) {
	for (const [look, night] of [
		['classic', false],
		['halloween', true]
	] as const) {
		test.describe(`${label}, ${look}${night ? ' by night' : ''}`, () => {
			const phone = viewport.width < 500;
			test.use({
				viewport,
				locale,
				isMobile: phone,
				hasTouch: phone,
				permissions: ['clipboard-read', 'clipboard-write']
			});

			test('the board keeps its place through the celebration and sharing the solve', async ({
				page
			}) => {
				await page.addInitScript(
					([look, night]) => {
						localStorage.setItem('vp:look', JSON.stringify(look));
						localStorage.setItem('vp:night', JSON.stringify(night));
						localStorage.setItem('vp:tutorialSeen:pinwheel', 'true');
						localStorage.setItem('vp:puzzleSource', '"bank"');
						// Copy the solve rather than open a share sheet.
						Object.defineProperty(navigator, 'share', { value: undefined });
					},
					[look, night] as const
				);
				await page.goto(PINWHEEL);
				const board = page.locator('.overflow-x-auto svg[role="grid"]');
				await expect(board).toBeVisible({ timeout: 30_000 });
				await page.waitForLoadState('networkidle');
				const grid = (await board.locator('rect').first().boundingBox())!;
				const cell = grid.width / 7;
				const edges = [
					...[...H].flatMap((c, k) => (c === '1' ? [[(k % 7) + 0.5, Math.floor(k / 7)]] : [])),
					...[...V].flatMap((c, k) => (c === '1' ? [[k % 8, Math.floor(k / 8) + 0.5]] : []))
				];
				const draw = ([x, y]: number[]) =>
					phone
						? page.touchscreen.tap(grid.x + x * cell, grid.y + y * cell)
						: page.mouse.click(grid.x + x * cell, grid.y + y * cell);
				for (const edge of edges.slice(0, -1)) await draw(edge);

				const stop = await watchBoard(page);
				await draw(edges[edges.length - 1]);
				const share = page.getByRole('button', { name: /^(Share success|Erfolg teilen)$/ });
				await expect(share).toBeVisible();
				// Through the whole celebration.
				await expect(page.locator('.solved-burst, .halloween-burst')).toHaveCount(0, {
					timeout: 5000
				});
				await share.click();
				await expect(page.getByText(/^(Copied your result|Ergebnis)/).first()).toBeVisible();
				await page.waitForTimeout(300);
				expect(await stop()).toHaveLength(1);
			});
		});
	}
}

test.describe('the message after sharing the solve on a wide screen', () => {
	test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

	for (const [width, locale, look, night] of [
		[1280, 'en-US', 'halloween', true],
		[1280, 'de-DE', 'classic', false],
		[1024, 'en-US', 'classic', true],
		[1024, 'de-DE', 'halloween', false]
	] as const) {
		test(`keeps its text clear of the box's edges, centred (${width}px, ${locale}, ${look}${night ? ', night' : ''})`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height: 800 });
			await page.addInitScript(
				([look, night, locale]) => {
					localStorage.setItem('vp:look', JSON.stringify(look));
					localStorage.setItem('vp:night', JSON.stringify(night));
					localStorage.setItem('vp:locale', locale.slice(0, 2));
					localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
					localStorage.setItem('vp:puzzleSource', '"bank"');
					Object.defineProperty(navigator, 'share', { value: undefined });
				},
				[look, night, locale] as const
			);
			await page.goto(PUZZLE);
			const board = page.locator('.overflow-x-auto svg[role="grid"]');
			await expect(board).toBeVisible({ timeout: 30_000 });
			await page.waitForLoadState('networkidle');
			const grid = (await board.locator('rect').first().boundingBox())!;
			const cell = grid.width / 6;
			for (const i of [...SOLUTION].flatMap((c, i) => (c === '1' ? [i] : []))) {
				await page.mouse.click(
					grid.x + ((i % 6) + 0.5) * cell,
					grid.y + (Math.floor(i / 6) + 0.5) * cell
				);
			}
			await page.getByRole('button', { name: /^(Share success|Erfolg teilen)$/ }).click();
			// The box itself, not the copy for screen readers.
			const message = page.locator('p:not(.sr-only)', {
				hasText: /^\s*(Copied your result|Ergebnis und Link)/
			});
			await expect(message).toBeVisible();

			// Every line of text sits inside the box's rounded outline with room to spare, and in the
			// middle of it.
			const problems = await message.evaluate((box) => {
				const outer = box.getBoundingClientRect();
				const radius = Math.min(
					parseFloat(getComputedStyle(box).borderTopLeftRadius),
					outer.width / 2,
					outer.height / 2
				);
				const margin = 4;
				const inner = {
					left: outer.left + margin,
					right: outer.right - margin,
					top: outer.top + margin,
					bottom: outer.bottom - margin,
					r: Math.max(0, radius - margin)
				};
				const inside = (x: number, y: number) => {
					if (x < inner.left || x > inner.right || y < inner.top || y > inner.bottom) return false;
					const cx = Math.min(Math.max(x, inner.left + inner.r), inner.right - inner.r);
					const cy = Math.min(Math.max(y, inner.top + inner.r), inner.bottom - inner.r);
					return Math.hypot(x - cx, y - cy) <= inner.r + 0.5;
				};
				const range = document.createRange();
				range.selectNodeContents(box);
				const found: string[] = [];
				const middle = (outer.left + outer.right) / 2;
				for (const line of range.getClientRects()) {
					if (line.width < 1) continue;
					for (const [x, y] of [
						[line.left, line.top],
						[line.right, line.top],
						[line.left, line.bottom],
						[line.right, line.bottom]
					]) {
						if (!inside(x, y)) found.push(`corner ${x.toFixed(1)},${y.toFixed(1)} outside`);
					}
					const centre = (line.left + line.right) / 2;
					if (Math.abs(centre - middle) > 2) found.push(`line off centre by ${centre - middle}`);
				}
				return found;
			});
			expect(problems).toEqual([]);
			// Out of the flow, it covers neither the header nor the board's stage.
			const box = (await message.boundingBox())!;
			const header = (await page.locator('header').first().boundingBox())!;
			const stage = (await page.locator('.board-stage').boundingBox())!;
			expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
			expect(box.y + box.height).toBeLessThanOrEqual(stage.y);
		});
	}
});

test('a solve that cannot be copied shows in a dialog, selected, ready to copy by hand', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
		Object.defineProperty(navigator, 'share', { value: undefined });
		// The clipboard refuses, as without the permission.
		navigator.clipboard.writeText = () => Promise.reject(new DOMException('denied'));
	});
	await page.goto(PUZZLE);
	const board = page.locator('.overflow-x-auto svg[role="grid"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 6;
	for (const i of [...SOLUTION].flatMap((c, i) => (c === '1' ? [i] : []))) {
		await page.mouse.click(
			grid.x + ((i % 6) + 0.5) * cell,
			grid.y + (Math.floor(i / 6) + 0.5) * cell
		);
	}
	await expect(page.locator('.solved-burst')).toHaveCount(0, { timeout: 5000 });
	const stop = await watchBoard(page);
	await page.getByRole('button', { name: 'Share success' }).click();

	const dialog = page.getByRole('dialog', { name: 'Share success' });
	await expect(dialog).toBeVisible();
	const text = dialog.getByRole('textbox', { name: 'Your result and the link' });
	await expect(text).toHaveValue(
		/^I solved Tetroid 6×6 Normal \(puzzle 496,678,832\) in .+ http:\/\/[^ ]+\/tetroid\?id=496678832$/
	);
	// All of it selected, ready to copy.
	await expect
		.poll(() =>
			text.evaluate(
				(el: HTMLTextAreaElement) =>
					document.activeElement === el &&
					el.selectionStart === 0 &&
					el.selectionEnd === el.value.length
			)
		)
		.toBe(true);
	// The long text stays out of the top bar, and the board stays where it was.
	await expect(page.locator('p:not(.sr-only)', { hasText: 'I solved' })).toHaveCount(0);
	expect(await stop()).toHaveLength(1);

	// Copying the selection the old way needs no permission.
	await dialog.getByRole('button', { name: 'Copy' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.locator('p:not(.sr-only)', { hasText: 'Copied your result' })).toBeVisible();
});
