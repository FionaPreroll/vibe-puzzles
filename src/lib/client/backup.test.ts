import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
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

	const good = createBackup(memory({ 'vp:a': '1' }), APP);
	/** Files that are not a backup, with the reason `parseBackup` gives. */
	const invalid: [string, string][] = [
		['{', 'not JSON'],
		['[]', 'not an object'],
		[JSON.stringify({ ...good, format: 'x' }), 'not a Vibe Puzzles backup'],
		[JSON.stringify({ ...good, version: 2 }), 'unknown version 2'],
		[JSON.stringify({ ...good, exportedAt: 1 }), 'missing exportedAt'],
		[JSON.stringify({ ...good, exportedAt: 'yesterday' }), 'bad exportedAt'],
		[JSON.stringify({ ...good, exportedAt: '2026-13-45T00:00:00Z' }), 'bad exportedAt'],
		[JSON.stringify({ ...good, app: { version: '1' } }), 'missing app info'],
		[JSON.stringify({ ...good, data: null }), 'missing data'],
		[JSON.stringify({ ...good, data: { a: 1 } }), 'bad entry a'],
		[JSON.stringify({ ...good, data: { '': '1' } }), 'bad entry ']
	];

	it('rejects files that are not a backup', () => {
		for (const [text, error] of invalid) expect(parseBackup(text)).toEqual({ ok: false, error });
	});

	it('matches the published JSON Schema', () => {
		const schema = JSON.parse(readFileSync('static/backup.schema.json', 'utf8'));
		const backup = createBackup(memory({ 'vp:a': '1' }), APP, 'x');
		expect(schema.required.every((k: string) => k in backup)).toBe(true);
		expect(Object.keys(backup).every((k) => k in schema.properties)).toBe(true);
		expect(schema.properties.format.const).toBe(BACKUP_FORMAT);
		expect(schema.properties.version.const).toBe(BACKUP_VERSION);
	});

	describe('the published JSON Schema', () => {
		const schema = JSON.parse(readFileSync('static/backup.schema.json', 'utf8'));
		const ajv = new Ajv2020({ strict: true, allErrors: true });
		addFormats(ajv);
		const validate = ajv.compile(schema);

		it('accepts exported backups', () => {
			const full = createBackup(
				memory({
					'vp:locale': 'de',
					'vp:stats:tetroid:6n': '{"solved":3}',
					'vp:save:pinwheel:7n': '{"h":[0,1],"v":[2]}',
					other: 'x'
				}),
				APP,
				'https://example.org/backup.schema.json'
			);
			for (const backup of [full, good, createBackup(memory(), APP)]) {
				expect(validate(backup), JSON.stringify(validate.errors)).toBe(true);
			}
		});

		it('rejects every file that parseBackup rejects', () => {
			for (const [text, error] of invalid) {
				if (error === 'not JSON') continue;
				expect(validate(JSON.parse(text)), error).toBe(false);
			}
		});

		it('pins the format and version', () => {
			expect(schema.properties.format.const).toBe(BACKUP_FORMAT);
			expect(schema.properties.version.const).toBe(BACKUP_VERSION);
		});
	});
});
