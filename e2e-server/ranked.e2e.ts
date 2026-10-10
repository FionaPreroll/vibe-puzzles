import { expect, test } from '@playwright/test';
import { solveTetroid } from '../src/lib/games/tetroid/solver';
import type { TetroidPuzzle } from '../src/lib/games/tetroid/rules';

interface Saved {
	puzzleId: number;
	puzzle: TetroidPuzzle;
	ticket?: string;
	solved: boolean;
}

test('a ranked solve of a server puzzle lands on the leaderboard', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
	const name = `Ranked ${Date.now() % 100000}`;
	await page.goto('/player');
	await page.getByPlaceholder('Name').fill(name);
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

	// The server hands out the puzzle with a ticket and keeps its ID secret until it is solved.
	const issued = page.waitForResponse(
		(r) => r.url().endsWith('/api/puzzles') && r.request().method() === 'POST'
	);
	await page.goto('/tetroid?v=6n');
	expect((await issued).status()).toBe(201);
	const board = page.getByRole('grid', { name: 'Puzzle board' }).first();
	await expect(board).toBeVisible({ timeout: 30_000 });
	const read = () =>
		page.evaluate(() => JSON.parse(localStorage.getItem('vp:save:tetroid:6n') ?? 'null') as Saved);
	const game = await read();
	expect(game.ticket).toEqual(expect.any(String));
	expect(game.puzzleId).toBe(0);

	// Shade the solution, which the solver finds from the puzzle the server handed out.
	const { solutions } = solveTetroid(game.puzzle, { limit: 2, branch: true, advanced: true });
	expect(solutions).toHaveLength(1);
	const cells = [...solutions[0]].flatMap((v, i) => (v ? [i] : []));
	const box = (await board.locator('rect').first().boundingBox())!;
	const size = box.width / game.puzzle.width;
	const submitted = page.waitForResponse(
		(r) => r.url().endsWith('/api/scores') && r.request().method() === 'POST'
	);
	for (const i of cells) {
		const [r, c] = [Math.floor(i / game.puzzle.width), i % game.puzzle.width];
		await page.mouse.click(box.x + (c + 0.5) * size, box.y + (r + 0.5) * size);
	}

	// The ticket goes up, and the server answers with a rank.
	expect((await submitted).request().postDataJSON()).toMatchObject({ ticket: game.ticket });
	const message = page.getByRole('status');
	await expect(message).toHaveText(/^Solved in .+! Rank \d+ of \d+ on 6×6 Normal\.$/, {
		timeout: 15_000
	});
	const [, rank, total] = (await message.textContent())!.match(/Rank (\d+) of (\d+)/)!.map(Number);
	expect(rank).toBeGreaterThanOrEqual(1);
	expect(rank).toBeLessThanOrEqual(total);
	// The solved puzzle's ID is no secret any more.
	await expect.poll(async () => (await read()).puzzleId).toBeGreaterThan(0);
	expect((await read()).solved).toBe(true);

	// The leaderboard lists the player with the same rank: in the top 20, or below it.
	const listed = page.waitForResponse(
		(r) => r.url().includes('/api/scores?') && r.request().method() === 'GET'
	);
	await page.goto('/scores?game=tetroid&v=6n');
	const body = await (await listed).json();
	expect(body.me).toMatchObject({ rank, name, me: true });
	expect(body.players).toBe(total);
	await expect(page.getByText(total === 1 ? '1 player' : `${total} players`)).toBeVisible();
	if (rank <= 20) {
		const entry = page.getByRole('listitem').filter({ hasText: name });
		await expect(entry).toContainText(`${rank}.`);
		await expect(entry).toHaveClass(/font-semibold/);
	} else {
		await expect(page.getByText(new RegExp(`^You: rank ${rank} with `))).toBeVisible();
	}
});
