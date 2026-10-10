import { expect, test } from '@playwright/test';

/**
 * The tutorial buttons on the home page sit on a line of their own below the "New here?" hint:
 * side by side where they fit, else one below the other. In every look, by day and by night.
 */
for (const look of ['classic', 'halloween']) {
	for (const night of [false, true]) {
		for (const width of [320, 360, 390, 768, 1280]) {
			test(`${look}, ${night ? 'night' : 'day'}, ${width} px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await page.addInitScript(
					([l, n]) => {
						localStorage.setItem('vp:look', JSON.stringify(l));
						localStorage.setItem('vp:night', JSON.stringify(n));
					},
					[look, night] as const
				);
				await page.goto('/');
				await expect(page.getByRole('link', { name: 'Learn Calcudoku' })).toBeVisible();
				// Every game card with tutorials: the hint, then its buttons.
				const cards = await page
					.getByText('New here? Each tutorial takes a minute.')
					.evaluateAll((hints) =>
						hints.map((hint) => {
							const box = (el: Element) => el.getBoundingClientRect();
							// The buttons of the same card, wherever they sit around the hint.
							const links = [...hint.parentElement!.querySelectorAll('a')];
							return {
								hint: { bottom: box(hint).bottom, width: box(hint).width },
								row: box(hint.parentElement!).width,
								gap: parseFloat(getComputedStyle(links[0].parentElement!).columnGap) || 0,
								buttons: links.map((b) => {
									const r = box(b);
									return { top: r.top, bottom: r.bottom, width: r.width };
								})
							};
						})
					);
				expect(cards.length).toBeGreaterThan(0);
				expect(cards.some((c) => c.buttons.length === 2)).toBe(true);
				for (const { hint, row, gap, buttons } of cards) {
					// No button shares a line with the hint.
					for (const b of buttons) expect(b.top).toBeGreaterThanOrEqual(hint.bottom);
					const together = buttons.reduce((w, b) => w + b.width, 0) + gap * (buttons.length - 1);
					if (together <= row) {
						// Room for all: one line.
						for (const b of buttons) expect(b.top).toBe(buttons[0].top);
					} else {
						// Not enough room: each below the one before.
						for (let i = 1; i < buttons.length; i++)
							expect(buttons[i].top).toBeGreaterThanOrEqual(buttons[i - 1].bottom);
					}
				}
			});
		}
	}
}
