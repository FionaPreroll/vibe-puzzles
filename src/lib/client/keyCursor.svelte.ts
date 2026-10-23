import type { KeyPress } from '../core/types';
import { direction } from './keys';

/** The key held down for a keyboard move: Ctrl (⌘ on Apple devices), or Shift. */
export type HeldKey = 'ctrl' | 'shift';

/** Keys that come along with a held one, so they never end a keyboard move. */
const MODIFIERS = new Set(['Control', 'Meta', 'Shift']);

/**
 * What a board does with its keyboard cursor. The cursor stands on a place `C` of the board, a
 * cell or a dot: the board knows the places and the moves, `KeyCursor` the keys.
 */
export interface CursorBoard<C> {
	/** Where the cursor shows up on the first arrow key. */
	first(): C;
	/** The place `rows` and `cols` away from `at`, or null off the board. */
	step(at: C, rows: number, cols: number): C | null;
	/** Shift with the arrows draws too, the right button's mark; otherwise only Ctrl or ⌘ does. */
	shiftDraws?: boolean;
	/**
	 * A move held with `key` starts at `from`, the place the cursor leaves. False when none
	 * starts: the board is read-only, or a pointer move is under way, which the arrows add to.
	 */
	begin(from: C, key: HeldKey): boolean;
	/** The cursor went from `from` to `to` with the key held: the move under way takes that step. */
	extend(from: C, to: C): void;
	/** The held key went up: apply the move. */
	commit(): void;
	/** Drop the move under way. */
	cancel(): void;
	/** Space at the cursor. A board without it leaves Space to the page. */
	press?(at: C): void;
	/** The cursor is at `at` after an arrow key, also when the edge of the board kept it there. */
	moved?(at: C): void;
}

/**
 * A board's keyboard cursor. The arrow keys, or W, A, S and D, move it. Holding Ctrl or ⌘ (or
 * Shift, where the board lets it) with the arrows draws a move from the place the cursor leaves,
 * as dragging does, and letting go of the key applies it. The key alone starts nothing: Shift
 * also shows what is under the mouse, and Ctrl comes with a click. Escape drops the move and
 * hides the cursor; any other key while drawing drops the move, as it starts a shortcut
 * (Shift+Z, say).
 */
export class KeyCursor<C> {
	/** Where the cursor is; null while it is hidden. */
	at = $state.raw<C | null>(null);
	/** The key that holds the keyboard move under way. */
	#held: HeldKey | null = null;

	constructor(private readonly board: CursorBoard<C>) {}

	/** Whether a keyboard move is under way. */
	get drawing(): boolean {
		return this.#held != null;
	}

	/** A key went down: true when the cursor used it, so that the page's shortcuts leave it. */
	keydown(e: KeyPress): boolean {
		const dir = direction(e.key);
		const arrow = e.key.startsWith('Arrow');
		// W, A, S and D with Ctrl, ⌘ or Alt belong to the page or the browser.
		if (dir && (arrow || (!e.ctrlKey && !e.metaKey && !e.altKey))) {
			e.preventDefault();
			this.#move(dir[0], dir[1], arrow ? this.#heldWith(e) : null);
			return true;
		}
		const at = this.at;
		if (at == null) return false;
		if (e.key === 'Escape') {
			// The page closes what is open, too.
			this.board.cancel();
			this.#held = null;
			this.at = null;
		} else if (e.key === ' ' && this.board.press) {
			e.preventDefault();
			this.#drop();
			this.board.press(at);
			return true;
		} else if (!MODIFIERS.has(e.key)) {
			this.#drop();
		}
		return false;
	}

	/** A key went up: letting go of the held key applies the move. */
	keyup(e: KeyPress) {
		const held = this.#held;
		const released = held === 'ctrl' ? e.key === 'Control' || e.key === 'Meta' : e.key === 'Shift';
		if (!held || !released) return;
		this.#held = null;
		this.board.commit();
	}

	/** A mouse or pen took over: the cursor hides, and its move makes way for the pointer's. */
	hide() {
		this.#drop();
		this.at = null;
	}

	/** The key an arrow comes with that draws on this board. */
	#heldWith(e: KeyPress): HeldKey | null {
		if (e.ctrlKey || e.metaKey) return 'ctrl';
		return e.shiftKey && this.board.shiftDraws ? 'shift' : null;
	}

	#move(rows: number, cols: number, key: HeldKey | null) {
		const from = this.at;
		if (from == null) {
			// The first arrow only shows the cursor.
			this.at = this.board.first();
			this.board.moved?.(this.at);
			return;
		}
		const to = this.board.step(from, rows, cols);
		if (to == null) {
			this.board.moved?.(from);
			return;
		}
		this.at = to;
		if (key) {
			if (!this.#held && this.board.begin(from, key)) this.#held = key;
			this.board.extend(from, to);
		}
		this.board.moved?.(to);
	}

	/** Drop the keyboard move under way, if any. */
	#drop() {
		if (!this.#held) return;
		this.#held = null;
		this.board.cancel();
	}
}
