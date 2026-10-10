import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { detachedReport } from './heap';
import { board, prepare, random } from './helpers';
import { resources, trackResources, type Resources } from './resources';

/**
 * A long session in one tab, the way someone plays for an hour: moves, drags, keys, undo and
 * redo, checkpoints, dialogs, zoom, sharing, other puzzle types, puzzles from the collection and
 * from the device, solved puzzles with their celebration, and switching games.
 *
 * The session runs in rounds of ROUND actions that alternate between the games and end on the
 * same solved puzzle, so the page is in the same state at the end of every round of a game.
 * Comparing a late round with an early one finds anything that grows round after round: heap,
 * DOM nodes (also detached ones), listeners, timers, animation frames, observers, object URLs,
 * workers and their unanswered jobs, and storage. Nothing may throw either.
 *
 * SOAK_ACTIONS sets the length (default 600, at least 4 rounds); SOAK_SEED repeats a run.
 */
const ACTIONS = Math.max(Number(process.env.SOAK_ACTIONS ?? 600), 400);
const SEED = Number(process.env.SOAK_SEED ?? 20261008);
const ROUND = 100;
const ROUNDS = Math.floor(ACTIONS / ROUND);
/** The first rounds of each game load code and fill caches; the comparison starts after them. */
const WARMUP = 1;

/** A puzzle of each game from the bundled bank, with its solution (see e2e/). */
const SOLVED = {
	tetroid: { id: '496678832', size: 6, cells: '101111111000100101111111100001100000' },
	pinwheel: {
		id: '1027244002',
		size: 7,
		h: '00000001111110000011100101110000011110111100000010000000',
		v: '00001110001111100011110000101100001011000111011001110110'
	}
} as const;
const GAMES = ['tetroid', 'pinwheel'] as const;

type Game = (typeof GAMES)[number];

/** Rare actions sit in a "More actions" menu on narrow screens and in plain sight on wide ones. */
async function more(page: Page) {
	const button = page.getByRole('button', { name: 'More actions' });
	if (await button.isVisible()) await button.click();
}

/**
 * Agrees to the app's question, if it asks (before an unfinished game is lost). `always`: the
 * action asks every time.
 */
async function agree(page: Page, always = false) {
	const dialog = page.getByRole('alertdialog');
	try {
		await dialog.waitFor({ timeout: always ? 5000 : 500 });
	} catch (e) {
		if (always) throw e;
		return;
	}
	// The buttons: Close (✕), Cancel and the action.
	await dialog.getByRole('button').last().click();
	await expect(dialog).toBeHidden();
}

/** Opens the game's solved puzzle by its ID and solves it, which plays the celebration. */
async function solve(page: Page, game: Game) {
	const p = SOLVED[game];
	await page.getByLabel('Open puzzle by ID').fill(p.id);
	await page.getByRole('button', { name: 'Open', exact: true }).click();
	await agree(page);
	await expect
		.poll(async () =>
			(await page.locator('.font-mono.select-all').textContent())?.replace(/\D/g, '')
		)
		.toBe(p.id);
	const grid = (await board(page).locator('rect').first().boundingBox())!;
	const cell = grid.width / p.size;
	const clicks =
		'cells' in p
			? [...p.cells].flatMap((c, i) =>
					c === '1' ? [[(i % p.size) + 0.5, Math.floor(i / p.size) + 0.5]] : []
				)
			: [
					...[...p.h].flatMap((c, k) => (c === '1' ? [[(k % 7) + 0.5, Math.floor(k / 7)]] : [])),
					...[...p.v].flatMap((c, k) => (c === '1' ? [[k % 8, Math.floor(k / 8) + 0.5]] : []))
				];
	// A puzzle opened again keeps its progress; start over so that every click toggles on.
	await more(page);
	await page.getByRole('button', { name: 'Start over' }).click();
	await agree(page, true);
	for (const [x, y] of clicks) await page.mouse.click(grid.x + x * cell, grid.y + y * cell);
	await expect(page.locator('.solved-glow')).toHaveCount(1);
	// Let the celebration finish.
	await expect(page.locator('.solved-burst')).toHaveCount(0, { timeout: 10_000 });
}

/** Waits until no generator job and no animation frame is pending, then measures. */
async function settle(page: Page, cdp: CDPSession) {
	await expect
		.poll(
			async () => {
				const { jobs, frames } = await resources(page, cdp);
				return { jobs, frames };
			},
			{ timeout: 15_000 }
		)
		.toEqual({ jobs: 0, frames: 0 });
	return resources(page, cdp);
}

async function session(page: Page, name: string, touch: boolean) {
	const errors: string[] = [];
	/** What the session was doing, so that an error says where it came from. */
	let step = 'start';
	page.on('pageerror', (e) => errors.push(`${e.message} (${step})`));
	page.on('console', (m) => {
		// Without the optional server, API calls fail; that is expected here.
		if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
			const at = m.location();
			errors.push(`${m.text()} (${step}; ${at.url}:${at.lineNumber})`);
		}
	});
	// The app asks in its own dialog, never with the browser's.
	page.on('dialog', (d) => {
		errors.push(`browser dialog: ${d.message()}`);
		d.dismiss().catch(() => {});
	});
	await prepare(page);
	await trackResources(page);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Performance.enable');
	const rnd = random(SEED);
	const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

	await page.goto(`/${GAMES[0]}?v=10n`);
	await expect(board(page)).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');

	const point = async () => {
		const box = (await board(page).boundingBox())!;
		return {
			x: box.x + (0.05 + rnd() * 0.9) * box.width,
			y: box.y + (0.05 + rnd() * 0.9) * box.height
		};
	};
	const swipe = async (a: { x: number; y: number }, b: { x: number; y: number }) => {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
		for (let s = 1; s <= 6; s++) {
			const p = { x: a.x + ((b.x - a.x) * s) / 6, y: a.y + ((b.y - a.y) * s) / 6 };
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
		}
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	};
	const puzzleId = () => page.locator('.font-mono.select-all').textContent();
	const newPuzzle = async () => {
		// Puzzles come from the collection or are generated on the device (in a worker).
		// Large ones take long to generate, so those always come from the collection.
		const large = /^(15|20)/.test(new URL(page.url()).searchParams.get('v') ?? '');
		await page.evaluate(
			(s) => localStorage.setItem('vp:puzzleSource', JSON.stringify(s)),
			large ? 'bank' : pick(['bank', 'device'])
		);
		const before = await puzzleId();
		await page.getByRole('button', { name: 'New puzzle' }).click();
		await agree(page);
		await expect(page.locator('.font-mono.select-all')).not.toHaveText(before ?? '', {
			timeout: 30_000
		});
	};
	const menu = async (open: boolean) => {
		if (!touch) return;
		if (open) await page.getByRole('button', { name: 'Puzzle types and rules' }).click();
		else await page.getByRole('button', { name: 'Close menu' }).last().click();
	};
	const switchGame = async (game: Game) => {
		// Through the app, so that pages and boards mount and unmount.
		await page.getByRole('navigation', { name: 'Main' }).getByRole('link').first().click();
		await page.locator(`main a[href$="/${game}"]`).first().click();
		await expect(board(page)).toBeVisible({ timeout: 30_000 });
	};

	/** Special actions at fixed points of a round; random moves everywhere else. */
	const specials: Record<number, () => Promise<void>> = {
		10: async () => {
			// Another puzzle type from the menu.
			await menu(true);
			// Sizes only: a special stays the same puzzle on "New puzzle".
			const types = page
				.getByRole('navigation', { name: 'Puzzle type' })
				.getByRole('button', { name: /^\d+×\d+ (Normal|Hard)$/ });
			await types.nth(Math.floor(rnd() * (await types.count()))).click();
			if (touch && (await page.getByRole('button', { name: 'Close menu' }).last().isVisible())) {
				await menu(false);
			}
			await expect(board(page)).toBeVisible({ timeout: 30_000 });
		},
		25: async () => {
			await page.getByRole('button', { name: 'Settings' }).first().click();
			await expect(page.locator('dialog[open]')).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(page.locator('dialog[open]')).toHaveCount(0);
		},
		35: newPuzzle,
		45: async () => {
			if (touch) return;
			await page.getByRole('button', { name: 'Zoom' }).first().click();
			await page.getByRole('button', { name: 'Zoom' }).first().click();
		},
		55: async () => {
			// Checkpoints by keyboard: save, then add another.
			await board(page).focus();
			await page.keyboard.press('Control+s');
			await page.keyboard.press('Control+Shift+s');
		},
		65: async () => {
			// The share panel renders a screenshot of the board.
			await more(page);
			await page.getByRole('button', { name: 'Share board' }).click();
			await page.getByRole('button', { name: 'Close share panel' }).click();
		},
		75: async () => {
			await board(page).focus();
			for (let i = 0; i < 12; i++) {
				await page.keyboard.press(pick(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']));
				if (rnd() < 0.5) await page.keyboard.press(pick(['Space', 'Enter', 'x']));
			}
		},
		85: newPuzzle
	};

	const rounds: { round: number; game: Game; resources: Resources }[] = [];
	for (let round = 0; round < ROUNDS; round++) {
		const game = GAMES[round % 2];
		if (round > 0) await switchGame(game);
		for (let k = 1; k < ROUND; k++) {
			step = `round ${round}, action ${k}`;
			if (specials[k]) {
				await specials[k]();
				continue;
			}
			const kind = pick(['tap', 'tap', 'drag', 'drag', 'undo', 'redo']);
			step += ` (${kind})`;
			if (kind === 'tap') {
				const p = await point();
				if (touch) await page.touchscreen.tap(p.x, p.y);
				else await page.mouse.click(p.x, p.y, { button: rnd() < 0.2 ? 'right' : 'left' });
			} else if (kind === 'drag') {
				const [a, b] = [await point(), await point()];
				if (touch) await swipe(a, b);
				else {
					await page.mouse.move(a.x, a.y);
					await page.mouse.down();
					await page.mouse.move(b.x, b.y, { steps: 8 });
					await page.mouse.up();
				}
			} else {
				const button = page.getByRole('button', { name: kind === 'undo' ? 'Undo' : 'Redo' });
				if (await button.first().isEnabled()) await button.first().click();
			}
		}
		// Every round of a game ends in the same state: its solved puzzle.
		step = `round ${round}, solve`;
		await menu(true);
		await solve(page, game);
		rounds.push({ round, game, resources: await settle(page, cdp) });
	}

	mkdirSync('test-results', { recursive: true });
	writeFileSync(`test-results/soak-${name}.json`, JSON.stringify({ seed: SEED, rounds }, null, 2));
	for (const r of rounds) console.log(JSON.stringify(r));

	expect(errors).toEqual([]);
	const ends = GAMES.map((game) => {
		const own = rounds.filter((r) => r.game === game);
		return { game, own, base: own[WARMUP].resources, end: own[own.length - 1].resources };
	});
	// DOM nodes kept alive fail the checks below. Before they do, save what keeps them alive: a
	// heap snapshot and the paths to them (test-results/ is a CI artifact), for a leak that does
	// not show up on every run.
	if (
		ends.some(
			({ base, end }) =>
				end.nodes >= base.nodes * 1.1 + 200 ||
				end.detachedNodes >= base.detachedNodes + 200 ||
				end.jsListeners >= base.jsListeners * 1.1 + 50
		)
	) {
		const file = `test-results/soak-${name}-detached`;
		const report = (await detachedReport(cdp, file)).split('\n');
		console.log([...report.slice(0, 80), `(all ${report.length} lines in ${file}.txt)`].join('\n'));
	}
	for (const { game, own, base, end } of ends) {
		const where = `${name}, ${game}, round ${own[WARMUP].round} → ${own[own.length - 1].round}`;
		// Some growth is caches and lazily loaded code; a leak grows with every round.
		// The heap varies a little from round to round, so compare the average of the first and
		// the last third of the rounds. Loaded code and compiled functions account for some growth;
		// keeping every puzzle collection ever opened in memory grew 2.5 MB in 2000 actions.
		const heap = own.slice(WARMUP).map((r) => r.resources.heapMB);
		const third = Math.max(1, Math.floor(heap.length / 3));
		const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
		const [early, late] = [mean(heap.slice(0, third)), mean(heap.slice(-third))];
		expect(late, `heap (${where})`).toBeLessThan(early * 1.1 + 1.5);
		expect(end.nodes, `DOM nodes (${where})`).toBeLessThan(base.nodes * 1.1 + 200);
		expect(end.detachedNodes, `detached nodes (${where})`).toBeLessThan(base.detachedNodes + 200);
		expect(end.jsListeners, `listeners (${where})`).toBeLessThan(base.jsListeners * 1.1 + 50);
		// Things the app creates and must clean up again exist at the end exactly as often as
		// before: a page that leaves one behind leaves one more every round.
		expect(end.intervals, `intervals (${where})`).toBeLessThanOrEqual(base.intervals);
		expect(end.timeouts, `pending timeouts (${where})`).toBeLessThanOrEqual(base.timeouts + 2);
		expect(end.observers, `observers (${where})`).toBeLessThanOrEqual(base.observers);
		expect(end.objectURLs, `object URLs (${where})`).toBe(0);
		expect(end.workers, `workers (${where})`).toBeLessThanOrEqual(1);
		for (const [key, n] of Object.entries(end.listeners)) {
			expect(n, `${key} listeners (${where})`).toBeLessThanOrEqual(base.listeners[key] ?? 0);
		}
		// Saved games and settings stay far below the browser's 5 MB storage limit, and the
		// offline cache does not keep growing.
		expect(end.storage, `localStorage (${where})`).toBeLessThan(1_000_000);
		expect(end.storageUsage, `storage usage (${where})`).toBeLessThan(
			base.storageUsage + 2 * 2 ** 20
		);
	}
}

test.describe('soak', () => {
	test('a leak report names what keeps detached nodes alive', async ({ page }) => {
		await prepare(page);
		await page.goto('/tetroid?v=6n');
		await expect(board(page)).toBeVisible({ timeout: 30_000 });
		await page.evaluate(() => {
			const old = document.querySelector('main')!.cloneNode(true);
			(window as unknown as { leakyCache: unknown }).leakyCache = { old };
		});
		const cdp = await page.context().newCDPSession(page);
		const report = await detachedReport(cdp, 'test-results/soak-report-check');
		// The largest detached subtree comes first, with its path from the window.
		expect(report).toMatch(
			/nodes:\n {4}Window[^\n]*\n {4}Object ←leakyCache\n {4}<main[^\n]* ←old/
		);
	});

	test(`a desktop session of ${ROUNDS * ROUND} actions stays healthy`, async ({ page }) => {
		await session(page, 'desktop', false);
	});

	test.describe('touch', () => {
		test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
		test(`a phone session of ${ROUNDS * ROUND} actions stays healthy`, async ({ page }) => {
			await session(page, 'phone', true);
		});
	});
});
