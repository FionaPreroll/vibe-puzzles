import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, createBackup, parseBackup, restoreBackup } from './backup';

function memory(entries: Record<string, string> = {}): Storage {
	const map = new Map(Object.entries(entries));
	return {
		get length() {
			return map.size;
		},
		key: (i) => [...map.keys()][i] ?? null,
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k),
		clear: () => map.clear()
	};
}

const APP = { version: '0.0.1', commit: 'abc1234' };

describe('backup', () => {
	it('exports only the app keys and restores them elsewhere', () => {
		const from = memory({ 'vp:locale': 'de', 'vp:stats:tetroid:6n': '{"solved":3}', other: 'x' });
		const backup = createBackup(from, APP, 'https://example.org/s.json', new Date(0));
		expect(backup).toEqual({
			$schema: 'https://example.org/s.json',
			format: BACKUP_FORMAT,
			version: BACKUP_VERSION,
			exportedAt: '1970-01-01T00:00:00.000Z',
			app: APP,
			data: { locale: 'de', 'stats:tetroid:6n': '{"solved":3}' }
		});

		const parsed = parseBackup(JSON.stringify(backup));
		expect(parsed.ok).toBe(true);
		const to = memory({ 'vp:keep': '1', 'vp:locale': 'en' });
		expect(restoreBackup(to, parsed.ok ? parsed.backup : backup)).toBe(2);
		expect(to.getItem('vp:locale')).toBe('de');
		expect(to.getItem('vp:keep')).toBe('1');
		expect(to.getItem('vp:stats:tetroid:6n')).toBe('{"solved":3}');
	});

	it('rejects files that are not a backup', () => {
		const good = createBackup(memory(), APP);
		const cases: [string, string][] = [
			['{', 'not JSON'],
			['[]', 'not an object'],
			[JSON.stringify({ ...good, format: 'x' }), 'not a Vibe Puzzles backup'],
			[JSON.stringify({ ...good, version: 2 }), 'unknown version 2'],
			[JSON.stringify({ ...good, exportedAt: 1 }), 'missing exportedAt'],
			[JSON.stringify({ ...good, app: { version: '1' } }), 'missing app info'],
			[JSON.stringify({ ...good, data: null }), 'missing data'],
			[JSON.stringify({ ...good, data: { a: 1 } }), 'bad entry a']
		];
		for (const [text, error] of cases) expect(parseBackup(text)).toEqual({ ok: false, error });
	});

	it('matches the published JSON Schema', () => {
		const schema = JSON.parse(readFileSync('static/backup.schema.json', 'utf8'));
		const backup = createBackup(memory({ 'vp:a': '1' }), APP, 'x');
		expect(schema.required.every((k: string) => k in backup)).toBe(true);
		expect(Object.keys(backup).every((k) => k in schema.properties)).toBe(true);
		expect(schema.properties.format.const).toBe(BACKUP_FORMAT);
		expect(schema.properties.version.const).toBe(BACKUP_VERSION);
	});
});
