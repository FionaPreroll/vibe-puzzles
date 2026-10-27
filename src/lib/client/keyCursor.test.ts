import { describe, expect, it } from 'vitest';
import type { KeyPress } from '../core/types';
import { KeyCursor, type CursorBoard } from './keyCursor.svelte';

type Modifiers = Partial<Pick<KeyPress, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>>;

/** A key press that notes whether the browser's default was prevented. */
function key(k: string, modifiers: Modifiers = {}) {
	const e = {
		key: k,
		code: '',
		repeat: false,
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		target: null,
		...modifiers,
		prevented: false,
		preventDefault() {
			e.prevented = true;
		}
	};
	return e;
}

interface Options {
	shiftDraws?: boolean;
	/** Space presses at the cursor. */
	press?: boolean;
	/** What `begin` answers: false while a pointer move is under way. */
	begins?: boolean;
	/** Notes where the cursor went. */
	moved?: number[];
}

/** A 3×3 board of cells 0–8 that notes what the cursor asks of it. */
function cursorOn(options: Options = {}) {
	const calls: string[] = [];
	const cells: CursorBoard<number> = {
		first: () => 0,
		step(at, rows, cols) {
			const r = Math.floor(at / 3) + rows;
			const c = (at % 3) + cols;
			return r < 0 || r > 2 || c < 0 || c > 2 ? null : r * 3 + c;
		},
		shiftDraws: options.shiftDraws,
		begin(from, held) {
			calls.push(`begin ${from} ${held}`);
			return options.begins ?? true;
		},
		extend: (from, to) => calls.push(`extend ${from} ${to}`),
		commit: () => calls.push('commit'),
		cancel: () => calls.push('cancel')
	};
	if (options.press) cells.press = (at) => calls.push(`press ${at}`);
	const moved = options.moved;
	if (moved) cells.moved = (at) => moved.push(at);
	return { cursor: new KeyCursor(cells), calls };
}

describe('KeyCursor', () => {
	it('shows up on the first arrow and moves with the arrows and W, A, S, D', () => {
		const moved: number[] = [];
		const { cursor, calls } = cursorOn({ moved });
		const right = key('ArrowRight');
		expect(cursor.keydown(right)).toBe(true);
		expect(right.prevented).toBe(true);
		expect(cursor.at).toBe(0);

		cursor.keydown(key('ArrowRight'));
		cursor.keydown(key('d'));
		// With Shift (or Caps Lock) too; the edge of the board keeps the cursor where it is.
		cursor.keydown(key('D', { shiftKey: true }));
		expect(cursor.at).toBe(2);
		for (const k of ['s', 'ArrowDown', 'a', 'W']) cursor.keydown(key(k));
		expect(cursor.at).toBe(4);
		expect(moved).toEqual([0, 1, 2, 2, 5, 8, 7, 4]);
		expect(calls).toEqual([]);
	});

	it('leaves the other keys to the page, and all of them but the arrows while hidden', () => {
		const { cursor, calls } = cursorOn({ press: true });
		const keys = [
			key('w', { ctrlKey: true }),
			key('s', { metaKey: true }),
			key('a', { altKey: true }),
			key(' '),
			key('Escape'),
			key('z')
		];
		for (const e of keys) {
			expect(cursor.keydown(e), e.key).toBe(false);
			expect(e.prevented, e.key).toBe(false);
		}
		expect(cursor.at).toBeNull();
		expect(calls).toEqual([]);
	});

	it('draws with Ctrl from the place it leaves, and letting go applies the move', () => {
		const { cursor, calls } = cursorOn();
		cursor.keydown(key('ArrowRight'));
		// Ctrl alone starts nothing: it may come with a click.
		expect(cursor.keydown(key('Control', { ctrlKey: true }))).toBe(false);
		expect(cursor.drawing).toBe(false);

		cursor.keydown(key('ArrowRight', { ctrlKey: true }));
		cursor.keydown(key('ArrowDown', { ctrlKey: true }));
		expect(cursor.drawing).toBe(true);
		expect(calls).toEqual(['begin 0 ctrl', 'extend 0 1', 'extend 1 4']);
		cursor.keyup(key('ArrowDown', { ctrlKey: true }));
		cursor.keyup(key('Shift', { ctrlKey: true }));
		expect(calls).toHaveLength(3);

		cursor.keyup(key('Control'));
		cursor.keyup(key('Control'));
		expect(calls.slice(3)).toEqual(['commit']);
		expect(cursor.drawing).toBe(false);
	});

	it('draws with ⌘ like Ctrl', () => {
		const { cursor, calls } = cursorOn();
		cursor.keydown(key('ArrowDown'));
		cursor.keydown(key('ArrowDown', { metaKey: true }));
		cursor.keyup(key('Meta'));
		expect(calls).toEqual(['begin 0 ctrl', 'extend 0 3', 'commit']);
	});

	it('draws with Shift only where the board lets it, and letting go of Shift applies that', () => {
		const plain = cursorOn();
		plain.cursor.keydown(key('ArrowRight'));
		plain.cursor.keydown(key('ArrowRight', { shiftKey: true }));
		expect(plain.cursor.at).toBe(1);
		expect(plain.calls).toEqual([]);

		const { cursor, calls } = cursorOn({ shiftDraws: true });
		cursor.keydown(key('ArrowRight'));
		cursor.keydown(key('ArrowRight', { shiftKey: true }));
		// Ctrl as well: the move goes on, and stays Shift's.
		cursor.keydown(key('Control', { ctrlKey: true, shiftKey: true }));
		cursor.keydown(key('ArrowDown', { ctrlKey: true, shiftKey: true }));
		cursor.keyup(key('Control', { shiftKey: true }));
		expect(calls).toEqual(['begin 0 shift', 'extend 0 1', 'extend 1 4']);
		cursor.keyup(key('Shift'));
		expect(calls.slice(3)).toEqual(['commit']);
	});

	it('starts nothing on the arrow that shows it, nor at the edge of the board', () => {
		const moved: number[] = [];
		const { cursor, calls } = cursorOn({ moved });
		cursor.keydown(key('ArrowLeft', { ctrlKey: true }));
		cursor.keydown(key('ArrowLeft', { ctrlKey: true }));
		cursor.keydown(key('ArrowUp', { ctrlKey: true }));
		cursor.keyup(key('Control'));
		expect(cursor.at).toBe(0);
		expect(moved).toEqual([0, 0, 0]);
		expect(calls).toEqual([]);
	});

	it('adds its steps to a pointer move under way, which the pointer applies', () => {
		const { cursor, calls } = cursorOn({ begins: false });
		cursor.keydown(key('ArrowRight'));
		cursor.keydown(key('ArrowRight', { ctrlKey: true }));
		cursor.keydown(key('ArrowRight', { ctrlKey: true }));
		cursor.keyup(key('Control'));
		expect(calls).toEqual(['begin 0 ctrl', 'extend 0 1', 'begin 1 ctrl', 'extend 1 2']);
		expect(cursor.drawing).toBe(false);
	});

	it('drops the move and hides on Escape, which goes on to the page', () => {
		const { cursor, calls } = cursorOn();
		cursor.keydown(key('ArrowRight'));
		cursor.keydown(key('ArrowRight', { ctrlKey: true }));
		const escape = key('Escape', { ctrlKey: true });
		expect(cursor.keydown(escape)).toBe(false);
		expect(escape.prevented).toBe(false);
		cursor.keyup(key('Control'));
		expect(cursor.at).toBeNull();
		expect(calls).toEqual(['begin 0 ctrl', 'extend 0 1', 'cancel']);

		// Without a keyboard move, Escape drops what the board has under way all the same.
		cursor.keydown(key('ArrowRight'));
		cursor.keydown(key('Escape'));
		expect(calls.slice(3)).toEqual(['cancel']);
		expect(cursor.at).toBeNull();
	});

	it('drops the move on another key, which starts a shortcut, but not on modifiers', () => {
		const { cursor, calls } = cursorOn();
		cursor.keydown(key('ArrowRight'));
		cursor.keydown(key('ArrowRight', { ctrlKey: true }));
		for (const k of ['Control', 'Meta', 'Shift']) cursor.keydown(key(k, { ctrlKey: true }));
		expect(cursor.drawing).toBe(true);

		expect(cursor.keydown(key('z', { ctrlKey: true }))).toBe(false);
		cursor.keyup(key('Control'));
		expect(calls).toEqual(['begin 0 ctrl', 'extend 0 1', 'cancel']);
		// Without a move, other keys change nothing.
		cursor.keydown(key('z'));
		expect(calls).toHaveLength(3);
		expect(cursor.at).toBe(1);
	});

	it('presses Space at the cursor where the board takes it, dropping a move under way', () => {
		const { cursor, calls } = cursorOn({ press: true });
		cursor.keydown(key('ArrowRight'));
		const space = key(' ');
		expect(cursor.keydown(space)).toBe(true);
		expect(space.prevented).toBe(true);
		cursor.keydown(key('ArrowRight', { ctrlKey: true }));
		cursor.keydown(key(' ', { ctrlKey: true }));
		cursor.keyup(key('Control'));
		expect(calls).toEqual(['press 0', 'begin 0 ctrl', 'extend 0 1', 'cancel', 'press 1']);

		const other = cursorOn();
		other.cursor.keydown(key('ArrowRight'));
		const left = key(' ');
		expect(other.cursor.keydown(left)).toBe(false);
		expect(left.prevented).toBe(false);
	});

	it('drops the move when the window loses the focus, so that pressing Ctrl again applies none', () => {
		const { cursor, calls } = cursorOn();
		cursor.keydown(key('ArrowRight'));
		cursor.blur();
		cursor.keydown(key('ArrowRight', { ctrlKey: true }));
		cursor.blur();
		expect(cursor.drawing).toBe(false);
		// Ctrl went up in another window; back here, it goes down and up again.
		cursor.keydown(key('Control', { ctrlKey: true }));
		cursor.keyup(key('Control'));
		expect(calls).toEqual(['begin 0 ctrl', 'extend 0 1', 'cancel']);
		expect(cursor.at).toBe(1);
	});

	it('drops a move whose key went up unseen at the next arrow, which may start another', () => {
		const { cursor, calls } = cursorOn({ shiftDraws: true });
		cursor.keydown(key('ArrowRight'));
		cursor.keydown(key('ArrowRight', { ctrlKey: true }));
		cursor.keydown(key('ArrowRight'));
		expect(cursor.at).toBe(2);
		cursor.keydown(key('ArrowDown', { shiftKey: true }));
		cursor.keydown(key('a'));
		expect(calls).toEqual([
			'begin 0 ctrl',
			'extend 0 1',
			'cancel',
			'begin 2 shift',
			'extend 2 5',
			'cancel'
		]);
		// W, A, S and D with the key still down move on and keep the move.
		cursor.keydown(key('ArrowRight', { shiftKey: true }));
		cursor.keydown(key('D', { shiftKey: true }));
		cursor.keyup(key('Shift'));
		expect(calls.slice(6)).toEqual(['begin 4 shift', 'extend 4 5', 'commit']);
	});

	it('hides for a mouse or pen, whose move takes the place of its own', () => {
		const { cursor, calls } = cursorOn();
		cursor.keydown(key('ArrowRight'));
		cursor.hide();
		expect(cursor.at).toBeNull();
		expect(calls).toEqual([]);

		cursor.keydown(key('ArrowRight'));
		cursor.keydown(key('ArrowRight', { ctrlKey: true }));
		cursor.hide();
		cursor.keyup(key('Control'));
		expect(cursor.at).toBeNull();
		expect(calls).toEqual(['begin 0 ctrl', 'extend 0 1', 'cancel']);
	});
});
