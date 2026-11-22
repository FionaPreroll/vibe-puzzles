import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readChangelog } from '../scripts/changelog';
import { BACKUP_FORMAT, BACKUP_VERSION } from '../src/lib/client/backup';
import { colours as palette } from '../src/lib/core/palette';

test('the About page lists every shipped library with its licence text', async ({ page }) => {
	await page.goto('/about');
	const section = page.locator('section', { has: page.getByRole('heading', { name: 'Licences' }) });
	const licences = [
		...['svelte', '@sveltejs/kit', 'devalue', 'clsx', 'tailwindcss', 'uqr'].map((name) => ({
			name,
			terms: /MIT License|Permission is hereby granted/
		})),
		// The heading fonts of the Halloween, winter and Christmas looks.
		...[
			'@fontsource/fredoka',
			'@fontsource/cinzel',
			'@fontsource/comfortaa',
			'@fontsource/playfair-display'
		].map((name) => ({
			name,
			terms: /SIL Open Font License/
		}))
	];
	for (const { name, terms } of licences) {
		const link = section.getByRole('link', { name, exact: true });
		await expect(link).toHaveAttribute('href', /^https:\/\//);
		// The text is folded away until asked for, and holds the copyright notice.
		const summary = section.getByText(`Licence text of ${name}`, { exact: true });
		const text = summary.locator('xpath=following-sibling::pre');
		await expect(text).toBeHidden();
		await summary.click();
		await expect(text).toBeVisible();
		await expect(text).toContainText(terms);
		await expect(text).toContainText('Copyright');
	}
});

test('the backup schema link opens the JSON schema', async ({ page }) => {
	await page.goto('/about');
	await page.getByRole('link', { name: 'File format (JSON Schema)' }).click();
	await expect(page).toHaveURL(/\/backup\.schema\.json$/);
	await expect(page.locator('body')).toContainText('"$schema"');
});

const PUZZLE = '/tetroid?v=6n&id=496678832';

/** The app's stored entries, by key. */
const stored = (page: Page) =>
	page.evaluate(() =>
		Object.fromEntries(
			Object.keys(localStorage)
				.filter((key) => key.startsWith('vp:'))
				.map((key) => [key, localStorage.getItem(key)])
		)
	);

/** Marks of the saved 6×6 Tetroid game. */
const savedMarks = (page: Page) =>
	page.evaluate(
		() => JSON.parse(localStorage.getItem('vp:save:tetroid:6n') ?? 'null')?.state.marks as number[]
	);

const importInput = (page: Page) => page.getByLabel('Import backup');

/**
 * Pick a file to import. A pick before the page has hydrated goes unnoticed, so the file is picked
 * again until the page answers with its question or its error. The unnoticed pick stays in the
 * input, and picking the same file again is no change to the browser, so the input is emptied
 * before each pick.
 */
async function importFile(page: Page, file: Parameters<Locator['setInputFiles']>[0]) {
	const answer = page.getByRole('alertdialog').or(page.getByRole('alert')).first();
	await expect(async () => {
		await importInput(page).setInputFiles([]);
		await importInput(page).setInputFiles(file);
		await expect(answer).toBeVisible({ timeout: 1000 });
	}).toPass();
}

test(
	'a backup exported on the About page brings a game in progress back',
	{ tag: '@webkit' },
	async ({ page }) => {
		await page.goto('/');
		// The service worker in charge first: in WebKit, a page opened while it installs (caching the
		// whole app) and takes over can fail to load ("WebKit encountered an internal error").
		await page.evaluate(async () => {
			localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
			await navigator.serviceWorker.ready;
			if (!navigator.serviceWorker.controller) {
				await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
			}
		});
		await page.goto(PUZZLE);
		await expect(page.locator('.font-mono.select-all')).toHaveText('496,678,832', {
			timeout: 30_000
		});
		const board = page.getByRole('application', { name: 'Puzzle board' });
		const box = (await board.boundingBox())!;
		for (const c of [0, 1]) {
			await page.mouse.click(box.x + ((c + 0.5) * box.width) / 6, box.y + box.height / 12);
		}
		await expect.poll(async () => (await savedMarks(page))?.filter((m) => m !== 0).length).toBe(2);
		const marks = await savedMarks(page);

		await page.goto('/about');
		const before = await stored(page);
		const downloading = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Export backup' }).click();
		const download = await downloading;
		expect(download.suggestedFilename()).toMatch(/^vibe-puzzles-backup-\d{4}-\d{2}-\d{2}\.json$/);
		const file = await download.path();
		const backup = JSON.parse(readFileSync(file, 'utf8'));
		expect(Object.keys(backup.data)).toContain('save:tetroid:6n');

		// A new device: nothing stored. The import asks first, then restores and reloads.
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await importFile(page, file);
		const asked = page.getByRole('alertdialog');
		await expect(asked).toContainText(`Import ${Object.keys(before).length} entries`);
		const reloaded = page.waitForEvent('load');
		await asked.getByRole('button', { name: 'Replace' }).click();
		await expect(page.getByRole('status')).toHaveText(
			`Restored ${Object.keys(before).length} entries. Reloading…`
		);
		await reloaded;
		expect(await stored(page)).toEqual(before);

		// The game goes on where it was.
		await page.goto('/tetroid?v=6n');
		await expect(page.locator('.font-mono.select-all')).toHaveText('496,678,832', {
			timeout: 30_000
		});
		expect(await savedMarks(page)).toEqual(marks);
		await expect(board.locator(`rect[fill="${palette.shaded}"]`)).toHaveCount(2);
	}
);

test('the export takes only what the player chose', async ({ page }) => {
	await page.goto('/about');
	await page.evaluate(() => {
		localStorage.setItem('vp:player', JSON.stringify({ id: 'p', name: 'P', token: 't' }));
		localStorage.setItem('vp:night', 'true');
		localStorage.setItem('vp:stats:loop:7n', '{"solved":1}');
		localStorage.setItem('vp:stats:sudoku:9n', '{"solved":2}');
		localStorage.setItem('vp:settings:loop', '{"values":{},"updatedAt":1}');
	});
	await page.reload();
	await page.getByText('Choose what goes into the backup', { exact: true }).click();
	await page.getByLabel('Player code').uncheck();
	await page.getByLabel('Sudoku, Calcudoku').uncheck();
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export backup' }).click();
	const backup = JSON.parse(readFileSync(await (await downloading).path(), 'utf8'));
	const keys = Object.keys(backup.data);
	expect(keys).toEqual(expect.arrayContaining(['night', 'settings:loop', 'stats:loop:7n']));
	expect(keys).not.toContain('player');
	expect(keys.filter((key) => key.includes('sudoku'))).toEqual([]);
	await expect(page.getByText(`The backup gets ${keys.length} entries.`)).toBeVisible();

	// Nothing chosen: nothing to export.
	for (const part of ['Saved games', 'Statistics', 'Settings']) {
		await page.getByLabel(part).uncheck();
	}
	await expect(page.getByRole('button', { name: 'Export backup' })).toBeDisabled();
});

test('a link with a QR code brings a backup to another device', async ({ page, browser }) => {
	await page.goto('/about');
	await page.evaluate(() => {
		localStorage.setItem('vp:player', JSON.stringify({ id: 'p', name: 'P', token: 't' }));
		localStorage.setItem('vp:settings:loop', '{"values":{"greyDone":false},"updatedAt":5}');
		localStorage.setItem('vp:stats:loop:7n', '{"solved":4}');
	});
	await page.reload();
	await page.getByText('Choose what goes into the backup', { exact: true }).click();
	await page.getByLabel('Player code').uncheck();
	await page.getByLabel('Saved games').uncheck();
	await page.getByRole('button', { name: 'Link for another device' }).click();
	await expect(page.getByRole('img', { name: 'QR code of the backup link' })).toBeVisible();
	await expect(page.getByText('holds your player code')).toHaveCount(0);
	const link = await page.getByRole('textbox', { name: 'Vibe Puzzles backup link' }).inputValue();
	expect(new URL(link).pathname).toBe('/about');
	expect(new URL(link).hash).toMatch(/^#backup=[\w-]+$/);

	// Choosing something else makes the link stale.
	await page.getByLabel('Statistics').uncheck();
	await expect(page.getByRole('img', { name: 'QR code of the backup link' })).toHaveCount(0);

	// The other device opens the link: it offers to import, and takes the hash out of the address.
	const other = await browser.newPage();
	await other.goto(link);
	const asked = other.getByRole('alertdialog');
	await expect(asked).toContainText('Import');
	await expect(other).toHaveURL(/\/about$/);
	const reloaded = other.waitForEvent('load');
	await asked.getByRole('button', { name: 'Merge' }).click();
	await reloaded;
	const after = await stored(other);
	expect(after['vp:settings:loop']).toBe('{"values":{"greyDone":false},"updatedAt":5}');
	expect(after['vp:stats:loop:7n']).toBe('{"solved":4}');
	expect(after['vp:player']).toBeUndefined();
	await expect(other.getByRole('alertdialog')).toHaveCount(0);

	// A broken link says so.
	await other.goto('/about#backup=broken!');
	await expect(other.getByRole('alert')).toContainText('This link cannot be imported');
	await other.close();
});

test('the About page refuses a file that is not a backup and keeps everything', async ({
	page
}) => {
	await page.goto('/about');
	await page.evaluate(() => {
		localStorage.setItem('vp:tutorialSeen:tetroid', 'true');
		localStorage.setItem('vp:night', 'false');
	});
	const before = await stored(page);
	page.on('dialog', (dialog) => {
		throw new Error(`unexpected dialog: ${dialog.message()}`);
	});

	for (const [name, text] of [
		['notes.json', '{"hello": "world"}'],
		['photo.json', 'not JSON at all']
	]) {
		await importFile(page, {
			name,
			mimeType: 'application/json',
			buffer: Buffer.from(text)
		});
		await expect(page.getByRole('alert')).toContainText('This file cannot be restored');
		await expect(page.getByRole('status')).toHaveCount(0);
		await expect(page.getByRole('alertdialog')).toHaveCount(0);
	}
	expect(await stored(page)).toEqual(before);
});

test('cancelling the import of a backup keeps everything', async ({ page }) => {
	await page.goto('/about');
	await page.evaluate(() => localStorage.setItem('vp:night', 'false'));
	const before = await stored(page);
	const backup = {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt: '2026-10-01T12:00:00Z',
		app: { version: '0.0.1', commit: 'abc1234' },
		data: { night: 'true', 'tutorialSeen:tetroid': 'true' }
	};
	await importFile(page, {
		name: 'backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(backup))
	});
	await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('alertdialog')).toBeHidden();
	await expect(page.getByRole('status')).toHaveCount(0);
	expect(await stored(page)).toEqual(before);
});

test('merging a backup adds up the statistics and keeps what only this device has', async ({
	page
}) => {
	await page.goto('/about');
	const solve = (puzzleId: number, timeMs: number, at: number) => ({ puzzleId, timeMs, at });
	const here = {
		solved: 2,
		streak: 2,
		bestStreak: 2,
		bestMs: 60_000,
		totalMs: 150_000,
		recent: [solve(2, 90_000, 2000), solve(1, 60_000, 1000)],
		solvedIds: [1, 2]
	};
	const there = {
		solved: 2,
		streak: 1,
		bestStreak: 1,
		bestMs: 40_000,
		totalMs: 100_000,
		recent: [solve(3, 40_000, 3000), solve(1, 60_000, 1000)],
		solvedIds: [1, 3]
	};
	await page.evaluate((stats) => {
		localStorage.setItem('vp:stats:tetroid:6n', JSON.stringify(stats));
		localStorage.setItem('vp:night', 'false');
	}, here);
	const backup = {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt: '2026-10-01T12:00:00Z',
		app: { version: '0.0.1', commit: 'abc1234' },
		data: {
			'stats:tetroid:6n': JSON.stringify(there),
			night: 'true',
			'tutorialSeen:tetroid': 'true'
		}
	};
	await importFile(page, {
		name: 'backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(backup))
	});
	const asked = page.getByRole('alertdialog');
	await expect(asked).toContainText('Import 3 entries');
	const reloaded = page.waitForEvent('load');
	await asked.getByRole('button', { name: 'Merge' }).click();
	await expect(page.getByRole('status')).toHaveText(
		'Merged: 2 entries added or updated. Reloading…'
	);
	await reloaded;
	const after = await stored(page);
	expect(after['vp:night']).toBe('false');
	expect(after['vp:tutorialSeen:tetroid']).toBe('true');
	expect(JSON.parse(after['vp:stats:tetroid:6n'])).toMatchObject({
		solved: 3,
		streak: 1,
		bestStreak: 2,
		bestMs: 40_000,
		totalMs: 190_000,
		solvedIds: [1, 2, 3]
	});
});

test('the About page shows the changelog, and the version in the footer leads to it', async ({
	page
}) => {
	const version: string = JSON.parse(readFileSync('package.json', 'utf8')).version;
	await page.goto('/');
	await page.getByRole('link', { name: `v${version}`, exact: true }).click();
	await expect(page).toHaveURL(/\/about#changes$/);
	const section = page.locator('section#changes');
	await expect(section.getByRole('heading', { name: 'Changes', level: 2 })).toBeVisible();
	// The current version is open, also below changes that are in no version yet.
	const escaped = version.replaceAll('.', '\\.');
	await expect(
		section.getByRole('heading', { level: 3, name: new RegExp(`^Version ${escaped}, `) })
	).toHaveText(new RegExp(`^Version ${escaped}, \\w+ \\d+, \\d{4}$`));
	await expect(section.getByRole('heading', { name: 'New', level: 4 }).first()).toBeVisible();
	// Bold and plain pieces join without stray spaces: a change of the current version, as
	// CHANGELOG.md has it.
	const item = readChangelog('.')
		.find((r) => r.version === version)!
		.sections.flatMap((s) => s.items)
		.find((pieces) => pieces.some((p) => p.strong))!;
	const text = item.map((p) => p.text).join('');
	const change = section.getByRole('listitem').filter({ hasText: text });
	await expect(change).toHaveText(text);
	await expect(change.locator('strong').first()).toHaveText(item.find((p) => p.strong)!.text);

	// In German, the headings follow; the changes themselves stay in English.
	await page.getByRole('combobox', { name: /Language|Sprache/ }).selectOption('de');
	await expect(section.getByRole('heading', { name: 'Änderungen', level: 2 })).toBeVisible();
	await expect(
		section.getByRole('heading', { level: 3, name: new RegExp(`^Version ${escaped} vom `) })
	).toHaveText(new RegExp(`^Version ${escaped} vom \\d+\\. \\w+ \\d{4}$`));
	await expect(section.getByRole('heading', { name: 'Neu', level: 4 }).first()).toBeVisible();
});

test('the About page names a contact address', async ({ page }) => {
	await page.goto('/about');
	const link = page.getByRole('link', { name: 'fipreroll+app@gmail.com' });
	await expect(link).toHaveAttribute('href', 'mailto:fipreroll+app@gmail.com');
	await expect(link.locator('xpath=..')).toHaveText(
		'Questions, ideas or a bug to report? Write to fipreroll+app@gmail.com'
	);
});
