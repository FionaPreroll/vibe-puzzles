import type { Attachment } from 'svelte/attachments';
import type { TouchMode } from '../core/types';

/** A position on a board in cell units: (0, 0) is the top left corner of the grid. */
export interface BoardPoint {
	x: number;
	y: number;
}

/** Size of a board's drawing: total width, margin around the grid and cell size, in px. */
export interface BoardLayout {
	width: number;
	pad: number;
	cellSize: number;
}

/** Page coordinates to board cell units, for a board drawn in `rect` (which may be scaled). */
export function toBoardPoint(
	rect: { left: number; top: number; width: number },
	clientX: number,
	clientY: number,
	layout: BoardLayout
): BoardPoint {
	const scale = rect.width / layout.width;
	return {
		x: ((clientX - rect.left) / scale - layout.pad) / layout.cellSize,
		y: ((clientY - rect.top) / scale - layout.pad) / layout.cellSize
	};
}

/**
 * The points on the way from `from` to `to`, `perCell` per cell of distance (at least one, and
 * always ending on `to`), so that a fast drag misses no cell or edge in between.
 */
export function interpolate(from: BoardPoint, to: BoardPoint, perCell: number): BoardPoint[] {
	const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * perCell));
	return Array.from({ length: steps }, (_, k) => ({
		x: from.x + ((to.x - from.x) * (k + 1)) / steps,
		y: from.y + ((to.y - from.y) * (k + 1)) / steps
	}));
}

/** The CSS `touch-action` of a board: drawing keeps every gesture, panning none of them. */
export function touchAction(mode: TouchMode): string {
	if (mode === 'draw') return 'none';
	if (mode === 'pan') return 'auto';
	return 'pan-x pan-y pinch-zoom';
}

export interface StartInfo {
	/** Right button, or Ctrl/Cmd held: the opposite of the tool's usual effect. */
	inverse: boolean;
	shift: boolean;
	touch: boolean;
}

/** What a board does with the gestures on it; the board turns points into cells or edges. */
export interface BoardInputHandlers {
	/** A move begins at `p`. */
	start(p: BoardPoint, how: StartInfo): void;
	/** The move goes on from `from` to `p`. */
	drag(p: BoardPoint, from: BoardPoint): void;
	/** The move is done: apply it. */
	end(): void;
	/** Drop the move. */
	cancel(): void;
	/** The mouse moved over the board (`p`) or left it (null), without a button pressed or with. */
	hover?(p: BoardPoint | null, shift: boolean): void;
	/**
	 * A finger has rested on `p` for `HOLD_DELAY` ms. True when that did something, which ends
	 * the gesture; false lets it go on (as a drag, for example).
	 */
	hold?(p: BoardPoint): boolean;
}

export interface BoardInputOptions {
	layout(): BoardLayout;
	touchMode(): TouchMode;
	/** Whether the board takes input now, from a mouse or pen, or from a finger. */
	enabled(touch: boolean): boolean;
}

/** In auto touch mode, a finger resting this long starts drawing; moving earlier pans. */
export const DRAW_DELAY = 300;
/** A finger resting this long holds (e.g. locks a galaxy in Pinwheel). */
export const HOLD_DELAY = 400;
/** A finger that moves further than this (px) before drawing pans the page instead. */
const SLOP = 3;

export interface PointerLike {
	pointerType: string;
	pointerId: number;
	button: number;
	clientX: number;
	clientY: number;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	preventDefault(): void;
}

export interface TouchLike {
	touches: ArrayLike<{ clientX: number; clientY: number }>;
	cancelable: boolean;
	preventDefault(): void;
}

interface TouchGesture {
	x: number;
	y: number;
	drawing: boolean;
	timer: ReturnType<typeof setTimeout> | undefined;
	holdTimer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Pointer and touch handling shared by the boards. A mouse or pen draws while a button is held.
 * Touch depends on the touch mode: "draw" draws at once, "pan" leaves dragging to the page, and
 * "auto" pans when the finger moves early and draws once it has rested for `DRAW_DELAY`. A quick
 * tap acts on the spot in every mode, and a second finger drops the move.
 */
export class BoardGesture {
	/** Where the last drag step ended. */
	#last: BoardPoint | null = null;
	/** A mouse or pen button is down on the board. */
	#pressed = false;
	#touch: TouchGesture | null = null;

	constructor(
		private handlers: BoardInputHandlers,
		private options: BoardInputOptions,
		private toBoard: (clientX: number, clientY: number) => BoardPoint,
		private capture: (pointerId: number) => void = () => {}
	) {}

	get touching() {
		return !!this.#touch;
	}

	pointerdown(e: PointerLike) {
		if (e.pointerType === 'touch' || !this.options.enabled(false)) return;
		// The middle button pans the board area (the game page handles it).
		if (e.button === 1) return;
		e.preventDefault();
		const p = this.toBoard(e.clientX, e.clientY);
		const inverse = e.button === 2 || e.ctrlKey || e.metaKey;
		this.#pressed = true;
		this.handlers.start(p, { inverse, shift: e.shiftKey, touch: false });
		this.#last = p;
		this.capture(e.pointerId);
	}

	pointermove(e: PointerLike) {
		if (e.pointerType === 'touch') return;
		const p = this.toBoard(e.clientX, e.clientY);
		this.handlers.hover?.(p, e.shiftKey);
		if (!this.#pressed) return;
		this.handlers.drag(p, this.#last ?? p);
		this.#last = p;
	}

	pointerup(e: PointerLike) {
		if (e.pointerType === 'touch') return;
		const pressed = this.#pressed;
		this.#pressed = false;
		this.#last = null;
		if (pressed) this.handlers.end();
	}

	/** The browser took the pointer over (e.g. to scroll). */
	pointercancel() {
		this.#pressed = false;
		this.#last = null;
		this.handlers.cancel();
	}

	pointerleave() {
		this.handlers.hover?.(null, false);
	}

	/** The page scrolled under a mouse move: its cells are no longer where they were. */
	scroll() {
		if (!this.#touch) this.handlers.cancel();
	}

	touchstart(e: TouchLike) {
		if (!this.options.enabled(true)) return;
		if (e.touches.length > 1) {
			this.#dropTouch();
			this.handlers.cancel();
			return;
		}
		const t = e.touches[0];
		const start: TouchGesture = {
			x: t.clientX,
			y: t.clientY,
			drawing: false,
			timer: undefined,
			holdTimer: undefined
		};
		this.#touch = start;
		const at = () => this.toBoard(start.x, start.y);
		if (this.handlers.hold) {
			start.holdTimer = setTimeout(() => {
				if (this.#touch !== start || !this.handlers.hold!(at())) return;
				this.#dropTouch();
				this.handlers.cancel();
			}, HOLD_DELAY);
		}
		const startDraw = () => {
			if (this.#touch !== start) return;
			start.drawing = true;
			const p = at();
			this.handlers.start(p, { inverse: false, shift: false, touch: true });
			this.#last = p;
		};
		const mode = this.options.touchMode();
		if (mode === 'draw') startDraw();
		else if (mode === 'auto') start.timer = setTimeout(startDraw, DRAW_DELAY);
	}

	touchmove(e: TouchLike) {
		const touch = this.#touch;
		if (!touch) return;
		const t = e.touches[0];
		const moved = Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > SLOP;
		if (moved) clearTimeout(touch.holdTimer);
		if (touch.drawing) {
			// Not when the browser is already scrolling (e.g. a hold that started drawing late):
			// that event cannot be cancelled, and trying it logs an error.
			if (e.cancelable) e.preventDefault();
			const p = this.toBoard(t.clientX, t.clientY);
			this.handlers.drag(p, this.#last ?? p);
			this.#last = p;
		} else if (moved) {
			// Moved before drawing: the page pans.
			this.#dropTouch();
		}
	}

	touchend(e: TouchLike) {
		const touch = this.#touch;
		if (!touch) return;
		this.#dropTouch();
		if (!touch.drawing) {
			// A tap: a move on that one spot.
			e.preventDefault();
			this.handlers.start(this.toBoard(touch.x, touch.y), {
				inverse: false,
				shift: false,
				touch: true
			});
		}
		this.handlers.end();
	}

	/** The board goes away. */
	dispose() {
		this.#dropTouch();
	}

	#dropTouch() {
		if (this.#touch) {
			clearTimeout(this.#touch.timer);
			clearTimeout(this.#touch.holdTimer);
		}
		this.#touch = null;
		this.#last = null;
	}
}

/**
 * The shared input of a board as an attachment for its svg: `{@attach boardInput(...)}`. Create
 * it once in the board's script; the options are read when an event comes in.
 */
export function boardInput(
	handlers: BoardInputHandlers,
	options: BoardInputOptions
): Attachment<Element> {
	return (el) => {
		const gesture = new BoardGesture(
			handlers,
			options,
			(x, y) => toBoardPoint(el.getBoundingClientRect(), x, y, options.layout()),
			(id) => el.setPointerCapture(id)
		);
		const win = el.ownerDocument.defaultView!;
		const listeners: [EventTarget, string, (e: never) => void, AddEventListenerOptions?][] = [
			[el, 'pointerdown', (e: PointerEvent) => gesture.pointerdown(e)],
			[el, 'pointermove', (e: PointerEvent) => gesture.pointermove(e)],
			[el, 'pointerup', (e: PointerEvent) => gesture.pointerup(e)],
			[el, 'pointercancel', () => gesture.pointercancel()],
			[el, 'pointerleave', () => gesture.pointerleave()],
			[el, 'contextmenu', (e: Event) => e.preventDefault()],
			[el, 'touchstart', (e: TouchEvent) => gesture.touchstart(e), { passive: true }],
			// Not passive, so that drawing can keep the page from scrolling.
			[el, 'touchmove', (e: TouchEvent) => gesture.touchmove(e), { passive: false }],
			[el, 'touchend', (e: TouchEvent) => gesture.touchend(e), { passive: false }],
			[win, 'scroll', () => gesture.scroll(), { capture: true }]
		];
		for (const [target, type, fn, opts] of listeners) {
			target.addEventListener(type, fn as EventListener, opts);
		}
		return () => {
			for (const [target, type, fn, opts] of listeners) {
				target.removeEventListener(type, fn as EventListener, opts);
			}
			gesture.dispose();
		};
	};
}
