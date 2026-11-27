import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bridgesGraph, type BridgesPuzzle } from '../src/lib/games/bridges/rules';
import { solveBridges } from '../src/lib/games/bridges/solver';

// The 7×7 Normal puzzles of the bundled collection: the first one, and the first whose links
// cross somewhere.
const bank = JSON.parse(readFileSync('static/puzzles/bridges/7n/0000.json', 'utf8')).puzzles as {
	id: number;
	puzzle: BridgesPuzzle;
}[];
const { id, puzzle } = bank[0];
const [solution] = solveBridges(puzzle, 1).solutions;
const g = bridgesGraph(puzzle);
const crossing = bank.find((e) => bridgesGraph(e.puzzle).crossing.some((c) => c.length))!;

/** The first cell of water along link `l`, from its left or top island. */
const waterOf = (graph: typeof g, l: number) =>
	graph.cells[graph.ends[2 * l]] + (graph.across[l] ? 1 : puzzle.width);

async function open(page: Page, entry = { id, puzzle }) {
	await page.addInitScript(() => localStorage.setItem('vp:puzzleSource', '"bank"'));
	await page.goto(`/bridges?v=7n&id=${entry.id}`);
	const board = page.getByRole('application', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	// The first rect is the 7×7 grid itself, inside the board's padding.
	const grid = (await board.locator('rect').first().boundingBox())!;
	const cell = grid.width / 7;
	const at = (c: number) =>
		[grid.x + ((c % 7) + 0.5) * cell, grid.y + (Math.floor(c / 7) + 0.5) * cell] as const;
	return {
		board,
		at,
		click: (c: number, options?: { button: 'right' }) => page.mouse.click(...at(c), options),
		bridge: (l: number) => board.locator(`[data-bridge="${l}"]`),
		cross: (l: number) => board.locator(`[data-cross="${l}"]`)
	};
}

test('Bridges is listed in early access, with its daily puzzle and no tutorial', async ({
	page
}) => {
	await page.goto('/');
	const card = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('heading', { name: 'Bridges' }) });
	await expect(card.getByText('Early access')).toBeVisible();
	await expect(card.getByRole('link', { name: 'Learn Bridges' })).toHaveCount(0);
	await expect(card.getByRole('link', { name: /Daily puzzle/ })).toBeVisible();
});

test('every size is playable: a link to 25×25 Hard opens it', async ({ page }) => {
	await page.goto('/bridges?v=25h');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	await expect(page).toHaveURL(/v=25h/);
	await expect(page.getByRole('application', { name: 'Puzzle board' })).toBeVisible();
	for (const name of ['10×10 Normal', '15×15 Hard', '20×20 Normal', '25×25 Hard', 'Daily']) {
		await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
	}
	await expect(page.getByRole('button', { name: /Soon$/ })).toHaveCount(0);
});

test(
	'a collection puzzle is solved by building its bridges',
	{ tag: '@webkit' },
	async ({ page }) => {
		const { board, click } = await open(page);
		await expect(page.getByText('Early access').first()).toBeVisible();
		for (const [l, value] of solution.entries()) {
			for (let n = 0; n < value; n++) await click(waterOf(g, l));
		}
		await expect(board.locator('[data-bridge]')).toHaveCount(solution.filter(Boolean).length);
		await expect(page.getByText(/Solved in/).first()).toBeVisible();
	}
);

test('a click adds a bridge, round to none; the right button crosses the link out', async ({
	page
}) => {
	const { bridge, cross, click } = await open(page);
	const water = waterOf(g, 0);
	await click(water);
	await expect(bridge(0)).toHaveAttribute('data-value', '1');
	await click(water);
	await expect(bridge(0)).toHaveAttribute('data-value', '2');
	await click(water);
	await expect(bridge(0)).toHaveCount(0);

	// The right button crosses instead of opening the browser's menu.
	await page.evaluate(() =>
		window.addEventListener('contextmenu', (e) => {
			(window as unknown as { menu: boolean }).menu = !e.defaultPrevented;
		})
	);
	await click(water, { button: 'right' });
	await expect(cross(0)).toHaveCount(1);
	expect(await page.evaluate(() => (window as unknown as { menu: boolean }).menu)).toBe(false);
	// A click on the cross builds a bridge there.
	await click(water);
	await expect(cross(0)).toHaveCount(0);
	await expect(bridge(0)).toHaveAttribute('data-value', '1');

	const undo = page.getByRole('button', { name: 'Undo' }).filter({ visible: true });
	await undo.click();
	await expect(cross(0)).toHaveCount(1);
});

test('the Cross tool crosses links out, and no bridge goes across another', async ({ page }) => {
	const graph = bridgesGraph(crossing.puzzle);
	const w = crossing.puzzle.width;
	const l = graph.crossing.findIndex((c) => c.length);
	const m = graph.crossing[l][0];
	const cellsOf = (link: number) =>
		Array.from(graph.islandAt).flatMap((_, c) =>
			graph.acrossAt[c] === link || graph.downAt[c] === link ? [c] : []
		);
	// The water cell where the two cross.
	const middle = cellsOf(l).find((c) => cellsOf(m).includes(c))!;
	const { at, bridge, cross, click } = await open(page, crossing);
	await click(middle);
	const built = (await bridge(l).count()) ? l : m;
	const other = built === l ? m : l;
	await expect(bridge(built)).toHaveAttribute('data-value', '1');
	// Over the bridge, the other link takes none: a drag along it builds nothing.
	const step = graph.across[other] ? 1 : w;
	await page.mouse.move(...at(middle - step));
	await page.mouse.down();
	await page.mouse.move(...at(middle + step), { steps: 8 });
	await page.mouse.up();
	await expect(bridge(other)).toHaveCount(0);

	// The Cross tool crosses the other link out, away from the crossing, and clears it again.
	const aside = cellsOf(other).find((c) => c !== middle) ?? middle;
	await page.getByRole('button', { name: 'Cross' }).filter({ visible: true }).click();
	await click(aside);
	await expect(cross(other)).toHaveCount(1);
	await click(aside);
	await expect(cross(other)).toHaveCount(0);
});

test('a drag from island to island builds a bridge between each pair', async ({ page }) => {
	const { at, bridge } = await open(page);
	// The top row: the first island's link to the right, then the next one's.
	const [first, second] = [0, 1].map((n) => g.sides[n * 4 + 1]);
	const last = g.cells[g.ends[2 * second + 1]];
	await page.mouse.move(...at(g.cells[0]));
	await page.mouse.down();
	await page.mouse.move(...at(last), { steps: 12 });
	await page.mouse.up();
	await expect(bridge(first)).toHaveAttribute('data-value', '1');
	await expect(bridge(second)).toHaveAttribute('data-value', '1');
});

test('the keys build and cross out bridges under the cursor', async ({ page }) => {
	const { board, bridge, cross } = await open(page);
	const speech = page.getByTestId('board-speech');
	await board.focus();
	// The first arrow shows the cursor on the first island.
	await page.keyboard.press('ArrowRight');
	await expect(speech).toHaveText(`Row 1, column 1: island ${g.clue[0]}`);
	await page.keyboard.press('ArrowRight');
	await expect(speech).toHaveText('Row 1, column 2: water');
	await page.keyboard.press('Space');
	await expect(bridge(0)).toHaveAttribute('data-value', '1');
	await expect(speech).toHaveText('Row 1, column 2: a bridge across');
	await page.keyboard.press('Shift+Space');
	await expect(cross(0)).toHaveCount(1);
	await expect(speech).toHaveText('Row 1, column 2: crossed out across');

	// Back on the first island, Ctrl with the arrows builds a bridge along the way down.
	const down = g.sides[2];
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.down('Control');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.up('Control');
	await expect(bridge(down)).toHaveAttribute('data-value', '1');
});

test('the hint tints where to look, then points at the bridges', async ({ page }) => {
	const { board } = await open(page);
	const status = page.getByRole('status');
	await page.getByRole('button', { name: 'Hint' }).click();
	await expect(status).toContainText('Look at the tinted island');
	expect(await board.locator('g.area > *').count()).toBeGreaterThan(0);
	await page.getByRole('button', { name: 'Show the step' }).click();
	await expect(status).toContainText(/So .*bridge/);
	expect(await board.locator('g.spotlight > *').count()).toBeGreaterThan(0);
});
