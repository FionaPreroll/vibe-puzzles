import { expect, test, type Page } from '@playwright/test';

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
