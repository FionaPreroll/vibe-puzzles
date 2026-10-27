import { expect, test } from '@playwright/test';

test('recent solves link to their puzzles, except server puzzles whose ID never came', async ({
	page
}) => {
	await page.addInitScript(() => {
		const recent = [
			{ puzzleId: 0, timeMs: 61_000, at: 2 },
			{ puzzleId: 4242, timeMs: 75_000, at: 1 }
		];
		const stats = { solved: 2, streak: 2, bestStreak: 2, bestMs: 61_000, totalMs: 136_000, recent };
		localStorage.setItem('vp:stats:tetroid:6n', JSON.stringify(stats));
	});
	await page.goto('/scores?game=tetroid&v=6n');
	const recent = page.getByRole('list').filter({ hasText: '01:01' });
	await expect(recent.getByRole('listitem')).toHaveCount(2);
	await expect(recent.getByRole('link')).toHaveCount(1);
	await expect(recent.getByRole('link', { name: '#4242' })).toHaveAttribute(
		'href',
		/\/tetroid\?id=4242$/
	);
	await expect(recent.getByRole('listitem').first()).toHaveText(/^–\s*01:01$/);
});

test('a late leaderboard does not replace the one of the game chosen since', async ({ page }) => {
	// A server whose Tetroid leaderboard comes only after the Pinwheel one.
	await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true } }));
	let answerTetroid = () => {};
	const tetroidAsked = new Promise<void>((asked) => {
		void page.route('**/api/scores?*', async (route) => {
			const game = new URL(route.request().url()).searchParams.get('game');
			if (game === 'tetroid') {
				asked();
				await new Promise<void>((answer) => (answerTetroid = answer));
			}
			const entry = { rank: 1, name: `Best at ${game}`, timeMs: 60_000, playMs: 60_000 };
			await route.fulfill({
				json: { entries: [{ ...entry, puzzleId: 1, at: '2026-10-22' }], me: null, players: 1 }
			});
		});
	});
	await page.goto('/scores?game=tetroid&v=6n');
	await tetroidAsked;
	await page.getByLabel('Game').selectOption({ label: 'Pinwheel' });
	await expect(page.getByText('Best at pinwheel')).toBeVisible();

	const late = page.waitForEvent('requestfinished', (r) => r.url().includes('game=tetroid'));
	answerTetroid();
	await late;
	// Time for the page to take the late answer in, if it would.
	await page.waitForTimeout(500);
	await expect(page.getByText('Best at pinwheel')).toBeVisible();
	await expect(page.getByText('Best at tetroid')).toHaveCount(0);
});
