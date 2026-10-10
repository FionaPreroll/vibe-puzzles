import { expect, test } from '@playwright/test';

/** Storage and links can hold anything: a restored backup, an older version, a typo. */

test('the home page opens whatever games storage holds', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.addInitScript(() => {
		for (const game of ['constructor', '__proto__', 'toString']) {
			localStorage.setItem(`vp:save:${game}:6n`, '{"variant":"6n","solved":false}');
		}
		localStorage.setItem('vp:outbox', '{"saves":[1],"scores":[null]}');
	});
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Tetroid' })).toBeVisible();
	await page.waitForLoadState('networkidle');
	expect(errors).toEqual([]);
});

for (const id of ['9007199254740991', '-5', '1.5', '1e30']) {
	test(`a link with the puzzle ID ${id} opens a puzzle and says the ID is unknown`, async ({
		page
	}) => {
		await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
		await page.goto(`/tetroid?v=6n&id=${id}`);
		await expect(page.getByRole('grid', { name: 'Puzzle board' }).first()).toBeVisible({
			timeout: 30_000
		});
		await expect(page.getByRole('status')).toHaveText('No puzzle has this ID.');
		await expect(page).toHaveURL(/\/tetroid\?v=6n$/);
	});
}

test('an unknown puzzle ID typed in is refused', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
	await page.goto('/tetroid?v=6n');
	const board = page.getByRole('grid', { name: 'Puzzle board' }).first();
	await expect(board).toBeVisible({ timeout: 30_000 });
	const before = await page.evaluate(() => localStorage.getItem('vp:save:tetroid:6n'));
	await page.getByRole('textbox', { name: 'Open puzzle by ID' }).fill('15');
	await page.getByRole('button', { name: 'Open', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('No puzzle has this ID.');
	await expect(board).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('vp:save:tetroid:6n'))).toBe(before);
});
