import { expect, test, type Page } from '@playwright/test';
import { colours as palette } from '../src/lib/core/palette';

/** Click the centre of cell (r, c) of a size×size board. */
async function clickCell(page: Page, size: number, r: number, c: number) {
	const box = (await page.getByRole('grid', { name: 'Puzzle board' }).boundingBox())!;
	// The board has a 3 px margin around the grid.
	const cell = (box.width - 6) / size;
	await page.mouse.click(box.x + 3 + (c + 0.5) * cell, box.y + 3 + (r + 0.5) * cell);
}

test('the Sudoku tutorial can be solved with the number pad', async ({ page }) => {
	await page.goto('/sudoku');
	await expect(page).toHaveURL(/\/sudoku\/tutorial$/);
	const pad = page.getByRole('toolbar', { name: 'Number pad' });
	// Solution: 1234 / 3412 / 2143 / 4321; the empty cells and their digits.
	const moves: [number, number, number][] = [
		[0, 2, 3],
		[1, 0, 3],
		[1, 3, 2],
		[2, 0, 2],
		[2, 3, 3],
		[3, 1, 3]
	];
	for (const [r, c, d] of moves) {
		await clickCell(page, 4, r, c);
		await pad.getByRole('button', { name: String(d), exact: true }).click();
	}
	await expect(page.getByText('Well done!')).toBeVisible();
});

test('Sudoku takes digits and notes from the keyboard and keeps them', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:sudoku', 'true'));
	await page.goto('/sudoku?v=9n');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	const board = page.getByRole('grid', { name: 'Puzzle board' });

	// Find an empty cell: arrow keys walk the board from the top-left cell.
	const text = async () => (await board.locator('text').allTextContents()).join('');
	await expect(board.locator('text').first()).toBeVisible();
	const before = await text();
	await clickCell(page, 9, 0, 0);
	let entered = false;
	for (let k = 0; k < 81 && !entered; k++) {
		await page.keyboard.press('7');
		entered = (await text()) !== before;
		if (!entered) await page.keyboard.press('ArrowRight');
	}
	expect(entered).toBe(true);
	// The same digit again clears it; Shift+digits add notes.
	await page.keyboard.press('7');
	expect(await text()).toBe(before);
	await page.keyboard.press('Shift+Digit1');
	await page.keyboard.press('Shift+Digit5');
	await expect(board.locator('g.notes text')).toHaveText(['1', '5']);

	// The game is saved: notes survive a reload.
	await page.reload();
	await expect(board.locator('g.notes text')).toHaveText(['1', '5'], { timeout: 30_000 });
});

test('Sudoku settings: auto notes, wrong digits, remaining counts and highlights', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:sudoku', 'true');
		const values = { autoNotes: true, markMistakes: true, highlightErrors: false };
		localStorage.setItem('vp:settings:sudoku', JSON.stringify({ values, updatedAt: 1 }));
	});
	// A fixed puzzle from the collection: a random one may give a digit only once, and then
	// selecting it highlights nothing else.
	await page.goto('/sudoku?v=9n&id=980291457');
	await expect(page.getByText(/Puzzle ID/i).first()).toBeVisible({ timeout: 30_000 });
	const board = page.getByRole('grid', { name: 'Puzzle board' });

	// Auto notes: every empty cell gets its possible digits right away.
	await expect(board.locator('g.notes').first()).toBeVisible();
	const empty = await board.locator('g.notes').count();
	const given = await board.locator('text[data-cell]').count();
	expect(empty + given).toBe(81);

	// The number pad shows how often each digit is still missing.
	const pad = page.getByRole('toolbar', { name: 'Number pad' });
	const one = pad.getByRole('button', { name: '1', exact: true });
	await expect(one).toHaveAttribute('title', /^\d left$/);

	// The givens as [cell, digit], before any digit is entered.
	const givens = await board
		.locator('text[data-cell]')
		.evaluateAll((els) =>
			els.map((e) => [Number(e.getAttribute('data-cell')), e.textContent!.trim()] as const)
		);
	const givenCells = givens.map(([i]) => i);

	// Wrong digits: of the nine digits in an empty cell exactly one is not painted red.
	const cell = [...Array(81).keys()].find((i) => !givenCells.includes(i))!;
	await clickCell(page, 9, Math.floor(cell / 9), cell % 9);
	const colours: string[] = [];
	for (let d = 1; d <= 9; d++) {
		await pad.getByRole('button', { name: String(d), exact: true }).click();
		colours.push((await board.locator(`text[data-cell="${cell}"]`).getAttribute('fill'))!);
	}
	expect(colours.filter((c) => c === palette.error)).toHaveLength(8);

	// Same digit: selecting a given highlights the other cells with its digit.
	const [pick] = givens.find(([, d]) => givens.filter(([, x]) => x === d).length > 1)!;
	await clickCell(page, 9, Math.floor(pick / 9), pick % 9);
	await expect(board.locator(`rect[fill="${palette.sameDigit}"]`).first()).toBeVisible();
});

test('the Sudoku screenshot shows the whole board', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:sudoku', 'true'));
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/sudoku?v=9n');
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	await expect(board.locator('text').first()).toBeVisible({ timeout: 30_000 });
	const width = Number(await board.getAttribute('width'));
	await page.getByRole('button', { name: 'Share' }).click();
	const link = page.locator('a[href^="data:image/png"]');
	await expect(link).toBeAttached();
	const size = await link.evaluate(async (a: HTMLAnchorElement) => {
		const img = new Image();
		img.src = a.href;
		await img.decode();
		return [img.naturalWidth, img.naturalHeight];
	});
	expect(size).toEqual([width, width]);
});

test('Calcudoku shows cages with their results and checks rows and columns', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:sudoku', 'true'));
	await page.goto('/sudoku?v=c5e');
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	const labels = board.locator('g.cages text');
	await expect(labels.first()).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole('button', { name: 'Calcudoku 5×5 Easy' })).toHaveAttribute(
		'aria-current',
		'true'
	);
	// Every cage shows its result, then its operation (none for a single cell).
	for (const label of await labels.allTextContents()) expect(label).toMatch(/^\d+[+−×÷]?$/);
	// No givens: the board starts empty.
	await expect(board.locator('text[data-cell]')).toHaveCount(0);

	// The same digit twice in a row is a mistake, wherever the cages are.
	await clickCell(page, 5, 0, 0);
	await page.keyboard.press('3');
	await clickCell(page, 5, 0, 4);
	await page.keyboard.press('3');
	await expect(board.locator('text[data-cell="0"]')).toHaveAttribute('fill', palette.error);
	await expect(board.locator('text[data-cell="4"]')).toHaveAttribute('fill', palette.error);
	// Not in a different row and column: there are no boxes.
	await page.keyboard.press('3');
	await clickCell(page, 5, 1, 1);
	await page.keyboard.press('3');
	await expect(board.locator('text[data-cell="6"]')).toHaveAttribute('fill', palette.entered);
});

test('a whole Calcudoku can be solved', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:sudoku', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
	// Calcudoku 5×5 Easy #513322150 from the bundled collection, and its only solution.
	await page.goto('/sudoku?v=c5e&id=513322150');
	const solution = '1254321354452315341234125';
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	await expect(board.locator('g.cages text').first()).toBeVisible({ timeout: 30_000 });
	await page.waitForLoadState('networkidle');
	const newPuzzle = page.getByRole('button', { name: 'New puzzle' });

	for (const [i, d] of [...solution].entries()) {
		if (i === solution.length - 1) {
			// Every cell but the last: not solved yet, and nothing is marked wrong.
			await expect(board.locator(`text[fill="${palette.error}"]`)).toHaveCount(0);
			await expect(newPuzzle).not.toHaveClass(/btn-primary/);
		}
		await clickCell(page, 5, Math.floor(i / 5), i % 5);
		await page.keyboard.press(d);
	}
	await expect(newPuzzle).toHaveClass(/btn-primary/);
	await expect(page.getByRole('status')).toContainText('Solved in');
});

test('picking the digit first:the pad arms a digit, left click enters it, right click notes it', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:sudoku', 'true');
		localStorage.setItem(
			'vp:settings:sudoku',
			JSON.stringify({ values: { digitFirst: true }, updatedAt: 1 })
		);
	});
	await page.goto('/sudoku?v=9e');
	const board = page.getByRole('grid', { name: 'Puzzle board' });
	await expect(board).toBeVisible({ timeout: 30_000 });
	const pad = page.getByRole('toolbar', { name: 'Number pad' });
	const givens = await board
		.locator('text[data-cell]')
		.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-cell'))));
	const [a, b] = [...Array(81).keys()].filter((i) => !givens.includes(i));
	const at = async (i: number) => {
		const box = (await board.boundingBox())!;
		const cell = (box.width - 6) / 9;
		return {
			x: box.x + 3 + ((i % 9) + 0.5) * cell,
			y: box.y + 3 + (Math.floor(i / 9) + 0.5) * cell
		};
	};

	// No cell is selected, yet the pad works: it arms the digit.
	const five = pad.getByRole('button', { name: '5', exact: true });
	await five.click();
	await expect(five).toHaveAttribute('aria-pressed', 'true');

	let p = await at(a);
	await page.mouse.click(p.x, p.y);
	await expect(board.locator(`text[data-cell="${a}"]`)).toHaveText('5');
	p = await at(b);
	await page.mouse.click(p.x, p.y, { button: 'right' });
	await expect(board.locator(`text[data-cell="${b}"]`)).toHaveCount(0);
	await expect(board.locator('g.notes text', { hasText: '5' })).toHaveCount(1);

	// The eraser is armed the same way; clicking the digit again disarms it.
	await pad.getByRole('button', { name: 'Erase' }).click();
	await expect(five).toHaveAttribute('aria-pressed', 'false');
	p = await at(a);
	await page.mouse.click(p.x, p.y);
	await expect(board.locator(`text[data-cell="${a}"]`)).toHaveCount(0);
});
