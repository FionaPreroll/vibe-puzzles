import { expect, test } from '@playwright/test';

// Pinwheel 7×7 Normal #1027244002 from the bundled bank; the game's first type is 5×5.
const LINK = '/pinwheel?id=1027244002';

test('a shared link does not name the wrong puzzle type in its preview', async ({
	page,
	request
}) => {
	// Messengers build the preview from the page's HTML, without running it.
	const html = await (await request.get(LINK)).text();
	const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
	expect(title).toBe('Pinwheel · Vibe Puzzles');

	await page.addInitScript(() => localStorage.setItem('vp:tutorialSeen:pinwheel', 'true'));
	await page.goto(LINK);
	await expect(page).toHaveTitle('Pinwheel · 7×7 Normal · Vibe Puzzles', { timeout: 30_000 });
});
