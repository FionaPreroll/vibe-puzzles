import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';
import de from './de';
import en from './en';
import {
	i18n,
	initLocale,
	setLocale,
	settingLabel,
	t,
	tList,
	toolLabel,
	variantLabel
} from './index.svelte';

/** Every leaf of a dictionary as [dotted key, value]. */
function leaves(node: unknown, prefix = ''): [string, unknown][] {
	if (node == null || typeof node !== 'object' || Array.isArray(node)) return [[prefix, node]];
	return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

const placeholders = (text: unknown) =>
	[...JSON.stringify(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function stubBrowser(languages: string[], stored?: string) {
	const storage = new MemoryStorage();
	if (stored) storage.setItem('vp:locale', stored);
	vi.stubGlobal('localStorage', storage);
	vi.stubGlobal('navigator', { languages });
	vi.stubGlobal('document', { documentElement: { lang: '' } });
	return storage;
}

afterEach(() => {
	vi.unstubAllGlobals();
	i18n.locale = 'en';
});

describe('translations', () => {
	const english = new Map(leaves(en));
	const german = new Map(leaves(de));

	it('German has exactly the English keys', () => {
		expect([...german.keys()].sort()).toEqual([...english.keys()].sort());
	});

	it('German texts use the same placeholders and list lengths', () => {
		for (const [key, value] of english) {
			const other = german.get(key);
			expect(placeholders(other), key).toEqual(placeholders(value));
			if (Array.isArray(value)) expect((other as unknown[]).length, key).toBe(value.length);
			expect(other, key).not.toBe('');
		}
	});
});

describe('t', () => {
	it('fills placeholders and keeps unknown ones', () => {
		expect(t('session.solved', { time: '01:00' })).toBe('Solved in 01:00!');
		expect(t('session.solved')).toBe('Solved in {time}!');
		expect(t('session.ranked', { time: '1' })).toContain('{rank}');
	});

	it('falls back to the key for unknown or non-text entries', () => {
		expect(t('no.such.key')).toBe('no.such.key');
		expect(t('session')).toBe('session');
	});

	it('follows the locale', () => {
		stubBrowser([]);
		setLocale('de');
		expect(t('session.solved', { time: '5' })).toBe('Gelöst in 5!');
		expect(document.documentElement.lang).toBe('de');
		expect(localStorage.getItem('vp:locale')).toBe('de');
	});

	it('returns lists, or an empty list for anything else', () => {
		const rules = tList('games.tetroid.rules');
		expect(rules.length).toBeGreaterThan(0);
		expect(tList('session.solved')).toEqual([]);
	});
});

describe('initLocale', () => {
	it('prefers the stored choice', () => {
		stubBrowser(['en-US'], 'de');
		initLocale();
		expect(i18n.locale).toBe('de');
	});

	it('uses the first supported browser language', () => {
		stubBrowser(['fr-FR', 'de-AT', 'en']);
		initLocale();
		expect(i18n.locale).toBe('de');
		expect(document.documentElement.lang).toBe('de');
	});

	it('defaults to English and survives blocked storage', () => {
		stubBrowser(['fr']);
		vi.stubGlobal('localStorage', {
			getItem() {
				throw new Error('blocked');
			},
			setItem() {
				throw new Error('blocked');
			}
		});
		initLocale();
		expect(i18n.locale).toBe('en');
		expect(() => setLocale('de')).not.toThrow();
	});
});

describe('labels', () => {
	it('names puzzle types', () => {
		const base = { key: '6n', label: '', width: 6, height: 6 } as const;
		expect(variantLabel({ ...base, difficulty: 'hard' })).toBe('6×6 Hard');
		expect(variantLabel({ ...base, difficulty: 'normal', special: 'daily' })).toBe(
			t('special.daily')
		);
	});

	it('prefers translated tool and setting names over the English fallback', () => {
		expect(toolLabel('tetroid', { id: 'no-such-tool', label: 'Fallback' })).toBe('Fallback');
		expect(settingLabel({ key: 'no-such-setting', label: 'Fallback' })).toBe('Fallback');
		expect(settingLabel({ key: 'autoSubmit', label: 'x' })).toBe(t('setting.autoSubmit'));
		const [shared] = leaves(en.tool);
		const id = shared[0];
		expect(toolLabel('pinwheel', { id, label: 'x' })).toBe(shared[1]);
		// A game can rename a shared tool.
		expect(toolLabel('pinwheel', { id: 'black', label: 'x' })).toBe(en.games.pinwheel.tool.black);
	});
});
