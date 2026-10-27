import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';
import { LOOP_SETTINGS } from '../games/loop/settings';
import { PINWHEEL_SETTINGS } from '../games/pinwheel/settings';
import { PIPES_SETTINGS } from '../games/pipes/settings';
import { SUDOKU_SETTINGS } from '../games/sudoku/settings';
import { TETROID_SETTINGS } from '../games/tetroid/settings';
import de from './de';
import en from './en';
import {
	controlsKeys,
	i18n,
	initLocale,
	nextDailyText,
	setLocale,
	settingHelp,
	settingLabel,
	t,
	tList,
	tSteps,
	toolHint,
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
		expect(t('session.solved', { time: '5' })).toBe('In 5 gelöst!');
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
		expect(variantLabel({ ...base, difficulty: 'easy', mode: 'calc' })).toBe('Calcudoku 6×6 Easy');
		// Wrap takes the place of the difficulty.
		expect(variantLabel({ ...base, difficulty: 'normal', wrap: true })).toBe('6×6 Wrap');
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

	it('explains every setting of every game and mode', () => {
		const lists = {
			tetroid: TETROID_SETTINGS,
			pinwheel: PINWHEEL_SETTINGS,
			sudoku: SUDOKU_SETTINGS,
			loop: LOOP_SETTINGS,
			pipes: PIPES_SETTINGS
		};
		for (const [game, list] of Object.entries(lists)) {
			for (const mode of game === 'sudoku' ? [undefined, 'calc'] : [undefined]) {
				for (const s of list)
					expect(settingHelp(s.key, game, mode), `${game} ${s.key}`).not.toBe('');
			}
		}
		expect(settingHelp('no-such-setting', 'tetroid')).toBe('');
	});

	it('words setting texts for the game and its mode', () => {
		// Shared text, a game's own, a mode's own.
		expect(settingHelp('hideTimer', 'loop')).toBe(en.settingHelp.hideTimer);
		expect(settingHelp('highlightErrors')).toBe(en.settingHelp.highlightErrors);
		expect(settingHelp('highlightErrors', 'loop')).toBe(en.games.loop.settingHelp.highlightErrors);
		expect(settingHelp('highlightErrors', 'sudoku')).toBe(
			en.games.sudoku.settingHelp.highlightErrors
		);
		expect(settingHelp('highlightErrors', 'sudoku', 'calc')).toBe(
			en.games.sudoku.modes.calc.settingHelp.highlightErrors
		);
		// A mode without its own text takes the game's.
		expect(settingHelp('hideControls', 'sudoku', 'calc')).toBe(
			en.games.sudoku.settingHelp.hideControls
		);
		const lines = { key: 'highlightLines', label: 'x' };
		expect(settingLabel(lines, 'sudoku')).toBe(en.setting.highlightLines);
		expect(settingLabel(lines, 'sudoku', 'calc')).toBe(
			en.games.sudoku.modes.calc.setting.highlightLines
		);
		stubBrowser([]);
		setLocale('de');
		expect(settingLabel(lines, 'sudoku', 'calc')).toBe('Zeile und Spalte hervorheben');
		expect(settingHelp('autoNotes', 'sudoku', 'calc')).toBe(
			de.games.sudoku.modes.calc.settingHelp.autoNotes
		);
	});

	it('explains tools in their tooltip hints', () => {
		expect(toolHint('pinwheel', 'rotate')).toBe(en.games.pinwheel.toolHint.rotate);
		expect(toolHint('sudoku', 'digit')).toBe('');
		stubBrowser([]);
		setLocale('de');
		expect(toolHint('tetroid', 'rotate')).toBe(de.games.tetroid.toolHint.rotate);
	});

	it("says how to play the board with the keys, naming the device's Ctrl key", () => {
		expect(controlsKeys('tetroid', 'Ctrl')).toBe(
			en.games.tetroid.controlsKeys.replace('{mod}', 'Ctrl')
		);
		expect(controlsKeys('loop', '⌘')).toContain('Hold ⌘ and press the arrows');
		// Sudoku's mouse text names its keys already.
		expect(controlsKeys('sudoku', 'Ctrl')).toBe('');
		stubBrowser([]);
		setLocale('de');
		expect(controlsKeys('pinwheel', 'Ctrl')).toBe(
			de.games.pinwheel.controlsKeys.replace('{mod}', 'Ctrl')
		);
	});
});

describe('nextDailyText', () => {
	it('counts down to midnight UTC and names the local time', () => {
		const now = Date.UTC(2026, 9, 8, 21, 52, 30);
		const at = new Date(Date.UTC(2026, 9, 9)).toLocaleTimeString('en', {
			hour: '2-digit',
			minute: '2-digit'
		});
		expect(nextDailyText(now)).toBe(`New daily puzzle in 2 h 08 min, at ${at}`);
		i18n.locale = 'de';
		expect(nextDailyText(now)).toMatch(/^Neues Tagesrätsel in 2 h 08 min, um \d\d:00 Uhr$/);
	});
});

describe('tSteps', () => {
	it('reads the step texts of the current language', () => {
		expect(tSteps('games.sudoku.tutorial')[0]).toEqual({ text: en.games.sudoku.tutorial[0].text });
		expect(tSteps('games.pinwheel.tutorial')[2].task).toBe(en.games.pinwheel.tutorial[2].task);
		i18n.locale = 'de';
		expect(tSteps('games.pinwheel.tutorial')[2].task).toBe(de.games.pinwheel.tutorial[2].task);
		expect(tSteps('games.nope.tutorial')).toEqual([]);
	});
});
