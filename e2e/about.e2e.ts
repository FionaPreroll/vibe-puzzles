import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BACKUP_FORMAT, BACKUP_VERSION } from '../src/lib/client/backup';
import { colours as palette } from '../src/lib/core/palette';

test('the About page lists every shipped library with its licence text', async ({ page }) => {
	await page.goto('/about');
	const section = page.locator('section', { has: page.getByRole('heading', { name: 'Licences' }) });
	const licences = [
		...['svelte', '@sveltejs/kit', 'devalue', 'clsx', 'tailwindcss'].map((name) => ({
			name,
			terms: /MIT License|Permission is hereby granted/
		})),
		// The Halloween look's heading fonts.
		...['@fontsource/fredoka', '@fontsource/cinzel'].map((name) => ({
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
 * again until the page answers with its question or its error.
 */
async function importFile(page: Page, file: Parameters<Locator['setInputFiles']>[0]) {
	const answer = page.getByRole('alertdialog').or(page.getByRole('alert')).first();
	await expect(async () => {
		await importInput(page).setInputFiles(file);
		await expect(answer).toBeVisible({ timeout: 1000 });
	}).toPass();
}

test('a backup exported on the About page brings a game in progress back', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => localStorage.setItem('vp:tutorialSeen:tetroid', 'true'));
	await page.goto(PUZZLE);
	await expect(page.locator('.font-mono.select-all')).toHaveText('496,678,832', {
		timeout: 30_000
	});
	const board = page.getByRole('grid', { name: 'Puzzle board' });
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
	await expect(asked).toContainText(`Restore ${Object.keys(before).length} entries`);
	const reloaded = page.waitForEvent('load');
	await asked.getByRole('button', { name: 'Restore' }).click();
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
