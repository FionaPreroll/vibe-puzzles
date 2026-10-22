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
