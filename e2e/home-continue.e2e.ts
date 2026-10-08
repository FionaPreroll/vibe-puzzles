import { expect, test } from '@playwright/test';

// A Pinwheel 5×5 puzzle is enough here; the home page only reads the saves.
const save = (variant: string, state: unknown) => ({
	version: 1,
	puzzleId: 1,
	variant,
	puzzle: { width: 5, height: 5, centres: [] },
	state,
	checkpoints: [],
	currentCheckpoint: -1,
	solved: false,
	startedAt: 0,
	playMs: 0,
	updatedAt: Date.now()
});

test("yesterday's unfinished daily puzzle is not offered to continue", async ({ page }) => {
	await page.addInitScript(
		(game) => {
			const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
			localStorage.setItem(`vp:save:pinwheel:daily:${yesterday}`, JSON.stringify(game));
		},
		save('daily', 'moved')
	);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
	await page.waitForLoadState('networkidle');
	await expect(page.getByText('Continue', { exact: true })).toHaveCount(0);
});

test("today's started daily puzzle is offered to continue", async ({ page }) => {
	await page.addInitScript(
		(game) => {
			const today = new Date().toISOString().slice(0, 10);
			localStorage.setItem(`vp:save:pinwheel:daily:${today}`, JSON.stringify(game));
		},
		save('daily', 'moved')
	);
	await page.goto('/');
	await expect(page.getByText('Continue', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: /Pinwheel · Daily/ })).toHaveAttribute(
		'href',
		/pinwheel\?v=daily/
	);
});
