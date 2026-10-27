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

async function open(page: Page) {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:pipes', 'true'));
	await page.goto(`/pipes?v=5n&id=${id}`);
	const board = page.getByRole('application', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	// The first rect is the 5×5 grid itself, inside the board's padding.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 5;
	const at = (c: number) =>
		[grid.x + ((c % 5) + 0.5) * cell, grid.y + (Math.floor(c / 5) + 0.5) * cell] as const;
	return {
		board,
		at,
		tile: (c: number) => board.locator(`[data-tile="${c}"]`),
		click: (c: number, options?: { button: 'right' }) => page.mouse.click(...at(c), options)
	};
}

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
