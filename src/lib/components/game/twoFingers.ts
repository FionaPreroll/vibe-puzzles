import type { Attachment } from 'svelte/attachments';
import type { TouchLike } from '../../client/boardInput';
import { clampZoom } from './boardFit';

/**
 * Two fingers on the board area scroll it and pinch to zoom it. That is for the "Always draw"
 * touch mode, where the board keeps every gesture from the page: without it, a board zoomed
 * larger than the screen could not be moved. The spot of the board between the fingers stays
 * between them, whether they move, spread or close. A board drops its own move on a second
 * finger (`BoardGesture`).
 */

export interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface TwoFingerOptions {
	/** Whether two fingers pan and zoom now, rather than the page doing it. */
	enabled(): boolean;
	zoom(): number;
	setZoom(zoom: number): void;
	/** The board on the screen now, which grows and shrinks with the zoom. */
	board(): Rect | null;
	/** Scroll the view by (dx, dy) px: the board moves the other way. */
	scroll(dx: number, dy: number): void;
	/** Resolves once the page shows a new zoom. */
	settle(): Promise<void>;
}

/** Fingers zoom once their distance has grown or shrunk by more than this share, not earlier. */
export const PINCH_SLOP = 0.1;

interface Pinch {
	/** The spot of the board between the fingers, as a share of its width and height. */
	fx: number;
	fy: number;
	/** The fingers' distance when the zoom was `zoom`. */
	dist: number;
	/** The zoom when the fingers began to pinch, or null while they only pan. */
	zoom: number | null;
}

type Touches = TouchLike['touches'];

function midpoint(t: Touches) {
	return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
}

function distance(t: Touches) {
	return Math.max(1, Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY));
}

export class TwoFingerGesture {
	#pinch: Pinch | null = null;

	constructor(private options: TwoFingerOptions) {}

	get active() {
		return !!this.#pinch;
	}

	touchstart(e: TouchLike) {
		this.#pinch = null;
		if (e.touches.length !== 2 || !this.options.enabled()) return;
		const rect = this.options.board();
		if (!rect) return;
		const mid = midpoint(e.touches);
		this.#pinch = {
			fx: (mid.x - rect.left) / rect.width,
			fy: (mid.y - rect.top) / rect.height,
			dist: distance(e.touches),
			zoom: null
		};
	}

	async touchmove(e: TouchLike) {
		const pinch = this.#pinch;
		// Not when the browser already scrolls (one finger had panned before the other came).
		if (!pinch || e.touches.length !== 2 || !e.cancelable) return;
		e.preventDefault();
		const mid = midpoint(e.touches);
		const dist = distance(e.touches);
		if (pinch.zoom === null && Math.abs(dist / pinch.dist - 1) > PINCH_SLOP) {
			// From here on the zoom follows the fingers, without a jump by the slop.
			pinch.zoom = this.options.zoom();
			pinch.dist = dist;
		}
		if (pinch.zoom !== null) {
			const zoom = clampZoom(Math.round((pinch.zoom * dist * 100) / pinch.dist) / 100);
			if (zoom !== this.options.zoom()) {
				this.options.setZoom(zoom);
				await this.options.settle();
				if (this.#pinch !== pinch) return;
			}
		}
		const rect = this.options.board();
		if (!rect) return;
		this.options.scroll(
			rect.left + pinch.fx * rect.width - mid.x,
			rect.top + pinch.fy * rect.height - mid.y
		);
	}

	/** A finger lifted. */
	touchend(e: TouchLike) {
		if (e.touches.length !== 2) this.cancel();
	}

	/** The browser took the touches over. */
	cancel() {
		this.#pinch = null;
	}
}

/**
 * Two-finger panning and zooming as an attachment for the board area: `{@attach twoFingers(...)}`.
 * Create it once in the script; the options are read when an event comes in.
 */
export function twoFingers(options: TwoFingerOptions): Attachment<HTMLElement> {
	return (el) => {
		const gesture = new TwoFingerGesture(options);
		const listeners: [string, (e: TouchEvent) => unknown, AddEventListenerOptions][] = [
			['touchstart', (e) => gesture.touchstart(e), { passive: true }],
			// Not passive, so that two fingers can keep the page from zooming.
			['touchmove', (e) => gesture.touchmove(e), { passive: false }],
			['touchend', (e) => gesture.touchend(e), { passive: true }],
			['touchcancel', () => gesture.cancel(), { passive: true }]
		];
		for (const [type, fn, opts] of listeners) el.addEventListener(type, fn as EventListener, opts);
		return () => {
			for (const [type, fn, opts] of listeners) {
				el.removeEventListener(type, fn as EventListener, opts);
			}
		};
	};
}
