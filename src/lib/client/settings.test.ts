import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';
import { load, save } from './storage';
import {
	GameSettings,
	loadTool,
	loadTouchMode,
	saveTool,
	saveTouchMode,
	setNight,
	theme
} from './settings.svelte';

const INFO = [
	{ key: 'hideControls', label: 'Hide', default: false, deviceOnly: true },
	{ key: 'autoSubmit', label: 'Auto', default: true }
];

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('touch mode and tool', () => {
	it('draws by default and remembers a choice', () => {
		expect(loadTouchMode()).toBe('draw');
		saveTouchMode('pan');
		expect(loadTouchMode()).toBe('pan');
	});

	it('remembers the last tool of each game', () => {
		expect(loadTool('tetroid', 'black')).toBe('black');
		saveTool('tetroid', 'cross');
		expect(loadTool('tetroid', 'black')).toBe('cross');
		expect(loadTool('pinwheel', 'black')).toBe('black');
	});
});

describe('night mode', () => {
	it('applies to the whole site and is remembered', () => {
		setNight(true);
		expect(theme.night).toBe(true);
		expect(load('night', false)).toBe(true);
		setNight(false);
		expect(load('night', true)).toBe(false);
	});
});

describe('game settings', () => {
	it('starts from the defaults and keeps night mode out of them', () => {
		setNight(true);
		const s = new GameSettings('g', INFO);
		expect(s.values).toEqual({ hideControls: false, autoSubmit: true });
		expect(s.updatedAt).toBe(0);
		expect(theme.night).toBe(true);
	});

	it('restores stored values and fills in new settings', () => {
		save('settings:g', { values: { autoSubmit: false }, updatedAt: 5 });
		const s = new GameSettings('g', INFO);
		expect(s.values).toEqual({ hideControls: false, autoSubmit: false });
		expect(s.updatedAt).toBe(5);
	});

	it('saves every change with its time', () => {
		vi.useFakeTimers({ now: 1000 });
		const s = new GameSettings('g', INFO);
		s.set('autoSubmit', false);
		expect(load('settings:g', null)).toEqual({
			values: { hideControls: false, autoSubmit: false },
			updatedAt: 1000
		});
	});

	it('syncs only shared settings and takes newer remote ones', () => {
		const s = new GameSettings('g', INFO);
		s.set('hideControls', true);
		expect(s.syncable().values).toEqual({ autoSubmit: true });
		s.merge({ values: { autoSubmit: false, hideControls: false }, updatedAt: s.updatedAt + 1 });
		expect(s.values).toEqual({ hideControls: true, autoSubmit: false });
		s.merge({ values: { autoSubmit: true }, updatedAt: 1 });
		expect(s.values.autoSubmit).toBe(false);
		expect(new GameSettings('g', INFO).values.autoSubmit).toBe(false);
	});

	it('ignores remote values of the wrong type', () => {
		const s = new GameSettings('g', INFO);
		s.merge({ values: { autoSubmit: 'no' } as never, updatedAt: 20 });
		expect(s.values.autoSubmit).toBe(true);
		expect(s.updatedAt).toBe(20);
	});
});
