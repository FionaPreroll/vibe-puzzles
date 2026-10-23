import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Automatic accessibility checks with axe: names and roles, contrast, keyboard access and the size
 * of touch targets (the rules for WCAG 2.2 A and AA). Every page and game, in both looks, by day
 * and by night, then the menus and dialogs, a solved puzzle, the tutorials, a phone and the
 * widescreen layout.
 */

test.describe.configure({ mode: 'parallel' });

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Fails with what axe finds on the page, or in the part `within` selects. */
async function expectAccessible(page: Page, within?: string) {
	// Contrast is measured on the colours that stay: slides and fades end first.
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== 'running')
	);
	let axe = new AxeBuilder({ page }).withTags(WCAG);
	if (within) axe = axe.include(within);
	const { violations } = await axe.analyze();
	const found = violations.flatMap((v) =>
		v.nodes.map((n) => `${v.id} at ${n.target.join(' ')}: ${n.failureSummary}`)
	);
	expect(found, `on ${page.url()}`).toEqual([]);
}

const GAMES = [
	'/tetroid?v=6n&id=496678832',
	'/sudoku',
	'/sudoku?v=calc6',
	'/loop?v=5n',
	'/pinwheel?v=7n&id=1027244002'
];
const TETROID = GAMES[0];

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		for (const game of ['tetroid', 'sudoku', 'loop', 'pinwheel'])
			localStorage.setItem(`vp:tutorialSeen:${game}`, 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
});

async function openPage(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

async function openGame(page: Page, path: string) {
	await page.goto(path);
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
}

for (const look of ['classic', 'halloween'] as const) {
	for (const scheme of ['light', 'dark'] as const) {
		test.describe(`${look} by ${scheme === 'light' ? 'day' : 'night'}`, () => {
			test.use({ colorScheme: scheme });
			test.beforeEach(async ({ page }) => {
				await page.addInitScript((look) => localStorage.setItem('vp:look', `"${look}"`), look);
			});

			test('the pages', async ({ page }) => {
				for (const path of ['/', '/about', '/scores', '/player', '/inside']) {
					await openPage(page, path);
					await expectAccessible(page);
				}
			});

			test('the games', async ({ page }) => {
				for (const path of GAMES) {
					await openGame(page, path);
					await expectAccessible(page);
				}
			});
		});
	}
}

for (const scheme of ['light', 'dark'] as const) {
	test.describe(`by ${scheme === 'light' ? 'day' : 'night'}`, () => {
		test.use({ colorScheme: scheme });

		test('the menus and dialogs of a game', async ({ page }) => {
			await openGame(page, TETROID);
			// The hint lies over the buttons below the tools until it is closed: only the hint itself.
			await page.getByRole('button', { name: 'Hint', exact: true }).click();
			await expect(page.getByText('Show the step')).toBeVisible();
			await expectAccessible(page, '.hint-note');
			await page.getByRole('button', { name: 'Dismiss' }).first().click();

			// The menu lies over the tools: only the menu.
			await page.getByRole('button', { name: 'More actions' }).click();
			await expect(page.getByRole('group', { name: 'More actions' })).toBeVisible();
			await expectAccessible(page, '[role="group"][aria-label="More actions"]');
			await page.getByRole('button', { name: 'Start over' }).click();
			await expect(page.getByRole('alertdialog')).toBeVisible();
			await expectAccessible(page);
			await page.keyboard.press('Escape');

			await page.keyboard.press('?');
			await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
			await expectAccessible(page);
			await page.keyboard.press('Escape');

			await page.getByRole('button', { name: 'Settings' }).first().click();
			await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
			await expectAccessible(page);
			await page.keyboard.press('Escape');

			await page.getByRole('button', { name: /^Connection: / }).click();
			await expectAccessible(page);
		});

		test('a solved puzzle', async ({ page }) => {
			await openGame(page, TETROID);
			const board = page.getByRole('application', { name: 'Puzzle board' });
			const grid = (await board.locator('rect').first().boundingBox())!;
			const cell = grid.width / 6;
			for (const [i, c] of [...'101111111000100101111111100001100000'].entries()) {
				if (c === '1')
					await page.mouse.click(
						grid.x + ((i % 6) + 0.5) * cell,
						grid.y + (Math.floor(i / 6) + 0.5) * cell
					);
			}
			await expect(page.locator('.solved-glow')).toHaveCount(1);
			await expectAccessible(page);
		});

		test('the tutorials', async ({ page }) => {
			for (const path of [
				'/tetroid/tutorial',
				'/sudoku/tutorial',
				'/sudoku/tutorial/calc',
				'/loop/tutorial',
				'/pinwheel/tutorial'
			]) {
				await openPage(page, path);
				await expect(page.getByText(/^Step 1 of \d+$/i)).toBeVisible();
				await expectAccessible(page);
			}
		});
	});
}

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('the home page, a game and its drawer', async ({ page }) => {
		await openPage(page, '/');
		await expectAccessible(page);
		await openGame(page, TETROID);
		await expectAccessible(page);
		await page.getByRole('button', { name: 'Puzzle types and rules' }).click();
		await expect(page.getByRole('complementary', { name: 'Tetroid menu' })).toBeVisible();
		await expectAccessible(page);
	});
});

test.describe('widescreen', () => {
	test.use({ viewport: { width: 1024, height: 700 } });

	test('the game with its panel, open and folded', async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('vp:layout', '"left"'));
		await openGame(page, TETROID);
		await expectAccessible(page);
		await page.getByRole('button', { name: 'Collapse controls' }).click();
		await expect(page.getByRole('button', { name: 'Expand controls' })).toBeVisible();
		await expectAccessible(page);
	});
});
