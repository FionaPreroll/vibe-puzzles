import { describe, expect, it, vi } from 'vitest';
import { direction, isTyping, KeyDispatcher } from './keys';

/** Just enough of a KeyboardEvent. */
function key(k: string, init: { code?: string; tag?: string; editable?: boolean } = {}) {
	let prevented = false;
	return {
		key: k,
		code: init.code ?? '',
		repeat: false,
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		target: init.tag ? { tagName: init.tag, isContentEditable: !!init.editable } : null,
		get defaultPrevented() {
			return prevented;
		},
		preventDefault() {
			prevented = true;
		}
	} as unknown as KeyboardEvent;
}

describe('key dispatcher', () => {
	it('gives the board each key first and the shortcuts only what it leaves', () => {
		const shortcuts = vi.fn();
		const keys = new KeyDispatcher(shortcuts, () => false);
		const board = { keydown: vi.fn((e: { key: string }) => e.key === '0') };
		keys.attach(board);

		// Shift+0 on a German keyboard: "=" erases a Sudoku cell, but must not also start a puzzle.
		keys.keydown(key('0', { code: 'Digit0' }));
		expect(board.keydown).toHaveBeenCalledTimes(1);
		expect(shortcuts).not.toHaveBeenCalled();

		const z = key('z');
		keys.keydown(z);
		expect(board.keydown).toHaveBeenCalledTimes(2);
		expect(shortcuts).toHaveBeenCalledWith(z);
	});

	it('runs the shortcuts alone without a board', () => {
		const shortcuts = vi.fn();
		const keys = new KeyDispatcher(shortcuts, () => false);
		keys.keydown(key('z'));
		expect(shortcuts).toHaveBeenCalledTimes(1);
		// Releases and blur go nowhere.
		expect(keys.keyup(key('z'))).toBeUndefined();
		expect(keys.blur()).toBeUndefined();
	});

	it('keeps typing and open dialogs away from the board, not from the shortcuts', () => {
		const shortcuts = vi.fn();
		let dialog = false;
		const keys = new KeyDispatcher(shortcuts, () => dialog);
		const board = { keydown: vi.fn(() => true) };
		keys.attach(board);

		keys.keydown(key('ArrowLeft', { tag: 'INPUT' }));
		keys.keydown(key('a', { tag: 'DIV', editable: true }));
		dialog = true;
		keys.keydown(key('ArrowLeft'));
		expect(board.keydown).not.toHaveBeenCalled();
		expect(shortcuts).toHaveBeenCalledTimes(3);
	});

	it('ignores a key that an element already used', () => {
		const shortcuts = vi.fn();
		const keys = new KeyDispatcher(shortcuts, () => false);
		const board = { keydown: vi.fn(() => false) };
		keys.attach(board);
		const e = key('Enter', { tag: 'BUTTON' });
		e.preventDefault();
		keys.keydown(e);
		expect(board.keydown).not.toHaveBeenCalled();
		expect(shortcuts).not.toHaveBeenCalled();
	});

	it('passes releases and blur to the board, wherever the focus is', () => {
		const keys = new KeyDispatcher(undefined, () => true);
		const board = { keydown: vi.fn(() => false), keyup: vi.fn(), blur: vi.fn() };
		keys.attach(board);
		keys.keyup(key('Control', { tag: 'INPUT' }));
		keys.blur();
		expect(board.keyup).toHaveBeenCalledTimes(1);
		expect(board.blur).toHaveBeenCalledTimes(1);
		// The default shortcuts do nothing.
		expect(() => keys.keydown(key('z'))).not.toThrow();
	});

	it('lets a detached board go, but not a newer one', () => {
		const shortcuts = vi.fn();
		const keys = new KeyDispatcher(shortcuts, () => false);
		const old = { keydown: vi.fn(() => true) };
		const current = { keydown: vi.fn(() => true) };
		const detachOld = keys.attach(old);
		const detachCurrent = keys.attach(current);
		detachOld();
		keys.keydown(key('a'));
		expect(old.keydown).not.toHaveBeenCalled();
		expect(current.keydown).toHaveBeenCalledTimes(1);
		detachCurrent();
		keys.keydown(key('a'));
		expect(current.keydown).toHaveBeenCalledTimes(1);
		expect(shortcuts).toHaveBeenCalledTimes(1);
	});

	it('finds open dialogs in the page by default', () => {
		const board = { keydown: vi.fn(() => true) };
		const shortcuts = vi.fn();
		const keys = new KeyDispatcher(shortcuts);
		keys.attach(board);
		// No document (as on the server): nothing is open.
		keys.keydown(key('a'));
		expect(board.keydown).toHaveBeenCalledTimes(1);
		vi.stubGlobal('document', { querySelector: (q: string) => (q === 'dialog[open]' ? {} : null) });
		try {
			keys.keydown(key('a'));
		} finally {
			vi.unstubAllGlobals();
		}
		expect(board.keydown).toHaveBeenCalledTimes(1);
		expect(shortcuts).toHaveBeenCalledTimes(1);
	});
});

describe('keys', () => {
	it('moves with the arrows and W/A/S/D in either case', () => {
		expect(direction('ArrowUp')).toEqual([-1, 0]);
		expect(direction('ArrowRight')).toEqual([0, 1]);
		expect(direction('a')).toEqual([0, -1]);
		expect(direction('S')).toEqual([1, 0]);
		expect(direction('x')).toBeNull();
		expect(direction('Enter')).toBeNull();
	});

	it('tells typing into a field from other keys', () => {
		expect(isTyping(key('a', { tag: 'INPUT' }))).toBe(true);
		expect(isTyping(key('a', { tag: 'TEXTAREA' }))).toBe(true);
		expect(isTyping(key('a', { tag: 'DIV', editable: true }))).toBe(true);
		expect(isTyping(key('a', { tag: 'BUTTON' }))).toBe(false);
		expect(isTyping(key('a'))).toBe(false);
	});
});
