import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { dealt, turn, type PipesPuzzle } from '../src/lib/games/pipes/rules';
import { solvePipes } from '../src/lib/games/pipes/solver';

// The first 5×5 Normal puzzle of the bundled collection, and its solution.
const { id, puzzle } = JSON.parse(readFileSync('static/puzzles/pipes/5n/0000.json', 'utf8'))
	.puzzles[0] as { id: number; puzzle: PipesPuzzle };
const [solution] = solvePipes(puzzle, 1).solutions;
const start = dealt(puzzle);
/** Clicks that turn tile `c` from how it was dealt into its place. */
const clicksFor = (c: number) => [0, 1, 2, 3].find((q) => turn(start[c], q) === solution[c])!;

/** The sides as `[dx, dy]` from a tile's middle, clockwise from the top. */
const SIDE = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0]
];

async function open(page: Page, settings?: Record<string, boolean>) {
	await page.addInitScript((values) => {
		localStorage.setItem('vp:tutorialSeen:pipes', 'true');
		if (values) {
			localStorage.setItem('vp:settings:pipes', JSON.stringify({ values, updatedAt: 1 }));
		}
	}, settings);
	await page.goto(`/pipes?v=5n&id=${id}`);
	const board = page.getByRole('application', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	// The first rect is the 5×5 grid itself, inside the board's padding.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 5;
	const at = (c: number) =>
		[grid.x + ((c % 5) + 0.5) * cell, grid.y + (Math.floor(c / 5) + 0.5) * cell] as const;
	/** A point near side `k` of tile `c`, inside the tile. */
	const near = (c: number, k: number) => {
		const [x, y] = at(c);
		return [x + SIDE[k][0] * cell * 0.4, y + SIDE[k][1] * cell * 0.4] as const;
	};
	return {
		board,
		at,
		near,
		tile: (c: number) => board.locator(`[data-tile="${c}"]`),
		mark: (key: string) => board.locator(`[data-mark="${key}"]`),
		click: (c: number, options?: { button: 'right' }) => page.mouse.click(...at(c), options),
		note: (c: number, k: number, options?: { button: 'right' }) =>
			page.mouse.click(...near(c, k), options),
		tool: (name: string) => page.getByRole('button', { name }).filter({ visible: true }).click()
	};
}

/** An inner tile of the 5×5 puzzle that lies wrong as dealt. */
const inner = [6, 7, 8, 11, 12, 13, 16, 17, 18].find((c) => start[c] !== solution[c])!;

test('Pipes has its daily puzzle and its tutorial on the home page', async ({ page }) => {
	await page.goto('/');
	const card = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('heading', { name: 'Pipes' }) });
	await expect(card.getByRole('link', { name: /Daily puzzle waiting/ })).toBeVisible();
	await expect(card.getByRole('link', { name: 'Learn Pipes' })).toBeVisible();
	await expect(card.getByText('Early access')).toHaveCount(0);
});

test('a collection puzzle is solved by turning its tiles', { tag: '@webkit' }, async ({ page }) => {
	const { board, click } = await open(page);
	// No pipe may lead off the board: the dealt tiles that do show red at once.
	expect(await board.locator('.pipe-error').count()).toBeGreaterThan(0);
	for (let c = 0; c < 25; c++) for (let q = 0; q < clicksFor(c); q++) await click(c);
	await expect(board.locator('[data-water]')).toHaveCount(25);
	await expect(board.locator('.pipe-error')).toHaveCount(0);
	await expect(page.getByText(/Solved in/).first()).toBeVisible();
});

test('a click turns a tile, Shift+click turns it back, a right click locks it', async ({
	page
}) => {
	const { tile, click } = await open(page);
	const undo = page.getByRole('button', { name: 'Undo' }).filter({ visible: true });
	const first = String(start[0]);
	await click(0);
	await expect(tile(0)).toHaveAttribute('data-mask', String(turn(start[0], 1)));
	await page.keyboard.down('Shift');
	await click(0);
	await page.keyboard.up('Shift');
	await expect(tile(0)).toHaveAttribute('data-mask', first);

	// The right button locks the tile instead of opening the browser's menu.
	await page.evaluate(() =>
		window.addEventListener('contextmenu', (e) => {
			(window as unknown as { menu: boolean }).menu = !e.defaultPrevented;
		})
	);
	await click(0, { button: 'right' });
	await expect(tile(0)).toHaveAttribute('data-locked', '1');
	expect(await page.evaluate(() => (window as unknown as { menu: boolean }).menu)).toBe(false);

	// A locked tile only shakes: no turn, and nothing to undo but the lock.
	await click(0);
	await expect(tile(0).locator('g.shake')).toHaveCount(1);
	await expect(tile(0)).toHaveAttribute('data-mask', first);
	await undo.click();
	await expect(tile(0)).not.toHaveAttribute('data-locked');
	await expect(tile(0)).toHaveAttribute('data-mask', first);
});

test('undo takes turns back, and a new move clears redo', async ({ page }) => {
	const { tile, click } = await open(page);
	const undo = page.getByRole('button', { name: 'Undo' }).filter({ visible: true });
	const redo = page.getByRole('button', { name: 'Redo' }).filter({ visible: true });
	for (let i = 0; i < 3; i++) await click(1);
	await expect(tile(1)).toHaveAttribute('data-mask', String(turn(start[1], 3)));
	for (let i = 0; i < 3; i++) await undo.click();
	await expect(tile(1)).toHaveAttribute('data-mask', String(start[1]));
	await expect(undo).toBeDisabled();
	await expect(redo).toBeEnabled();
	await click(2);
	await expect(redo).toBeDisabled();
});

test('the Lock tool locks every tile dragged over; a drag from a locked tile unlocks', async ({
	page
}) => {
	const { board, at } = await open(page);
	const locked = board.locator('[data-locked]');
	await page.getByRole('button', { name: 'Lock' }).filter({ visible: true }).click();
	const drag = async (from: number, to: number) => {
		await page.mouse.move(...at(from));
		await page.mouse.down();
		await page.mouse.move(...at(to), { steps: 8 });
		await page.mouse.up();
	};
	await drag(0, 4);
	await expect(locked).toHaveCount(5);
	await drag(0, 2);
	await expect(locked).toHaveCount(2);
	await expect(board.locator('[data-tile="3"][data-locked]')).toHaveCount(1);
});

test('the keys turn and lock the tile under the cursor', async ({ page }) => {
	const { board, tile } = await open(page);
	const speech = page.getByTestId('board-speech');
	const source = 12;
	await board.focus();
	// The first arrow shows the cursor on the source.
	await page.keyboard.press('ArrowRight');
	await expect(speech).toHaveText(/^Row 3, column 3: .+ \(source/);
	await page.keyboard.press('Space');
	await expect(tile(source)).toHaveAttribute('data-mask', String(turn(start[source], 1)));
	await page.keyboard.press('Shift+Space');
	await expect(tile(source)).toHaveAttribute('data-mask', String(start[source]));
	await page.keyboard.press('l');
	await expect(tile(source)).toHaveAttribute('data-locked', '1');
	await expect(speech).toContainText('locked');
	await page.keyboard.press('Space');
	await expect(tile(source)).toHaveAttribute('data-mask', String(start[source]));
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('Space');
	await expect(tile(11)).toHaveAttribute('data-mask', String(turn(start[11], 1)));
});

test('the hint tints a tile first, then says how to turn it', async ({ page }) => {
	const { board } = await open(page);
	const spotlight = board.locator('g.spotlight > *');
	await page.getByRole('button', { name: 'Hint', exact: true }).click();
	await expect(page.getByRole('status')).toContainText(/edge of the board/);
	await expect(spotlight).toHaveCount(0);
	await expect(board.locator('g.area > *')).toHaveCount(1);
	await page.getByRole('button', { name: 'Show the step' }).click();
	await expect(spotlight).toHaveCount(1);
	await expect(page.getByRole('status')).toContainText(/(Turn it .+ and lock it|lock it)\.$/);
});

test('the Note tool notes a side "=" with a click, "x" with a right click', async ({ page }) => {
	const { mark, note, click, tile, tool } = await open(page);
	await tool('Note');
	await note(6, 1);
	await expect(mark('r:6')).toHaveAttribute('data-value', 'join');
	await note(6, 2, { button: 'right' });
	await expect(mark('d:6')).toHaveAttribute('data-value', 'cross');
	// The same side seen from the tile below.
	await note(11, 0, { button: 'right' });
	await expect(mark('d:6')).toHaveCount(0);
	await note(6, 1);
	await expect(mark('r:6')).toHaveCount(0);
	// The edge of a board without wrap takes no notes.
	await note(0, 0);
	await note(0, 3, { button: 'right' });
	await expect(page.locator('[data-mark]')).toHaveCount(0);

	// Notes stay put while the tile turns, and undo takes them back.
	await note(6, 1);
	await tool('Turn');
	await click(6);
	await expect(tile(6)).not.toHaveAttribute('data-mask', String(start[6]));
	await expect(mark('r:6')).toHaveCount(1);
	const undo = page.getByRole('button', { name: 'Undo' }).filter({ visible: true });
	await undo.click();
	await undo.click();
	await expect(mark('r:6')).toHaveCount(0);
	await expect(tile(6)).toHaveAttribute('data-mask', String(start[6]));
});

test('with the Note tool, a drag notes "=" from tile to tile, the keys too', async ({ page }) => {
	const { board, at, mark, tool } = await open(page);
	await tool('Note');
	await page.mouse.move(...at(6));
	await page.mouse.down();
	await page.mouse.move(...at(8), { steps: 8 });
	await page.mouse.move(...at(13), { steps: 8 });
	await page.mouse.up();
	await expect(board.locator('[data-mark][data-value="join"]')).toHaveCount(3);
	for (const key of ['r:6', 'r:7', 'd:8']) await expect(mark(key)).toHaveCount(1);
	// A drag that begins on a noted side takes the notes away.
	await page.mouse.move(...at(6));
	await page.mouse.down();
	await page.mouse.move(...at(8), { steps: 8 });
	await page.mouse.up();
	await expect(board.locator('[data-mark]')).toHaveCount(1);

	// The keys: Ctrl with the arrows notes "=", Shift with the arrows "x".
	await board.focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.down('Control');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.up('Control');
	await expect(mark('r:12')).toHaveAttribute('data-value', 'join');
	await page.keyboard.down('Shift');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.up('Shift');
	await expect(mark('d:13')).toHaveAttribute('data-value', 'cross');
});

test('notes turn a tile only into ways that fit them, and show a tile none fits', async ({
	page
}) => {
	const { board, mark, note, click, tile, tool } = await open(page);
	await tool('Note');
	// "=" where the solution has a pipe, "x" where it has none: only that way fits.
	for (let k = 0; k < 4; k++) {
		await note(inner, k, solution[inner] & (1 << k) ? undefined : { button: 'right' });
	}
	await expect(board.locator('[data-mark]')).toHaveCount(4);
	await tool('Turn');
	await click(inner);
	await expect(tile(inner)).toHaveAttribute('data-mask', String(solution[inner]));
	await click(inner);
	await expect(tile(inner).locator('g.shake')).toHaveCount(1);
	await expect(tile(inner)).toHaveAttribute('data-mask', String(solution[inner]));
	await expect(board.locator('[data-unfit]')).toHaveCount(0);

	// "=" on all four sides: no tile fits that, so it turns red, and turns as usual.
	await tool('Note');
	for (let k = 0; k < 4; k++) if (!(solution[inner] & (1 << k))) await note(inner, k);
	await expect(board.locator(`[data-unfit="${inner}"]`)).toHaveCount(1);
	await expect(board.locator('[data-unfit]')).toHaveCount(1);
	await tool('Turn');
	await click(inner);
	await expect(tile(inner)).toHaveAttribute('data-mask', String(turn(solution[inner], 1)));
	await expect(mark('r:' + inner)).toHaveCount(1);
});

test('both note settings can be turned off', async ({ page }) => {
	const { board, note, click, tile, tool } = await open(page, {
		markErrors: false,
		turnToMarks: false
	});
	await tool('Note');
	for (let k = 0; k < 4; k++) await note(inner, k);
	await expect(board.locator('[data-mark]')).toHaveCount(4);
	await expect(board.locator('[data-unfit]')).toHaveCount(0);
	// No tile fits "=" on all four sides, yet it neither turns red nor skips a way.
	await tool('Turn');
	await click(inner);
	await expect(tile(inner)).toHaveAttribute('data-mask', String(turn(start[inner], 1)));
});

test('the hint points at a wrong note first', async ({ page }) => {
	const { board, note, tool } = await open(page);
	await tool('Note');
	const k = [0, 1, 2, 3].find((k) => !(solution[inner] & (1 << k)))!;
	await note(inner, k);
	await page.getByRole('button', { name: 'Hint', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('notes are wrong');
	await expect(board.locator('g.spotlight[data-mistake] > *')).toHaveCount(1);
	// Taken back, the note leaves the highlight, and the hint goes.
	await note(inner, k);
	await expect(board.locator('g.spotlight > *')).toHaveCount(0);
});

test.describe('on a touch screen', () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	test('a tap turns a tile, holding it locks it', async ({ page }) => {
		const { tile, at } = await open(page);
		const [x, y] = at(6);
		await page.touchscreen.tap(x, y);
		await expect(tile(6)).toHaveAttribute('data-mask', String(turn(start[6], 1)));
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
		await page.waitForTimeout(600);
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect(tile(6)).toHaveAttribute('data-locked', '1');
		await expect(tile(6)).toHaveAttribute('data-mask', String(turn(start[6], 1)));
	});

	test('with the Note tool, a tap notes "=", holding notes "x"', async ({ page }) => {
		const { near, mark, tool } = await open(page);
		await tool('Note');
		await page.touchscreen.tap(...near(6, 1));
		await expect(mark('r:6')).toHaveAttribute('data-value', 'join');
		const [x, y] = near(6, 2);
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
		await page.waitForTimeout(600);
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect(mark('d:6')).toHaveAttribute('data-value', 'cross');
		await expect(page.locator('[data-tile="6"][data-locked]')).toHaveCount(0);
	});
});

test('a board with wrap shows the pipes that cross its edge', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:pipes', 'true'));
	await page.goto('/pipes?v=7w');
	const board = page.getByRole('application', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	// The puzzle types have a column for wrap.
	const type = page.getByRole('button', { name: '7×7 Wrap', exact: true });
	await expect(type).toHaveText('Wrap');
	await expect(type).toHaveAttribute('aria-current', 'true');
	// The frame is dashed: the board goes on across it.
	await expect(board.locator('rect[stroke-dasharray]')).toHaveCount(1);
});
