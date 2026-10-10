import type { BoardKeys } from '../core/types';

/** Whether a key goes to a text field (or the zoom slider) rather than to the page. */
export function isTyping(e: KeyboardEvent): boolean {
	const t = e.target as HTMLElement | null;
	return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || !!t.isContentEditable);
}

const DIRS: Record<string, [number, number]> = {
	ArrowUp: [-1, 0],
	ArrowDown: [1, 0],
	ArrowLeft: [0, -1],
	ArrowRight: [0, 1],
	w: [-1, 0],
	s: [1, 0],
	a: [0, -1],
	d: [0, 1]
};

/** Row and column step of an arrow key or W/A/S/D (either case), else null. */
export function direction(key: string): [number, number] | null {
	return DIRS[key] ?? DIRS[key.toLowerCase()] ?? null;
}

function dialogOpen() {
	return typeof document !== 'undefined' && !!document.querySelector('dialog[open]');
}

/**
 * The one keyboard listener of a game page. The board gets each key first and says whether it
 * used it; only keys it leaves go on to the page's shortcuts. Keys typed into a field, and keys
 * while a dialog is open, never reach the board.
 */
export class KeyDispatcher {
	#board: BoardKeys | null = null;

	constructor(
		private shortcuts: (e: KeyboardEvent) => void = () => {},
		private blocked: () => boolean = dialogOpen
	) {}

	/** The board hands in its handlers; the returned function takes them back. */
	attach = (board: BoardKeys): (() => void) => {
		this.#board = board;
		return () => {
			if (this.#board === board) this.#board = null;
		};
	};

	keydown = (e: KeyboardEvent) => {
		// Used by an element on the way (e.g. a hold button on Enter).
		if (e.defaultPrevented) return;
		if (this.#board && !isTyping(e) && !this.blocked() && this.#board.keydown(e)) return;
		this.shortcuts(e);
	};

	/** Key releases always reach the board, so that a held move ends wherever the focus is. */
	keyup = (e: KeyboardEvent) => this.#board?.keyup?.(e);

	blur = () => this.#board?.blur?.();
}
