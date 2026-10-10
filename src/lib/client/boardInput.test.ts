import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TouchMode } from '../core/types';
import {
	BoardGesture,
	boardInput,
	DRAW_DELAY,
	HOLD_DELAY,
	interpolate,
	toBoardPoint,
	touchAction,
	type BoardInputHandlers,
	type BoardPoint
} from './boardInput';

/** Records what the board was told, as short strings. */
function recorder(hold?: (p: BoardPoint) => boolean) {
	const log: string[] = [];
	const at = (p: BoardPoint) => `${p.x},${p.y}`;
	const handlers: BoardInputHandlers = {
		start: (p, how) =>
			log.push(`start ${at(p)}${how.inverse ? ' inverse' : ''}${how.touch ? ' touch' : ''}`),
		drag: (p, from) => log.push(`drag ${at(from)}>${at(p)}`),
		end: () => log.push('end'),
		cancel: () => log.push('cancel'),
		hover: (p) => log.push(`hover ${p ? at(p) : '-'}`),
		hold: hold && ((p) => (log.push(`hold ${at(p)}`), hold(p)))
	};
	return { log, handlers };
}

/** Page pixels are board units here: no scaling, no margin. */
const identity = (x: number, y: number) => ({ x, y });

function pointer(x: number, y: number, init: Partial<PointerEvent> = {}) {
	return {
		pointerType: 'mouse',
		pointerId: 1,
		button: 0,
		clientX: x,
		clientY: y,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		preventDefault: vi.fn(),
		...init
	};
}

function touches(...points: [number, number][]) {
	return {
		touches: points.map(([clientX, clientY]) => ({ clientX, clientY })),
		cancelable: true,
		preventDefault: vi.fn()
	};
}

function setup(mode: TouchMode = 'auto', hold?: (p: BoardPoint) => boolean) {
	const { log, handlers } = recorder(hold);
	const state = { enabled: true, readonly: false };
	const capture = vi.fn();
	const gesture = new BoardGesture(
		handlers,
		{
			layout: () => ({ width: 100, pad: 0, cellSize: 1 }),
			touchMode: () => mode,
			enabled: (touch) => state.enabled && !(touch && state.readonly)
		},
		identity,
		capture
	);
	return { log, gesture, state, capture };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('board geometry', () => {
	it('maps page coordinates to cells on a scaled board', () => {
		// Drawn 200 px wide at (10, 20), laid out 100 px wide with a 10 px margin and 20 px cells.
		const rect = { left: 10, top: 20, width: 200 };
		const layout = { width: 100, pad: 10, cellSize: 20 };
		expect(toBoardPoint(rect, 30, 40, layout)).toEqual({ x: 0, y: 0 });
		expect(toBoardPoint(rect, 90, 120, layout)).toEqual({ x: 1.5, y: 2 });
	});

	it('steps through every cell on the way of a fast drag', () => {
		expect(interpolate({ x: 0, y: 0 }, { x: 2, y: 0 }, 2)).toEqual([
			{ x: 0.5, y: 0 },
			{ x: 1, y: 0 },
			{ x: 1.5, y: 0 },
			{ x: 2, y: 0 }
		]);
		// No distance: still one step, onto the target.
		expect(interpolate({ x: 1, y: 1 }, { x: 1, y: 1 }, 4)).toEqual([{ x: 1, y: 1 }]);
	});

	it('lets the page pan as the touch mode says', () => {
		expect(touchAction('draw')).toBe('none');
		expect(touchAction('pan')).toBe('auto');
		expect(touchAction('auto')).toBe('pan-x pan-y pinch-zoom');
	});
});

describe('mouse', () => {
	it('draws while the button is held', () => {
		const { log, gesture, capture } = setup();
		const down = pointer(1, 1);
		gesture.pointerdown(down);
		expect(down.preventDefault).toHaveBeenCalled();
		expect(capture).toHaveBeenCalledWith(1);
		gesture.pointermove(pointer(2, 1));
		gesture.pointermove(pointer(3, 1));
		gesture.pointerup(pointer(3, 1));
		// Moving afterwards only hovers.
		gesture.pointermove(pointer(4, 1));
		gesture.pointerleave();
		expect(log).toEqual([
			'start 1,1',
			'hover 2,1',
			'drag 1,1>2,1',
			'hover 3,1',
			'drag 2,1>3,1',
			'end',
			'hover 4,1',
			'hover -'
		]);
	});

	it('takes the right button and Ctrl/Cmd as the opposite move', () => {
		for (const init of [{ button: 2 }, { ctrlKey: true }, { metaKey: true }]) {
			const { log, gesture } = setup();
			gesture.pointerdown(pointer(0, 0, init));
			expect(log).toEqual(['start 0,0 inverse']);
		}
	});

	it('leaves the middle button, touch pointers and disabled boards alone', () => {
		const { log, gesture, state } = setup();
		gesture.pointerdown(pointer(0, 0, { button: 1 }));
		gesture.pointerdown(pointer(0, 0, { pointerType: 'touch' }));
		gesture.pointermove(pointer(0, 0, { pointerType: 'touch' }));
		gesture.pointerup(pointer(0, 0, { pointerType: 'touch' }));
		state.enabled = false;
		gesture.pointerdown(pointer(0, 0));
		// A release without a press on the board applies nothing.
		gesture.pointerup(pointer(0, 0));
		expect(log).toEqual([]);
	});

	it('drops the move when the browser takes the pointer or the page scrolls', () => {
		const { log, gesture } = setup();
		gesture.pointerdown(pointer(0, 0));
		gesture.pointercancel();
		gesture.pointermove(pointer(1, 0));
		gesture.scroll();
		expect(log).toEqual(['start 0,0', 'cancel', 'hover 1,0', 'cancel']);
	});
});

describe('touch', () => {
	it('acts on a quick tap in every mode', () => {
		for (const mode of ['auto', 'pan', 'draw'] as const) {
			const { log, gesture } = setup(mode);
			gesture.touchstart(touches([2, 3]));
			const end = touches();
			gesture.touchend(end);
			expect(log).toEqual(['start 2,3 touch', 'end']);
			// A tap before drawing began is the board's: no click or zoom follows.
			expect(end.preventDefault).toHaveBeenCalledTimes(mode === 'draw' ? 0 : 1);
		}
	});

	it('draws at once in draw mode and keeps the page still', () => {
		const { log, gesture } = setup('draw');
		gesture.touchstart(touches([0, 0]));
		const move = touches([0, 5]);
		gesture.touchmove(move);
		expect(move.preventDefault).toHaveBeenCalled();
		gesture.touchend(touches());
		expect(log).toEqual(['start 0,0 touch', 'drag 0,0>0,5', 'end']);
	});

	it('pans when the finger moves early in auto mode', () => {
		const { log, gesture } = setup('auto');
		gesture.touchstart(touches([0, 0]));
		// Within the slop: still a possible tap or hold.
		gesture.touchmove(touches([1, 1]));
		gesture.touchmove(touches([10, 0]));
		vi.advanceTimersByTime(DRAW_DELAY);
		gesture.touchmove(touches([20, 0]));
		gesture.touchend(touches());
		expect(log).toEqual([]);
	});

	it('draws once the finger has rested in auto mode', () => {
		const { log, gesture } = setup('auto');
		gesture.touchstart(touches([0, 0]));
		vi.advanceTimersByTime(DRAW_DELAY);
		gesture.touchmove(touches([0, 10]));
		gesture.touchmove({ ...touches([0, 20]), cancelable: false });
		gesture.touchend(touches());
		expect(log).toEqual(['start 0,0 touch', 'drag 0,0>0,10', 'drag 0,10>0,20', 'end']);
	});

	it('never draws in pan mode', () => {
		const { log, gesture } = setup('pan');
		gesture.touchstart(touches([0, 0]));
		vi.advanceTimersByTime(DRAW_DELAY * 2);
		gesture.touchmove(touches([0, 10]));
		gesture.touchend(touches());
		expect(log).toEqual([]);
	});

	it('drops the move on a second finger', () => {
		const { log, gesture } = setup('draw');
		gesture.touchstart(touches([0, 0]));
		gesture.touchstart(touches([0, 0], [5, 5]));
		gesture.touchmove(touches([0, 10]));
		gesture.touchend(touches());
		expect(log).toEqual(['start 0,0 touch', 'cancel']);
	});

	it('ignores fingers on a read-only board, but the mouse still selects', () => {
		const { log, gesture, state } = setup('draw');
		state.readonly = true;
		gesture.touchstart(touches([0, 0]));
		gesture.touchend(touches());
		gesture.pointerdown(pointer(0, 0));
		expect(log).toEqual(['start 0,0']);
	});

	it('keeps a page scroll from dropping a touch move', () => {
		const { log, gesture } = setup('draw');
		gesture.touchstart(touches([0, 0]));
		expect(gesture.touching).toBe(true);
		gesture.scroll();
		gesture.touchend(touches());
		expect(gesture.touching).toBe(false);
		expect(log).toEqual(['start 0,0 touch', 'end']);
	});

	it('ends the gesture on a hold that did something', () => {
		const { log, gesture } = setup('auto', () => true);
		gesture.touchstart(touches([1, 1]));
		vi.advanceTimersByTime(HOLD_DELAY);
		gesture.touchmove(touches([1, 9]));
		gesture.touchend(touches());
		// Drawing had started by then: the hold drops it.
		expect(log).toEqual(['start 1,1 touch', 'hold 1,1', 'cancel']);
	});

	it('goes on after a hold that did nothing', () => {
		const { log, gesture } = setup('auto', () => false);
		gesture.touchstart(touches([1, 1]));
		vi.advanceTimersByTime(HOLD_DELAY);
		gesture.touchmove(touches([1, 9]));
		gesture.touchend(touches());
		expect(log).toEqual(['start 1,1 touch', 'hold 1,1', 'drag 1,1>1,9', 'end']);
	});

	it('does not hold once the finger has moved', () => {
		const { log, gesture } = setup('draw', () => true);
		gesture.touchstart(touches([1, 1]));
		gesture.touchmove(touches([1, 9]));
		vi.advanceTimersByTime(HOLD_DELAY);
		gesture.touchend(touches());
		expect(log).toEqual(['start 1,1 touch', 'drag 1,1>1,9', 'end']);
	});

	it('forgets its timers when the board goes', () => {
		const { log, gesture } = setup('auto', () => true);
		gesture.touchstart(touches([1, 1]));
		gesture.dispose();
		vi.advanceTimersByTime(HOLD_DELAY);
		gesture.touchend(touches());
		expect(log).toEqual([]);
	});
});

/** Just enough of an svg element in a page. */
class FakeElement extends EventTarget {
	captured: number[] = [];
	ownerDocument = { defaultView: new EventTarget() };
	getBoundingClientRect() {
		return { left: 0, top: 0, width: 200 };
	}
	setPointerCapture(id: number) {
		this.captured.push(id);
	}
}

/** A real event with the given fields; its own `preventDefault` and `cancelable` stay. */
function event(type: string, init: object = {}) {
	const fields = Object.entries(init).filter(([k]) => k !== 'preventDefault' && k !== 'cancelable');
	return Object.assign(new Event(type, { cancelable: true }), Object.fromEntries(fields));
}

describe('board input attachment', () => {
	it('wires the events of the board and the page to the gesture', () => {
		const { log, handlers } = recorder();
		const el = new FakeElement();
		const detach = boardInput(handlers, {
			// Drawn twice as large as laid out, 10 px cells.
			layout: () => ({ width: 100, pad: 0, cellSize: 10 }),
			touchMode: () => 'draw',
			enabled: () => true
		})(el as unknown as Element) as () => void;

		el.dispatchEvent(event('pointerdown', pointer(40, 20, { pointerId: 7 })));
		el.dispatchEvent(event('pointermove', pointer(60, 20)));
		el.dispatchEvent(event('pointerup', pointer(60, 20)));
		el.dispatchEvent(event('pointerleave'));
		el.dispatchEvent(event('pointerdown', pointer(0, 0)));
		el.dispatchEvent(event('pointercancel'));
		el.ownerDocument.defaultView.dispatchEvent(event('scroll'));
		const menu = event('contextmenu');
		el.dispatchEvent(menu);
		expect(menu.defaultPrevented).toBe(true);
		el.dispatchEvent(event('touchstart', touches([20, 20])));
		el.dispatchEvent(event('touchmove', touches([20, 40])));
		el.dispatchEvent(event('touchend', touches()));
		expect(el.captured).toEqual([7, 1]);
		expect(log).toEqual([
			'start 2,1',
			'hover 3,1',
			'drag 2,1>3,1',
			'end',
			'hover -',
			'start 0,0',
			'cancel',
			'cancel',
			'start 1,1 touch',
			'drag 1,1>1,2',
			'end'
		]);

		detach();
		log.length = 0;
		el.dispatchEvent(event('pointerdown', pointer(40, 20)));
		el.ownerDocument.defaultView.dispatchEvent(event('scroll'));
		expect(log).toEqual([]);
	});
});
