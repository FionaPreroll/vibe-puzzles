import { describe, expect, it } from 'vitest';
import {
	bankPlayedKey,
	boardZoomKey,
	KEY,
	parseSaveKey,
	SAVE_PREFIX,
	saveKey,
	settingsKey,
	statsKey,
	toolKey,
	tutorialDoneKey,
	tutorialSeenKey,
	type SaveSlot
} from './storageKeys';

describe('save keys', () => {
	it.each<[SaveSlot, string]>([
		[{ game: 'tetroid', variant: '6n' }, 'save:tetroid:6n'],
		[{ game: 'sudoku', variant: 'daily', period: '2026-10-10' }, 'save:sudoku:daily:2026-10-10'],
		[{ game: 'pinwheel', variant: 'weekly', period: '2026-W41' }, 'save:pinwheel:weekly:2026-W41'],
		[{ game: 'tetroid', variant: 'monthly', archive: true }, 'save:tetroid:monthly:archive']
	])('round-trips %o as %s', (slot, key) => {
		expect(saveKey(slot)).toBe(key);
		expect(key.startsWith(SAVE_PREFIX)).toBe(true);
		expect(parseSaveKey(key)).toEqual(slot);
	});

	it('puts a period before the archive', () => {
		const slot = { game: 'sudoku', variant: 'daily', period: '2026-10-10', archive: true };
		expect(saveKey(slot)).toBe('save:sudoku:daily:2026-10-10');
	});

	it.each([
		'stats:tetroid:6n',
		'save',
		'save:',
		'save:tetroid',
		'save:tetroid:',
		'save::6n',
		'save:tetroid:6n:',
		'save:tetroid:daily:2026-10-10:x',
		'saved:tetroid:6n'
	])('rejects %s', (key) => {
		expect(parseSaveKey(key)).toBeNull();
	});
});

describe('other keys', () => {
	it('keep the formats that existing saves use', () => {
		expect(statsKey('tetroid', '6n')).toBe('stats:tetroid:6n');
		expect(bankPlayedKey('sudoku', '9e')).toBe('bankPlayed:sudoku:9e');
		expect(boardZoomKey('pinwheel', '7n')).toBe('boardZoom:pinwheel:7n');
		expect(settingsKey('sudoku')).toBe('settings:sudoku');
		expect(toolKey('tetroid')).toBe('tool:tetroid');
		expect(tutorialSeenKey('tetroid')).toBe('tutorialSeen:tetroid');
		expect(tutorialDoneKey('sudoku')).toBe('tutorialDone:sudoku');
		expect(tutorialDoneKey('sudoku', 'calc')).toBe('tutorialDone:sudoku:calc');
		expect(Object.values(KEY)).toEqual([
			'player',
			'night',
			'look',
			'touch',
			'puzzleSource',
			'rulesHidden',
			'offlineMode',
			'updateCheck',
			'outbox'
		]);
	});

	it('never look like a save', () => {
		const others = [
			statsKey('g', 'v'),
			bankPlayedKey('g', 'v'),
			boardZoomKey('g', 'v'),
			settingsKey('g'),
			toolKey('g'),
			tutorialSeenKey('g'),
			tutorialDoneKey('g', 'm'),
			...Object.values(KEY)
		];
		for (const key of others) expect(parseSaveKey(key), key).toBeNull();
	});
});
