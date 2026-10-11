import { describe, expect, it } from 'vitest';
import type { KeyPress } from '../../core/types';
import { findShortcut, modifierName, shortcutList, type ShortcutContext } from './shortcuts';

function press(key: string, mods: Partial<KeyPress> = {}): KeyPress {
	return {
		key,
		code: '',
		repeat: false,
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		target: null,
		preventDefault() {},
		...mods
	};
}

const all: ShortcutContext = { hint: true, colourTool: true };
const none: ShortcutContext = { hint: false, colourTool: false };
const action = (e: KeyPress, ctx = all) => findShortcut(e, ctx)?.action ?? null;

describe('page shortcuts', () => {
	it.each([
		['z', {}, 'undo'],
		['Z', { ctrlKey: true }, 'undo'],
		['z', { metaKey: true }, 'undo'],
		['x', {}, 'redo'],
		['X', { shiftKey: true }, 'redo'],
		['Z', { shiftKey: true }, 'redo'],
		['Z', { ctrlKey: true, shiftKey: true }, 'redo'],
		['y', { ctrlKey: true }, 'redo'],
		['Enter', {}, 'done'],
		['+', { shiftKey: true }, 'newPuzzle'],
		['=', {}, 'newPuzzle'],
		['h', {}, 'hint'],
		['s', { ctrlKey: true }, 'save'],
		['S', { metaKey: true, shiftKey: true }, 'add'],
		['t', {}, 'trial'],
		['T', { shiftKey: true }, 'trialDrop'],
		[']', {}, 'colourTool'],
		['?', { shiftKey: true }, 'help']
	] as const)('%s %o: %s', (key, mods, expected) => {
		expect(action(press(key, mods))).toBe(expected);
	});

	it('leaves keys with Ctrl, ⌘ or Alt that mean something else', () => {
		for (const e of [
			press('x', { ctrlKey: true }),
			press('Enter', { metaKey: true }),
			press('+', { ctrlKey: true }),
			press('=', { altKey: true }),
			press('t', { altKey: true }),
			press('h', { ctrlKey: true }),
			press('y'),
			press('s'),
			press('1'),
			press('Escape')
		]) {
			expect(action(e)).toBeNull();
		}
	});

	it('leaves Enter to a focused button', () => {
		expect(action(press('Enter', { target: { tagName: 'BUTTON' } }))).toBeNull();
		expect(action(press('Enter', { target: { tagName: 'svg' } }))).toBe('done');
	});

	it('offers the hint and the colour tool only where they exist', () => {
		expect(action(press('h'), none)).toBeNull();
		expect(action(press(']'), none)).toBeNull();
	});

	it('keeps the browser from its own use of the key, except for ] and ?', () => {
		expect(findShortcut(press('s', { ctrlKey: true }), all)?.preventDefault).toBe(true);
		expect(findShortcut(press(']'), all)?.preventDefault).toBe(false);
		expect(findShortcut(press('?'), all)?.preventDefault).toBe(false);
	});

	it('lists what the page offers, in the dialog', () => {
		const list = shortcutList('Ctrl', all);
		expect(list.map((s) => s.action)).toEqual([
			'undo',
			'redo',
			'done',
			'newPuzzle',
			'hint',
			'save',
			'add',
			'trial',
			'trialDrop',
			'colourTool',
			'escape',
			'help'
		]);
		expect(list[1]).toEqual({
			action: 'redo',
			keys: ['X', 'Shift+Z', 'Ctrl+Y'],
			label: 'shortcuts.redo'
		});
		const fewer = shortcutList('⌘', none).map((s) => s.action);
		expect(fewer).not.toContain('hint');
		expect(fewer).not.toContain('colourTool');
		expect(shortcutList('⌘', none)[0].keys).toEqual(['Z', '⌘+Z']);
	});

	it('lists only keys the handler takes', () => {
		// Every listed shortcut but Escape (the page's own) is triggered by its first key.
		const keyOf = (label: string): KeyPress => {
			const parts = label.split('+');
			const key = parts.pop() || '+';
			return press(key === 'Enter' ? 'Enter' : key.toLowerCase(), {
				ctrlKey: parts.includes('Ctrl'),
				shiftKey: parts.includes('Shift')
			});
		};
		for (const s of shortcutList('Ctrl', all)) {
			if (s.action === 'escape') continue;
			for (const k of s.keys) expect(action(keyOf(k)), k).toBe(s.action);
		}
	});

	it('names the modifier key of the platform', () => {
		expect(modifierName('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('⌘');
		expect(modifierName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('⌘');
		expect(modifierName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Ctrl');
	});
});
