import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, type Backup } from './backup';
import { backupFromHash, backupLink, QR_MAX_LENGTH, qrCode } from './backupLink';

const backup = (data: Record<string, string>): Backup => ({
	$schema: 'https://example.org/backup.schema.json',
	format: BACKUP_FORMAT,
	version: BACKUP_VERSION,
	exportedAt: '2026-11-22T12:00:00.000Z',
	app: { version: '0.9.0', commit: 'abc1234' },
	data
});

describe('backup links', () => {
	it('carry a backup in the fragment of the About page', async () => {
		const original = backup({ night: 'true', 'settings:loop': '{"values":{},"updatedAt":1}' });
		const link = await backupLink('https://example.org/vibe-puzzles/about', original);
		const url = new URL(link);
		expect(url.origin + url.pathname).toBe('https://example.org/vibe-puzzles/about');
		expect(url.search).toBe('');
		expect(url.hash).toMatch(/^#backup=[\w-]+$/);

		const { $schema: _, ...rest } = original;
		expect(await backupFromHash(url.hash)).toEqual({ ok: true, backup: rest });
	});

	it('compress what repeats', async () => {
		const data = Object.fromEntries(
			Array.from({ length: 50 }, (_, i) => [`stats:loop:${i}`, '{"solved":1,"streak":1}'])
		);
		const link = await backupLink('https://example.org/about', backup(data));
		expect(link.length).toBeLessThan(JSON.stringify(data).length / 3);
	});

	it('leave other fragments alone and refuse broken ones', async () => {
		expect(await backupFromHash('')).toBeNull();
		expect(await backupFromHash('#changes')).toBeNull();
		for (const hash of ['#backup=', '#backup=not+base64', '#backup=AAAA', '#backup=%%%']) {
			expect(await backupFromHash(hash)).toEqual({ ok: false, error: 'broken link' });
		}
		// Valid compression, but no backup inside.
		const other = await backupLink('https://example.org/about', {
			...backup({}),
			format: 'x'
		} as unknown as Backup);
		expect(await backupFromHash(new URL(other).hash)).toEqual({
			ok: false,
			error: 'not a Vibe Puzzles backup'
		});
	});

	it('get a QR code while they are short enough', () => {
		const qr = qrCode('https://example.org/about#backup=abc');
		expect(qr?.size).toBeGreaterThanOrEqual(25);
		expect(qr?.path).toMatch(/^M\d+ \d+h1v1h-1z/);
		expect(qrCode(`https://example.org/about#backup=${'a'.repeat(QR_MAX_LENGTH)}`)).toBeNull();
	});
});
