import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Look } from '../src/lib/core/theme';
import * as positions from './positions';

/**
 * The README's screenshots (docs/screenshots): the games half played, the looks by day and by
 * night, and some features. `pnpm screenshots` takes them again and writes those that look
 * different; the "Update README screenshots" workflow proposes them in a pull request.
 *
 * Everything that would change from run to run is fixed: the date and the clock, the puzzles and
 * positions, the moment every animation shows, the font, and the commit in the footer is left out.
 */

/** The date the pages see: countdowns, the daily puzzles. The look is chosen per screenshot. */
const NOW = new Date('2026-11-15T12:00:00Z');
/** What the game clock shows on the games. */
const PLAYED_MS = (4 * 60 + 32) * 1000;

interface Options {
	look?: Look;
	night?: boolean;
	/** The layout of the game page; 'auto' leaves it to the screen. */
	layout?: 'standard' | 'auto';
	/** Whether to wait for the game board. */
	board?: boolean;
	/** Game settings switched on, by game. */
	settings?: Record<string, string[]>;
}

/**
 * The app writes in the system's font, which differs from machine to machine (and is rather plain
 * in the browser tests' container). The screenshots use Inter, much like the fonts of Apple's and
 * Google's systems, added to every page before it is first drawn.
 */
const FONT = (() => {
	const file = 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';
	const data = readFileSync(file).toString('base64');
	return (
		`<style>@font-face{font-family:'Inter Screenshots';font-style:normal;font-weight:100 900;` +
		`src:url(data:font/woff2;base64,${data}) format('woff2')}` +
		`:root{--font-sans:'Inter Screenshots',sans-serif}</style>`
	);
})();

test.use({
	viewport: { width: 1280, height: 800 },
	locale: 'en-US',
	timezoneId: 'UTC',
	colorScheme: 'light'
});

/** Opens `path` as a returning player would see it: no first-visit tutorials. */
async function open(page: Page, path: string, options: Options = {}) {
	const { look = 'classic', night = false, layout = 'standard', board = false } = options;
	const settings = options.settings ?? {};
	await page.clock.setFixedTime(NOW);
	await page.addInitScript(
		([look, night, layout, settings]) => {
			localStorage.setItem('vp:look', JSON.stringify(look));
			localStorage.setItem('vp:night', JSON.stringify(night));
			if (layout !== 'auto') localStorage.setItem('vp:layout', JSON.stringify(layout));
			localStorage.setItem('vp:puzzleSource', '"bank"');
			for (const game of ['tetroid', 'pinwheel', 'sudoku', 'loop', 'pipes']) {
				localStorage.setItem(`vp:tutorialSeen:${game}`, 'true');
			}
			for (const [game, keys] of Object.entries(settings)) {
				const values = Object.fromEntries(keys.map((key) => [key, true]));
				localStorage.setItem(`vp:settings:${game}`, JSON.stringify({ values, updatedAt: 1 }));
			}
		},
		[look, night, layout, settings] as const
	);
	await page.route('**/*', async (route) => {
		if (route.request().resourceType() !== 'document') return route.fallback();
		const response = await route.fetch();
		const body = (await response.text()).replace('</head>', `${FONT}</head>`);
		await route.fulfill({ response, body });
	});
	await page.goto(path);
	if (board) {
		await expect(boardOf(page)).toBeVisible({ timeout: 30_000 });
	}
	// The app runs (and has asked for the server) once the network is quiet.
	await page.waitForLoadState('networkidle');
}

const boardOf = (page: Page) =>
	page.getByRole('application', { name: /^(Puzzle board|Spielfeld)$/ }).first();

/** Lets the game clock show `PLAYED_MS`, as if the position took that long to reach. */
async function playFor(page: Page, ms = PLAYED_MS) {
	await page.clock.setFixedTime(NOW.getTime() + ms);
	const clock = new Date(ms).toISOString().slice(14, 19);
	await expect(page.getByLabel(/^(Timer|Zeit)$/).first()).toHaveText(clock);
}

/**
 * Fixes what would differ between two runs: every animation stops at the same moment (snow
 * half-way down, the bats in flight), and the footer leaves out the commit.
 */
async function settle(page: Page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		for (const animation of document.getAnimations()) {
			animation.pause();
			animation.currentTime = 2500;
		}
		const footer = document.querySelector('footer');
		if (footer) {
			const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				node.textContent = node.textContent!.replace(/\s*\([0-9a-f]{7}\)/, '');
			}
		}
	});
}

/** Takes the screenshot `name` of the page (or all of it), or of a part of it. */
async function snap(page: Page, name: string, part?: Locator | Clip | 'full') {
	await settle(page);
	const options = { animations: 'allow' as const, fullPage: part === 'full' };
	if (part === 'full') part = undefined;
	if (part && 'x' in part) await expect(page).toHaveScreenshot(name, { ...options, clip: part });
	else await expect(part ?? page).toHaveScreenshot(name, options);
}

type Clip = { x: number; y: number; width: number; height: number };

/** The smallest box around `parts`, with `pad` pixels of room. */
async function around(parts: Locator[], pad = 16): Promise<Clip> {
	const boxes = await Promise.all(parts.map(async (part) => (await part.boundingBox())!));
	const left = Math.min(...boxes.map((b) => b.x)) - pad;
	const top = Math.min(...boxes.map((b) => b.y)) - pad;
	const right = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
	const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The board with the clock above it and the play bar (or `below`) below it. */
const gameArea = (page: Page, below: Locator = page.getByRole('toolbar').first()) =>
	around([page.locator('.stage-column').first(), page.locator('.board-stage').first(), below]);

/** The home page's header, title and first row of games: what a look decorates. */
async function top(page: Page): Promise<Clip> {
	const games = (await page.getByRole('listitem').first().boundingBox())!;
	return { x: 0, y: 0, width: page.viewportSize()!.width, height: games.y + games.height + 24 };
}

test('home page', async ({ page }) => {
	await open(page, '/');
	await snap(page, 'home.png', 'full');
});

/** Settings the games are shown with: Tetroid's pieces in their colours. */
const GAME_SETTINGS = { tetroid: ['colorTetrominoes'] };

test.describe('games', () => {
	for (const [name, position] of Object.entries({
		tetroid: () => positions.tetroid(),
		pinwheel: () => positions.pinwheel(),
		sudoku: () => positions.sudoku('9n', 0.5),
		calcudoku: () => positions.sudoku('c7n', 0.4),
		loop: () => positions.loop(),
		pipes: () => positions.pipes()
	})) {
		test(name, async ({ page }) => {
			await open(page, position().path, { board: true, settings: GAME_SETTINGS });
			await playFor(page);
			await snap(page, `${name}.png`, await gameArea(page));
		});
	}
});

test.describe('looks', () => {
	for (const look of ['classic', 'halloween', 'winter', 'christmas'] as const) {
		for (const night of [false, true]) {
			test(`${look} by ${night ? 'night' : 'day'}`, async ({ page }) => {
				await open(page, '/', { look, night });
				await snap(page, `look-${look}-${night ? 'night' : 'day'}.png`, await top(page));
			});
		}
	}
});

test.describe('features', () => {
	test('hint', async ({ page }) => {
		await open(page, positions.sudoku('9n', 0.3).path, { board: true });
		await playFor(page);
		await page.getByRole('button', { name: 'Hint', exact: true }).first().click();
		await page.getByRole('button', { name: 'Show the step' }).click();
		await snap(page, 'hint.png', await gameArea(page, page.locator('.hint-note').first()));
	});

	test('tutorial', async ({ page }) => {
		await open(page, '/pinwheel/tutorial', { board: true });
		await page.getByRole('button', { name: 'Next' }).click();
		await expect(page.getByText('Step 2 of')).toBeVisible();
		await page.mouse.move(0, 0);
		const card = page.getByRole('link', { name: 'Skip tutorial' }).locator('..');
		const tools = page.getByRole('toolbar').first();
		await snap(page, 'tutorial.png', await around([boardOf(page), tools, card], 24));
	});

	test('trial', async ({ page }) => {
		const position = positions.loop('7n', 0.3);
		await open(page, position.path, { board: true });
		await playFor(page);
		await page.getByRole('button', { name: 'Try', exact: true }).click();
		// The first rect is the grid itself, inside the board's padding.
		const grid = (await boardOf(page).locator('rect').first().boundingBox())!;
		const cell = grid.width / position.width;
		for (const [x, y] of position.next!) {
			await page.mouse.click(grid.x + x * cell, grid.y + y * cell);
		}
		await page.mouse.move(0, 0);
		const trial = page.getByRole('group', { name: /Trial/ }).first();
		await snap(page, 'trial.png', await gameArea(page, trial));
	});

	test.describe('on a tablet in landscape', () => {
		test.use({ viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true });

		test('widescreen', async ({ page }) => {
			await open(page, positions.pipes('10n', 3).path, { board: true, layout: 'auto' });
			await playFor(page);
			await snap(page, 'widescreen.png');
		});
	});

	test.describe('on a phone', () => {
		test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

		test('in English', async ({ page }) => {
			await open(page, positions.pinwheel('7n', 5).path, { board: true });
			await playFor(page);
			await snap(page, 'phone.png');
		});

		test.describe('in German', () => {
			test.use({ locale: 'de-DE' });

			test('by night', async ({ page }) => {
				await open(page, positions.sudoku('c7n', 0.5).path, { board: true, night: true });
				await playFor(page);
				await snap(page, 'phone-de-night.png');
			});
		});
	});

	test.describe('Inside', () => {
		test.use({ viewport: { width: 800, height: 1040 } });

		test('Inside', async ({ page }) => {
			await open(page, '/inside');
			await page
				.getByRole('group', { name: 'Films' })
				.getByRole('button', { name: 'Loop' })
				.click();
			const forward = page.getByRole('button', { name: 'One step forward' });
			for (let i = 0; i < 16; i++) await forward.click();
			await expect(page.getByTestId('step')).toHaveText(/Step 17 of/);
			await page.mouse.move(0, 0);
			await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
			await snap(page, 'inside.png');
		});
	});
});
