import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
	BACKUP_FORMAT,
	BACKUP_VERSION,
	createBackup,
	mergeBackup,
	parseBackup,
	restoreBackup,
	type Backup
} from './backup';

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

	describe('merging', () => {
		const backupOf = (data: Record<string, unknown>): Backup => ({
			format: BACKUP_FORMAT,
			version: BACKUP_VERSION,
			exportedAt: '2026-10-01T12:00:00Z',
			app: APP,
			data: Object.fromEntries(
				Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
			)
		});
		const json = (storage: Storage, key: string) => JSON.parse(storage.getItem(`vp:${key}`)!);
		const game = (puzzleId: number, updatedAt: number, solved = false) => ({
			version: 1,
			puzzleId,
			variant: '6n',
			puzzle: {},
			state: {},
			checkpoints: [],
			currentCheckpoint: -1,
			solved,
			startedAt: 0,
			playMs: 0,
			updatedAt
		});

		it('fills in what this browser lacks and keeps what it has', () => {
			const to = memory({ 'vp:night': 'false', 'vp:keep': '1' });
			const n = mergeBackup(to, backupOf({ night: 'true', 'tutorialSeen:tetroid': 'true' }));
			expect(n).toBe(1);
			expect(to.getItem('vp:night')).toBe('false');
			expect(to.getItem('vp:tutorialSeen:tetroid')).toBe('true');
			expect(to.getItem('vp:keep')).toBe('1');
		});

		it('adds up statistics, counting a puzzle solved on both devices once', () => {
			const to = memory({
				'vp:stats:sudoku:9n': JSON.stringify({
					solved: 2,
					streak: 2,
					bestStreak: 2,
					bestMs: 60,
					totalMs: 150,
					recent: [
						{ puzzleId: 2, timeMs: 90, at: 20 },
						{ puzzleId: 1, timeMs: 60, at: 10 }
					],
					solvedIds: [1, 2]
				})
			});
			const backup = backupOf({
				'stats:sudoku:9n': {
					solved: 3,
					streak: 3,
					bestStreak: 3,
					bestMs: 40,
					totalMs: 200,
					recent: [
						{ puzzleId: 4, timeMs: 100, at: 40 },
						{ puzzleId: 3, timeMs: 40, at: 30 },
						{ puzzleId: 1, timeMs: 60, at: 10 }
					],
					solvedIds: [1, 3, 4]
				}
			});
			expect(mergeBackup(to, backup)).toBe(1);
			const merged = json(to, 'stats:sudoku:9n');
			expect(merged).toMatchObject({
				solved: 4,
				streak: 3,
				bestStreak: 3,
				bestMs: 40,
				totalMs: 290,
				solvedIds: [1, 2, 3, 4]
			});
			expect(merged.recent.map((r: { puzzleId: number }) => r.puzzleId)).toEqual([4, 3, 2, 1]);

			// The same backup again brings nothing new.
			expect(mergeBackup(to, backup)).toBe(0);
			expect(json(to, 'stats:sudoku:9n')).toEqual(merged);
		});

		it('joins the solved periods of special types', () => {
			const stats = (periods: string[]) => ({
				solved: periods.length,
				streak: 0,
				bestStreak: 0,
				bestMs: null,
				totalMs: 0,
				recent: [],
				periods,
				lastPeriod: periods.at(-1)
			});
			const to = memory({
				'vp:stats:loop:daily': JSON.stringify(stats(['2026-10-01', '2026-10-03']))
			});
			mergeBackup(to, backupOf({ 'stats:loop:daily': stats(['2026-10-02']) }));
			expect(json(to, 'stats:loop:daily')).toMatchObject({
				solved: 3,
				periods: ['2026-10-01', '2026-10-02', '2026-10-03'],
				lastPeriod: '2026-10-03'
			});
		});

		it('keeps the newer saved game, the solved one of the same puzzle, and an open game', () => {
			const to = memory({
				'vp:save:tetroid:6n': JSON.stringify(game(1, 100)),
				'vp:save:loop:daily:2026-10-01': JSON.stringify(game(7, 300)),
				'vp:save:pipes:5n': JSON.stringify(game(5, 100)),
				'vp:save:sudoku:9n': JSON.stringify(game(8, 100))
			});
			mergeBackup(
				to,
				backupOf({
					'save:tetroid:6n': game(2, 200),
					'save:loop:daily:2026-10-01': game(7, 200, true),
					'save:pipes:5n': game(6, 200, true),
					'save:sudoku:9n': game(9, 50),
					'save:calcudoku:5n': game(3, 10)
				})
			);
			expect(json(to, 'save:tetroid:6n').puzzleId).toBe(2);
			expect(json(to, 'save:loop:daily:2026-10-01').solved).toBe(true);
			expect(json(to, 'save:pipes:5n').puzzleId).toBe(5);
			expect(json(to, 'save:sudoku:9n').puzzleId).toBe(8);
			expect(json(to, 'save:calcudoku:5n').puzzleId).toBe(3);
		});

		it('keeps the newer settings and joins the collection puzzles played', () => {
			const to = memory({
				'vp:settings:sudoku': JSON.stringify({ values: { a: true }, updatedAt: 5 }),
				'vp:settings:loop': JSON.stringify({ values: { a: true }, updatedAt: 5 }),
				'vp:bankPlayed:loop:7n': '[1,2]'
			});
			mergeBackup(
				to,
				backupOf({
					'settings:sudoku': { values: { a: false }, updatedAt: 9 },
					'settings:loop': { values: { a: false }, updatedAt: 1 },
					'bankPlayed:loop:7n': [2, 3]
				})
			);
			expect(json(to, 'settings:sudoku').values.a).toBe(false);
			expect(json(to, 'settings:loop').values.a).toBe(true);
			expect(json(to, 'bankPlayed:loop:7n')).toEqual([1, 2, 3]);
		});

		it('keeps the player here, and leaves out uploads of another player', () => {
			const me = { id: 'me', name: 'Me', token: 't1' };
			const to = memory({ 'vp:player': JSON.stringify(me) });
			mergeBackup(
				to,
				backupOf({
					player: { id: 'other', name: 'Other', token: 't2' },
					outbox: { saves: {}, scores: [{ game: 'loop', variant: '7n', puzzleId: 1 }] }
				})
			);
			expect(json(to, 'player')).toEqual(me);
			expect(to.getItem('vp:outbox')).toBeNull();

			const fresh = memory();
			mergeBackup(fresh, backupOf({ player: me, outbox: { saves: {}, scores: [] } }));
			expect(json(fresh, 'player')).toEqual(me);
			expect(fresh.getItem('vp:outbox')).not.toBeNull();
		});
	});
});
