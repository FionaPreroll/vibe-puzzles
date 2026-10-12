import { describe, expect, it, vi } from 'vitest';
import { PINCH_SLOP, twoFingers, TwoFingerGesture, type Rect } from './twoFingers';

function touches(...points: [number, number][]) {
	return {
		touches: points.map(([clientX, clientY]) => ({ clientX, clientY })),
		cancelable: true,
		preventDefault: vi.fn()
	};
}

/**
 * A board 100 px a zoom step wide and tall, at (0, 0) of a view that scrolls without limits: the
 * board moves against the scroll, and grows with the zoom from its top left corner.
 */
function setup(enabled = true) {
	const view = { x: 0, y: 0, zoom: 1, enabled, shown: true };
	const scroll = vi.fn((dx: number, dy: number) => {
		view.x += dx;
		view.y += dy;
	});
	const setZoom = vi.fn((z: number) => (view.zoom = z));
	const board = (): Rect | null =>
		view.shown
			? { left: -view.x, top: -view.y, width: 100 * view.zoom, height: 100 * view.zoom }
			: null;
	const gesture = new TwoFingerGesture({
		enabled: () => view.enabled,
		zoom: () => view.zoom,
		setZoom,
		board,
		scroll,
		settle: () => Promise.resolve()
	});
	return { view, scroll, setZoom, board, gesture };
}

describe('two fingers', () => {
	it('move the board with them, and keep the page still', async () => {
		const { view, setZoom, gesture } = setup();
		gesture.touchstart(touches([40, 50], [60, 50]));
		expect(gesture.active).toBe(true);
		const move = touches([20, 30], [40, 30]);
		await gesture.touchmove(move);
		expect(move.preventDefault).toHaveBeenCalled();
		// The board went 20 px left and up, under the fingers.
		expect([view.x, view.y]).toEqual([20, 20]);
		await gesture.touchmove(touches([30, 60], [50, 60]));
		expect([view.x, view.y]).toEqual([10, -10]);
		expect(setZoom).not.toHaveBeenCalled();
	});

	it('zoom once they spread or close by more than the slop, around the spot between them', async () => {
		const { view, board, gesture } = setup();
		// The spot at (50, 50) of the board, between fingers 20 px apart.
		gesture.touchstart(touches([40, 50], [60, 50]));
		const within = 20 * (1 + PINCH_SLOP / 2);
		await gesture.touchmove(touches([50 - within / 2, 50], [50 + within / 2, 50]));
		expect(view.zoom).toBe(1);
		// Past the slop: the zoom starts there, without a jump.
		await gesture.touchmove(touches([37, 50], [63, 50]));
		expect(view.zoom).toBe(1);
		// Twice as far apart: twice the zoom, and the spot stays between the fingers.
		await gesture.touchmove(touches([24, 50], [76, 50]));
		expect(view.zoom).toBe(2);
		const rect = board()!;
		expect(rect.left + 0.5 * rect.width).toBe(50);
		expect(rect.top + 0.5 * rect.height).toBe(50);
	});

	it('round the zoom to whole percent, within its limits', async () => {
		const { view, setZoom, gesture } = setup();
		gesture.touchstart(touches([0, 0], [30, 0]));
		await gesture.touchmove(touches([0, 0], [40, 0]));
		await gesture.touchmove(touches([0, 0], [41, 0]));
		expect(view.zoom).toBe(1.03);
		await gesture.touchmove(touches([0, 0], [400, 0]));
		expect(view.zoom).toBe(3);
		// Further out the zoom stays at its most, and is not set again.
		await gesture.touchmove(touches([0, 0], [500, 0]));
		expect(setZoom).toHaveBeenCalledTimes(2);
		await gesture.touchmove(touches([0, 0], [1, 0]));
		expect(view.zoom).toBe(0.3);
	});

	it('stop when a finger lifts or a third comes, or the browser takes over', async () => {
		const { view, scroll, gesture } = setup();
		gesture.touchstart(touches([0, 0], [10, 0]));
		gesture.touchend(touches([0, 0]));
		await gesture.touchmove(touches([50, 50], [60, 50]));
		gesture.touchstart(touches([0, 0], [10, 0]));
		gesture.touchstart(touches([0, 0], [10, 0], [20, 0]));
		await gesture.touchmove(touches([50, 50], [60, 50]));
		gesture.touchstart(touches([0, 0], [10, 0]));
		gesture.cancel();
		await gesture.touchmove(touches([50, 50], [60, 50]));
		expect(gesture.active).toBe(false);
		expect(scroll).not.toHaveBeenCalled();
		expect([view.x, view.y]).toEqual([0, 0]);
	});

	it('go on while both stay, when a third lifts', async () => {
		const { scroll, gesture } = setup();
		gesture.touchstart(touches([0, 0], [10, 0]));
		gesture.touchend(touches([0, 0], [10, 0]));
		await gesture.touchmove(touches([5, 0], [15, 0]));
		expect(scroll).toHaveBeenCalledWith(-5, 0);
	});

	it('leave it to the page where it pans and zooms itself, or already scrolls', async () => {
		const off = setup(false);
		off.gesture.touchstart(touches([0, 0], [10, 0]));
		const move = touches([50, 50], [60, 50]);
		await off.gesture.touchmove(move);
		expect(move.preventDefault).not.toHaveBeenCalled();
		expect(off.scroll).not.toHaveBeenCalled();

		const { scroll, gesture } = setup();
		gesture.touchstart(touches([0, 0], [10, 0]));
		const scrolling = { ...touches([50, 50], [60, 50]), cancelable: false };
		await gesture.touchmove(scrolling);
		expect(scrolling.preventDefault).not.toHaveBeenCalled();
		expect(scroll).not.toHaveBeenCalled();
	});

	it('wait for no board, or one that went', async () => {
		const { view, scroll, gesture } = setup();
		view.shown = false;
		gesture.touchstart(touches([0, 0], [10, 0]));
		expect(gesture.active).toBe(false);
		view.shown = true;
		gesture.touchstart(touches([0, 0], [10, 0]));
		view.shown = false;
		await gesture.touchmove(touches([5, 0], [15, 0]));
		expect(scroll).not.toHaveBeenCalled();
	});

	it('do not scroll for a gesture that ended while the zoom was drawn', async () => {
		let settled = () => {};
		const scroll = vi.fn();
		const gesture = new TwoFingerGesture({
			enabled: () => true,
			zoom: () => 1,
			setZoom: () => {},
			board: () => ({ left: 0, top: 0, width: 100, height: 100 }),
			scroll,
			settle: () => new Promise((resolve) => (settled = resolve))
		});
		gesture.touchstart(touches([0, 0], [10, 0]));
		// Past the slop: the fingers zoom from here on.
		await gesture.touchmove(touches([0, 0], [20, 0]));
		expect(scroll).toHaveBeenCalledTimes(1);
		const moved = gesture.touchmove(touches([0, 0], [40, 0]));
		gesture.touchend(touches());
		settled();
		await moved;
		expect(scroll).toHaveBeenCalledTimes(1);
	});
});

/** A real event with the given fields; its own `preventDefault` and `cancelable` stay. */
function event(type: string, init: object = {}) {
	const fields = Object.entries(init).filter(([k]) => k !== 'preventDefault' && k !== 'cancelable');
	return Object.assign(new Event(type, { cancelable: true }), Object.fromEntries(fields));
}

describe('two finger attachment', () => {
	it('wires the touch events of the board area to the gesture', async () => {
		const scroll = vi.fn();
		const el = new EventTarget();
		const detach = twoFingers({
			enabled: () => true,
			zoom: () => 1,
			setZoom: () => {},
			board: () => ({ left: 0, top: 0, width: 100, height: 100 }),
			scroll,
			settle: () => Promise.resolve()
		})(el as unknown as HTMLElement) as () => void;

		el.dispatchEvent(event('touchstart', touches([0, 0], [10, 0])));
		const move = event('touchmove', touches([0, 5], [10, 5]));
		el.dispatchEvent(move);
		await Promise.resolve();
		expect(move.defaultPrevented).toBe(true);
		el.dispatchEvent(event('touchend', touches([0, 5])));
		el.dispatchEvent(event('touchmove', touches([0, 9], [10, 9])));
		el.dispatchEvent(event('touchstart', touches([0, 0], [10, 0])));
		el.dispatchEvent(event('touchcancel'));
		el.dispatchEvent(event('touchmove', touches([0, 9], [10, 9])));
		detach();
		el.dispatchEvent(event('touchstart', touches([0, 0], [10, 0])));
		el.dispatchEvent(event('touchmove', touches([0, 9], [10, 9])));
		await Promise.resolve();
		expect(scroll.mock.calls).toEqual([[0, -5]]);
	});
});
