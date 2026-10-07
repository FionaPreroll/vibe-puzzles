import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSettings, loadTouchMode, saveTouchMode, setNight, theme } from './settings.svelte';

const INFO = [
	{ key: 'hideControls', label: 'Hide', default: false, deviceOnly: true },
	{ key: 'autoSubmit', label: 'Auto', default: true }
];

beforeEach(() => {
	const map = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k)
	});
});

afterEach(() => vi.unstubAllGlobals());

describe('touch mode', () => {
	it('draws by default and remembers a choice', () => {
		expect(loadTouchMode()).toBe('draw');
		saveTouchMode('pan');
		expect(loadTouchMode()).toBe('pan');
	});
});

describe('game settings', () => {
	it('starts from the defaults and keeps night mode out of them', () => {
		setNight(true);
		const s = new GameSettings('g', INFO);
		expect(s.values).toEqual({ hideControls: false, autoSubmit: true });
		expect(theme.night).toBe(true);
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
});
