import { expect, test, type Page } from '@playwright/test';

/**
 * The layout on phones, tablets and desktops, upright and on its side. Below 1024 px the side
 * panel becomes a drawer and the tools sit in a bar at the bottom; from 1024 px the panel is a
 * column and the tools sit below the board.
 */
interface Screen {
	name: string;
	width: number;
	height: number;
	touch: boolean;
}

const SCREENS: Screen[] = [
	{ name: 'phone portrait', width: 390, height: 844, touch: true },
	{ name: 'phone landscape', width: 844, height: 390, touch: true },
	{ name: 'small phone portrait', width: 360, height: 740, touch: true },
	{ name: 'tablet portrait', width: 820, height: 1180, touch: true },
	{ name: 'tablet landscape', width: 1180, height: 820, touch: true },
	{ name: 'laptop', width: 1280, height: 720, touch: false },
	{ name: 'desktop', width: 1920, height: 1080, touch: false }
];

const WIDE = 1024;
/** Below this height the board may need scrolling into view. */
const SHORT = 500;

/** Skip the first-visit tutorial and generate puzzles on the device. */
async function prepare(page: Page) {
	await page.goto('/');
	await page.evaluate(() => {
		for (const game of ['tetroid', 'pinwheel'])
			localStorage.setItem(`vp:tutorialSeen:${game}`, 'true');
		localStorage.setItem('vp:puzzleSource', '"local"');
	});
}

async function openGame(page: Page, path: string) {
	await page.goto(path);
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	return page.getByRole('grid', { name: 'Puzzle board' }).first();
}

/** The page never scrolls sideways. */
async function expectNoSideScroll(page: Page) {
	const { scroll, width } = await page.evaluate(() => ({
		scroll: document.documentElement.scrollWidth,
		width: window.innerWidth
	}));
	expect(scroll, 'page width').toBeLessThanOrEqual(width);
}

/**
 * The whole board is on screen, above the phone tool bar. Short screens (a phone on its side)
 * keep a usable cell size, so there the board may need scrolling into view but still fits.
 */
async function expectBoardOnScreen(page: Page, screen: Screen) {
	const board = page.getByRole('grid', { name: 'Puzzle board' }).first();
	const bar = page.getByRole('toolbar', { name: 'Tools' }).last();
	if (screen.height < SHORT) {
		// Scroll the board's bottom edge just above the tool bar.
		const barTop = (await bar.boundingBox())!.y;
		await board.evaluate(
			(el, top) => window.scrollBy(0, el.getBoundingClientRect().bottom - top + 2),
			barTop
		);
	}
	const box = (await board.boundingBox())!;
	expect(box.x, 'board left').toBeGreaterThanOrEqual(0);
	expect(box.x + box.width, 'board right').toBeLessThanOrEqual(screen.width);
	expect(box.y, 'board top').toBeGreaterThanOrEqual(0);
	const limit = screen.width < WIDE ? (await bar.boundingBox())!.y : screen.height;
	expect(box.height, 'board height').toBeLessThanOrEqual(limit);
	expect(box.y + box.height, 'board bottom').toBeLessThanOrEqual(limit + 1);
}

/** Cells that are not empty in the saved Tetroid game. */
async function markedCells(page: Page, variant: string): Promise<number> {
	return page.evaluate((key) => {
		const save = JSON.parse(localStorage.getItem(key) ?? 'null');
		return save ? save.state.marks.filter((m: number) => m !== 0).length : 0;
	}, `vp:save:tetroid:${variant}`);
}

for (const screen of SCREENS) {
	const wide = screen.width >= WIDE;

	test.describe(screen.name, () => {
		test.use({
			viewport: { width: screen.width, height: screen.height },
			hasTouch: screen.touch,
			isMobile: screen.touch
		});

		test.beforeEach(async ({ page }) => prepare(page));

		test('pages fit the screen', async ({ page }) => {
			for (const path of ['/', '/scores', '/player', '/tetroid/tutorial']) {
				await page.goto(path);
				await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
				await expectNoSideScroll(page);
			}
		});

		for (const [game, variant] of [
			['tetroid', '10n'],
			['tetroid', '20h'],
			['pinwheel', '15n']
		]) {
			test(`the ${game} ${variant} board fits the screen`, async ({ page }) => {
				await openGame(page, `/${game}?v=${variant}`);
				await expectBoardOnScreen(page, screen);
				await expectNoSideScroll(page);
			});
		}

		test(`shows the ${wide ? 'desktop' : 'phone'} layout`, async ({ page }) => {
			await openGame(page, '/tetroid?v=6n');
			const panel = page.getByRole('complementary', { name: 'Tetroid menu' });
			const menuButton = page.getByRole('button', { name: 'Puzzle types and rules' });
			const more = page.getByRole('button', { name: 'More actions' });
			const startOver = page.getByRole('button', { name: 'Start over' });
			await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'New puzzle' })).toBeVisible();
			const tools = page.getByRole('toolbar', { name: 'Tools' }).filter({ visible: true });
			await expect(tools).toHaveCount(1);
			await expect(tools.getByRole('button')).toHaveCount(4);

			if (wide) {
				await expect(panel).toBeVisible();
				await expect(panel.getByRole('heading', { name: 'Tetroid' })).toBeVisible();
				await expect(menuButton).toBeHidden();
				await expect(more).toBeHidden();
				await expect(startOver).toBeVisible();
				// Tools below the board.
				const board = (await page
					.getByRole('grid', { name: 'Puzzle board' })
					.first()
					.boundingBox())!;
				expect((await tools.boundingBox())!.y).toBeGreaterThan(board.y + board.height);
			} else {
				await expect(panel).toBeHidden();
				await expect(startOver).toBeHidden();
				// The tool bar is fixed to the bottom of the screen.
				const bar = (await tools.boundingBox())!;
				expect(bar.y + bar.height).toBeGreaterThan(screen.height - 80);

				// The drawer holds the puzzle types and rules.
				await menuButton.click();
				await expect(panel).toBeVisible();
				await panel.getByRole('button', { name: '8×8 Normal' }).click();
				await expect(panel).toBeHidden();
				await expect(menuButton).toContainText('8×8 Normal');
				await expect(page).toHaveURL(/v=8n/);

				// Rare actions sit in the "more" menu.
				await more.click();
				const menu = page.getByRole('group', { name: 'More actions' });
				await expect(menu.getByRole('button')).toHaveText(['Start over', 'Share board', 'Print…']);
				// The focus moves into the menu and comes back when Escape closes it.
				await expect(menu.getByRole('button', { name: 'Start over' })).toBeFocused();
				await page.keyboard.press('Escape');
				await expect(menu).toBeHidden();
				await expect(more).toBeFocused();
				await more.click();
				await menu.getByRole('button', { name: 'Share board' }).click();
				await expect(page.getByText('Link to your progress:')).toBeVisible();
				await expectNoSideScroll(page);
			}
		});

		test(`${screen.touch ? 'taps' : 'clicks'} on the board make moves`, async ({ page }) => {
			const board = await openGame(page, '/tetroid?v=6n');
			const box = (await board.boundingBox())!;
			const cell = box.width / 6;
			const at = { x: box.x + 2.5 * cell, y: box.y + 2.5 * cell };
			if (screen.touch) await page.touchscreen.tap(at.x, at.y);
			else await page.mouse.click(at.x, at.y);
			await expect.poll(() => markedCells(page, '6n')).toBe(1);
			await page.getByRole('button', { name: 'Undo' }).click();
			await expect.poll(() => markedCells(page, '6n')).toBe(0);
		});

		test(`settings ${screen.touch ? 'offer' : 'hide'} the touch modes`, async ({ page }) => {
			await openGame(page, '/tetroid?v=6n');
			await page.getByRole('button', { name: 'Settings' }).click();
			const dialog = page.getByRole('dialog');
			await expect(dialog).toBeVisible();
			const modes = dialog.getByRole('group', { name: 'Touch input' });
			if (screen.touch)
				await expect(modes.getByRole('radio', { name: 'Always draw' })).toBeChecked();
			else await expect(modes).toHaveCount(0);
			// The dialog fits the screen and can be scrolled to its end.
			const box = (await dialog.boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(screen.width);
			await dialog.getByLabel('Show board coordinates').check();
			await page.keyboard.press('Escape');
			await expect(dialog).toBeHidden();
			await expectBoardOnScreen(page, screen);
		});
	});
}

test.describe('turning a device', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('the layout follows the orientation and keeps the game', async ({ page }) => {
		await prepare(page);
		const board = await openGame(page, '/tetroid?v=10n');
		const box = (await board.boundingBox())!;
		await page.touchscreen.tap(box.x + box.width / 20, box.y + box.height / 20);
		await expect.poll(() => markedCells(page, '10n')).toBe(1);

		for (const [width, height] of [
			[844, 390],
			[1180, 820],
			[390, 844]
		]) {
			await page.setViewportSize({ width, height });
			const screen = { name: '', width, height, touch: true };
			await expect(page.getByRole('complementary', { name: 'Tetroid menu' })).toBeVisible({
				visible: width >= WIDE
			});
			await expect
				.poll(async () => {
					try {
						await expectBoardOnScreen(page, screen);
						return true;
					} catch {
						return false;
					}
				})
				.toBe(true);
			await expectNoSideScroll(page);
			expect(await markedCells(page, '10n')).toBe(1);
		}
	});
});
