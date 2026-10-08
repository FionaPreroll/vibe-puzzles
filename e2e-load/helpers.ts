import type { Page } from '@playwright/test';

/** Skip the tutorial and take puzzles from the bundled bank, as the regular e2e tests do. */
export async function prepare(page: Page) {
	await page.addInitScript(() => {
		for (const g of ['tetroid', 'pinwheel']) localStorage.setItem(`vp:tutorialSeen:${g}`, 'true');
		localStorage.setItem('vp:puzzleSource', '"bank"');
	});
}

/** The game board on a game page (not the small boards in rules or dialogs). */
export const board = (page: Page) => page.locator('.overflow-x-auto svg[role="grid"]');

/** A small seeded random generator, so a failing run can be repeated exactly. */
export function random(seed: number) {
	let s = seed >>> 0 || 1;
	return () => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		return (s >>> 0) / 2 ** 32;
	};
}

/** The p-th percentile (0–100) of some numbers. */
export function percentile(values: number[], p: number) {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
