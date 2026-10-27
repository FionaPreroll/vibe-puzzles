import { expect, test, type Page } from '@playwright/test';
import { puzzleCheck } from '../src/lib/core/filmLink';
import { encodePuzzleId } from '../src/lib/core/variants';
import { LOOP_VARIANTS } from '../src/lib/games/loop/logic';

/** The Inside page: the Sudoku film and its player (issue #170). */

async function open(page: Page) {
	await page.goto('/inside');
	// The player answers once the page has hydrated.
	await page.waitForLoadState('networkidle');
	return {
		caption: page.getByTestId('caption'),
		step: page.getByTestId('step'),
		play: page.getByTestId('play'),
		position: page.getByRole('slider', { name: 'Position in the film' }),
		chapters: page.getByRole('group', { name: 'Chapters' }),
		/** The digits on the board. */
		digits: page
			.locator('[data-testid="film"] .board-stage svg text')
			.filter({ hasText: /^[1-9]$/ })
	};
}

/** "Step n of count" as [n, count]. */
async function stepOf(page: Page): Promise<[number, number]> {
	const text = (await page.getByTestId('step').textContent()) ?? '';
	const [, n, count] = text.match(/(\d+) of (\d+)/)!;
	return [Number(n), Number(count)];
}

test('the film plays, pauses and steps like a video', async ({ page }) => {
	const p = await open(page);
	await expect(p.caption).toHaveText(/^Every Sudoku starts empty/);
	await expect(p.digits).toHaveCount(0);
	const [first, count] = await stepOf(page);
	expect(first).toBe(1);
	expect(count).toBeGreaterThan(150);

	await p.play.click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await expect.poll(async () => (await stepOf(page))[0], { timeout: 10_000 }).toBeGreaterThan(2);
	await page.getByRole('button', { name: 'Pause' }).click();
	const [paused] = await stepOf(page);
	await page.waitForTimeout(1500);
	expect((await stepOf(page))[0]).toBe(paused);
	// The first digits are on the board.
	expect(await p.digits.count()).toBeGreaterThan(0);

	await page.getByRole('button', { name: 'One step forward' }).click();
	expect((await stepOf(page))[0]).toBe(paused + 1);
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	expect((await stepOf(page))[0]).toBe(paused - 1);
	// Space plays and pauses, also while a button has the focus.
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('chapters, the scrubber, speeds and details', async ({ page }) => {
	const p = await open(page);
	const chapter = (name: string) => p.chapters.getByRole('button', { name });

	// The next chapter starts from the full grid.
	await page.keyboard.press('PageDown');
	await expect(chapter('2. Digging')).toHaveAttribute('aria-current', 'step');
	await expect(p.caption).toHaveText(/^Now digits come out again/);
	await expect(p.digits).toHaveCount(81);
	// Back on the chapter's first frames goes to the chapter before.
	await page.getByRole('button', { name: 'Back to the start of the chapter' }).click();
	await expect(chapter('1. A full grid')).toHaveAttribute('aria-current', 'step');
	await expect(p.caption).toHaveText(/^Every Sudoku starts empty/);

	await chapter('3. Solving like a person').click();
	await expect(p.caption).toHaveText(/^To grade it/);
	// Pencil marks: every empty cell lists its candidates.
	expect(await page.locator('[data-testid="film"] .board-stage svg text').count()).toBeGreaterThan(
		81
	);

	const [, count] = await stepOf(page);
	await p.position.fill(String(count - 1));
	await expect(p.step).toHaveText(`Step ${count} of ${count}`);
	await expect(p.caption).toHaveText(/^Solved with \d+ singles/);
	await expect(p.digits).toHaveCount(81);
	await page.keyboard.press('Home');
	await expect(p.step).toHaveText(`Step 1 of ${count}`);

	// Faster: several frames in the time that one slow frame takes.
	await page.getByRole('button', { name: '4×' }).click();
	await expect(page.getByRole('button', { name: '4×' })).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('End');
	await page.keyboard.press('Home');
	await p.play.click();
	await expect.poll(async () => (await stepOf(page))[0], { timeout: 4_000 }).toBeGreaterThan(5);
	await page.getByRole('button', { name: 'Pause' }).click();

	const details = page.getByTestId('detail');
	await expect(details).toHaveCount(0);
	await page.getByRole('button', { name: 'More detail' }).click();
	await expect(details).toContainText('Backtracking search');
	await page.getByRole('button', { name: 'More detail' }).click();
	await expect(details).toHaveCount(0);
});

test('another example starts the film over with another puzzle', async ({ page }) => {
	const p = await open(page);
	await page.keyboard.press('PageDown');
	await page.keyboard.press('PageDown');
	const [, count] = await stepOf(page);
	await p.position.fill(String(count - 1));
	const before = await page.locator('[data-testid="film"] .board-stage').innerHTML();
	await page.getByRole('button', { name: 'Another example' }).click();
	await expect(p.step).toHaveText(/^Step 1 of \d+$/);
	await expect(p.caption).toHaveText(/^Every Sudoku starts empty/);
	const [, other] = await stepOf(page);
	await p.position.fill(String(other - 1));
	await expect(p.caption).toHaveText(/^Solved with/);
	expect(await page.locator('[data-testid="film"] .board-stage').innerHTML()).not.toBe(before);
});

test('the Pinwheel film: galaxies grow, a second solution is cut away, propagation gets stuck', async ({
	page
}) => {
	const p = await open(page);
	const films = page.getByRole('group', { name: 'Films' });
	await films.getByRole('button', { name: 'Pinwheel' }).click();
	await expect(films.getByRole('button', { name: 'Pinwheel' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('heading', { name: 'How a Pinwheel is made' })).toBeVisible();
	await expect(p.caption).toHaveText(/^A Pinwheel board is split into galaxies/);
	await expect(p.step).toHaveText(/^Step 1 of \d+$/);

	await page.keyboard.press('PageDown');
	await expect(p.chapters.getByRole('button', { name: /^2\. One solution only/ })).toHaveAttribute(
		'aria-current',
		'step'
	);
	await expect(p.caption).toHaveText(/^The player will see only the centres/);
	const trial = page.locator('[data-testid="film"] [data-trial]');
	await expect(trial).toHaveCount(0);
	await page.keyboard.press('ArrowRight');
	await expect(p.caption).toHaveText(/^It finds one/);
	// The other solution's lines, in the trial colour.
	expect(await trial.count()).toBeGreaterThan(0);
	await page.keyboard.press('ArrowRight');
	await expect(p.caption).toHaveText(/^So one of those cells is cut out/);
	await expect(trial).toHaveCount(0);

	await page.keyboard.press('PageDown');
	await expect(p.caption).toHaveText(/^To grade the puzzle, the solver now only deduces/);
	await page.keyboard.press('End');
	await expect(p.caption).toHaveText(/^The solution, which the player has to find/);
	await page.keyboard.press('ArrowLeft');
	await expect(p.caption).toHaveText(
		'This was attempt 2. Before it: 1 too easy for Hard, 0 given up.'
	);
	await page.keyboard.press('ArrowLeft');
	await expect(p.caption).toHaveText(/^Stuck: 4 cells could still belong to more than one galaxy/);

	// Back to the Sudoku film, from its start.
	await films.getByRole('button', { name: 'Sudoku' }).click();
	await expect(p.caption).toHaveText(/^Every Sudoku starts empty/);
	await expect(p.step).toHaveText(/^Step 1 of \d+$/);
});

test('the Tetroid film: tetrominoes planted, regions grown and reshaped, then solved by deduction', async ({
	page
}) => {
	const p = await open(page);
	await page.getByRole('group', { name: 'Films' }).getByRole('button', { name: 'Tetroid' }).click();
	await expect(page.getByRole('heading', { name: 'How a Tetroid is made' })).toBeVisible();
	await expect(p.caption).toHaveText(/^A Tetroid solution is a chain of tetrominoes/);
	await page.keyboard.press('ArrowRight');
	await expect(p.caption).toHaveText(/^It plants a tetromino/);

	await page.keyboard.press('PageDown');
	await expect(p.caption).toHaveText(/^A free cell joins a neighbouring region/);
	await page.keyboard.press('PageDown');
	await expect(p.chapters.getByRole('button', { name: /^3\. One way only/ })).toHaveAttribute(
		'aria-current',
		'step'
	);
	await expect(p.caption).toHaveText(/^This region could also hold the teal tetromino/);
	await page.getByRole('button', { name: 'More detail' }).click();
	await expect(page.getByTestId('detail')).toContainText('never breaks the planted solution');

	await page.keyboard.press('PageDown');
	await expect(p.caption).toHaveText(/^Solving by deduction/);
	await page.keyboard.press('End');
	await expect(p.caption).toHaveText(
		'Every region is settled, without guessing: this is the solution.'
	);
	await page.keyboard.press('ArrowLeft');
	await expect(p.caption).toHaveText(/^Looking ahead/);
});

test('the Loop film: a region grows, numbers come in and out, then the rules solve it', async ({
	page
}) => {
	const p = await open(page);
	await page.getByRole('group', { name: 'Films' }).getByRole('button', { name: 'Loop' }).click();
	await expect(page.getByRole('heading', { name: 'How a Loop is made' })).toBeVisible();
	await expect(p.caption).toHaveText(/^A Loop solution is one closed line/);
	const board = page.locator('[data-testid="film"] .board-stage svg');
	await page.keyboard.press('ArrowRight');
	await expect(p.caption).toHaveText(/^It starts with one random cell/);
	await expect(board.locator('[data-line]')).toHaveCount(4);
	// The first cell turned away: the loop it would make, its new lines in teal.
	for (let k = 0; k < 7; k++) await page.keyboard.press('ArrowRight');
	await expect(p.caption).toHaveText(/^With this cell, the loop would touch itself/);
	await expect(board.locator('[data-trial]')).not.toHaveCount(0);

	await page.keyboard.press('PageDown');
	await expect(
		p.chapters.getByRole('button', { name: /^2\. Numbers in, numbers out/ })
	).toHaveAttribute('aria-current', 'step');
	await expect(p.caption).toHaveText(/^Every cell gets a number/);
	await expect(board.locator('[data-clue]')).toHaveCount(49);
	await page.getByRole('button', { name: 'More detail' }).click();
	await expect(page.getByTestId('detail')).toContainText(
		'a 4 would be a loop around that one cell'
	);

	await page.keyboard.press('PageDown');
	await expect(p.caption).toHaveText(/^Solving it the way a person would/);
	await page.keyboard.press('End');
	await expect(p.caption).toHaveText(/^Every edge is decided after \d+ steps, without guessing/);
	await page.keyboard.press('ArrowLeft');
	await expect(p.caption).toHaveText(/^The loop is closed/);
});

test('a solved puzzle links to the film of how it was made', async ({ page }) => {
	// Pinwheel 7×7 Normal #1027244002 from the bundled collection, and its solution lines.
	const H = '00000001111110000011100101110000011110111100000010000000';
	const V = '00001110001111100011110000101100001011000111011001110110';
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:pinwheel', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
	await page.goto('/pinwheel?v=7n&id=1027244002');
	const board = page.locator('.overflow-x-auto svg[role="application"]');
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const more = page.getByRole('button', { name: 'More actions' });
	const howMade = page.getByRole('link', { name: 'How was this puzzle made?' });
	// Not before it is solved: the film shows the solution.
	await more.click();
	await expect(page.getByRole('button', { name: 'Print…' })).toBeVisible();
	await expect(howMade).toHaveCount(0);
	await page.keyboard.press('Escape');

	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 7;
	for (const [x, y] of [
		...[...H].flatMap((c, k) => (c === '1' ? [[(k % 7) + 0.5, Math.floor(k / 7)]] : [])),
		...[...V].flatMap((c, k) => (c === '1' ? [[k % 8, Math.floor(k / 8) + 0.5]] : []))
	]) {
		await page.mouse.click(grid.x + x * cell, grid.y + y * cell);
	}
	await expect(page.getByRole('button', { name: 'Share success' })).toBeVisible();
	await more.click();
	await expect(howMade).toHaveAttribute('href', /\/inside\?game=pinwheel&id=1027244002&p=\w+$/);
	await howMade.click();

	await expect(page.getByRole('heading', { name: 'How a Pinwheel is made' })).toBeVisible();
	await expect(page.getByTestId('asked')).toHaveText(
		'The making of puzzle 1,027,244,002 (7×7 Normal).'
	);
	const p = page.getByTestId('caption');
	await expect(p).toHaveText(/an empty 7×7 board\.$/);
	await page.keyboard.press('End');
	await expect(p).toHaveText('The solution, which the player has to find from the centres alone.');
	// Another example is another puzzle of the type: the address no longer names this one.
	await page.getByRole('button', { name: 'Another example' }).click();
	await expect(page.getByTestId('asked')).toHaveCount(0);
	await expect(p).toHaveText(/an empty 7×7 board\.$/);
	expect(new URL(page.url()).search).toBe('');
});

test('a puzzle without a film shows the example, and says why', async ({ page }) => {
	const index = LOOP_VARIANTS.findIndex((v) => v.key === '25x30n');
	await page.goto(`/inside?game=loop&id=${encodePuzzleId(index, 7)}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'How a Loop is made' })).toBeVisible();
	await expect(page.getByTestId('asked')).toHaveText(
		/^There is no film of puzzle [\d,]+ \(25×30 Normal\).*Here is how a 7×7 Normal Loop is made\.$/
	);
	await expect(page.getByTestId('caption')).toHaveText(/an empty 7×7 board\.$/);

	// Tetroid 6×6 Normal #496678832 in the collection, which an earlier generator made.
	const regions = [
		0, 0, 2, 2, 2, 2, 0, 0, 0, 1, 1, 1, 3, 3, 3, 1, 4, 4, 3, 1, 1, 1, 4, 4, 3, 3, 3, 3, 3, 4, 3, 3,
		3, 3, 3, 3
	];
	const p = puzzleCheck({ width: 6, height: 6, regions });
	await page.goto(`/inside?game=tetroid&id=496678832&p=${p}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('asked')).toHaveText(
		/^There is no film of puzzle 496,678,832: it comes from the puzzle collection/
	);
	// Picking a film of one's own leaves the puzzle behind.
	await page.getByRole('group', { name: 'Films' }).getByRole('button', { name: 'Sudoku' }).click();
	await expect(page.getByTestId('asked')).toHaveCount(0);
	expect(new URL(page.url()).search).toBe('');
});

test('the page speaks German, and the footer and About page lead to it', async ({ page }) => {
	await page.goto('/about');
	await page.getByRole('link', { name: 'Watch it step by step' }).click();
	await expect(page).toHaveURL(/\/inside$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inside the puzzles');
	await page.goto('/');
	await page.locator('footer').getByRole('link', { name: 'Inside' }).click();
	await expect(page).toHaveURL(/\/inside$/);

	await page.addInitScript(() => localStorage.setItem('vp:locale', 'de'));
	await page.goto('/inside');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hinter den Kulissen');
	await expect(page.getByTestId('caption')).toHaveText(/^Jedes Sudoku beginnt leer/);
	await page.getByRole('button', { name: 'Nächstes Kapitel' }).click();
	await expect(page.getByTestId('caption')).toHaveText(/^Jetzt kommen Ziffern wieder heraus/);
	await page.getByRole('button', { name: 'Genauer' }).click();
	await expect(page.getByTestId('detail')).toContainText('Bewertungs-Solver');
	await expect(page.getByTestId('step')).toHaveText(/^Schritt \d+ von \d+$/);
});

test('the service worker caches the page code when the page is opened, not on install', async ({
	page,
	context
}) => {
	await page.goto('/');
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
		}
	});
	const cached = () =>
		page.evaluate(async () => {
			const out: string[] = [];
			for (const name of await caches.keys()) {
				for (const r of await (await caches.open(name)).keys()) out.push(new URL(r.url).pathname);
			}
			return out;
		});
	const installed = new Set(await cached());
	expect([...installed].some((p) => p.includes('/_app/immutable/'))).toBe(true);

	await page.goto('/inside');
	await page.waitForLoadState('networkidle');
	const loaded = await page.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.map((e) => new URL(e.name).pathname)
			.filter((p) => p.endsWith('.js'))
	);
	// The page's own code was not part of the install...
	const own = loaded.filter((p) => !installed.has(p));
	expect(own.length).toBeGreaterThan(0);
	expect(own.every((p) => p.includes('/_app/immutable/nodes/'))).toBe(true);
	// ...and is kept once the page has been opened, so it plays offline too.
	await expect
		.poll(async () => {
			const now = new Set(await cached());
			return own.every((p) => now.has(p));
		})
		.toBe(true);
	await context.setOffline(true);
	await page.reload();
	await page.waitForLoadState('domcontentloaded');
	await page.getByRole('button', { name: 'Next chapter' }).click();
	await expect(page.getByTestId('caption')).toHaveText(/^Now digits come out again/);
	await context.setOffline(false);
});
