import { expect, test, type Page } from '@playwright/test';

const PUZZLE = '/tetroid?v=6n&id=496678832';

/** A wake lock that grants every request and counts the locks held, in `window.__awake`. */
async function fakeWakeLock(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
		const state = { requests: 0, held: 0 };
		(window as unknown as { __awake: typeof state }).__awake = state;
		Object.defineProperty(Navigator.prototype, 'wakeLock', {
			configurable: true,
			get: () => ({
				request: async () => {
					state.requests++;
					state.held++;
					const sentinel = new EventTarget() as EventTarget & {
						released: boolean;
						release(): Promise<void>;
					};
					sentinel.released = false;
					sentinel.release = async () => {
						if (sentinel.released) return;
						sentinel.released = true;
						state.held--;
						sentinel.dispatchEvent(new Event('release'));
					};
					return sentinel;
				}
			})
		});
	});
}

const awake = (page: Page) =>
	page.evaluate(
		() => (window as unknown as { __awake: { requests: number; held: number } }).__awake
	);

test('a game keeps the screen on, as long as the settings say', async ({ page }) => {
	await fakeWakeLock(page);
	await page.goto(PUZZLE);
	await expect(page.locator('.overflow-x-auto svg[role="application"]')).toBeVisible({
		timeout: 30_000
	});
	await expect.poll(() => awake(page)).toEqual({ requests: 1, held: 1 });

	await page.getByRole('button', { name: 'Settings' }).click();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	const group = dialog.getByRole('group', { name: 'Keep the screen on' });
	await expect(
		group.getByRole('radio', { name: 'For 5 minutes after the last touch' })
	).toBeChecked();

	await group.getByRole('radio', { name: 'Off' }).check();
	await expect.poll(() => awake(page)).toEqual({ requests: 1, held: 0 });
	await group.getByRole('radio', { name: 'Always, while a puzzle is open' }).check();
	await expect.poll(() => awake(page)).toEqual({ requests: 2, held: 1 });

	// The choice stays on this device.
	await page.reload();
	await expect.poll(() => awake(page)).toEqual({ requests: 1, held: 1 });
	expect(await page.evaluate(() => localStorage.getItem('vp:keepAwake'))).toBe('"always"');
});

test('without a wake lock in the browser, the settings leave the choice out', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		delete (Navigator.prototype as { wakeLock?: unknown }).wakeLock;
	});
	await page.goto(PUZZLE);
	await page.getByRole('button', { name: 'Settings' }).click();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog.getByRole('group', { name: 'Where new puzzles come from' })).toBeVisible();
	await expect(dialog.getByRole('group', { name: 'Keep the screen on' })).toHaveCount(0);
});
