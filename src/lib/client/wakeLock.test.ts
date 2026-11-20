import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';
import {
	browserWakeLock,
	DEFAULT_KEEP_AWAKE,
	keepScreenAwake,
	loadKeepAwake,
	saveKeepAwake,
	ScreenAwake,
	type WakeLockApi,
	type WakeLockSentinelLike
} from './wakeLock';

class FakeSentinel extends EventTarget implements WakeLockSentinelLike {
	released = false;
	async release() {
		if (this.released) return;
		this.released = true;
		this.dispatchEvent(new Event('release'));
	}
}

/** A wake lock that grants every request, or refuses them while `refuse` is set. */
class FakeWakeLock implements WakeLockApi {
	requests = 0;
	refuse = false;
	current: FakeSentinel | null = null;
	async request() {
		this.requests++;
		if (this.refuse) throw new DOMException('refused', 'NotAllowedError');
		this.current = new FakeSentinel();
		return this.current;
	}
}

/** A clock whose time and timeouts move only when told to. */
class FakeClock {
	time = 0;
	private timers = new Map<number, { at: number; run: () => void }>();
	private next = 1;
	now = () => this.time;
	setTimeout = (run: () => void, ms: number) => {
		const id = this.next++;
		this.timers.set(id, { at: this.time + ms, run });
		return id;
	};
	clearTimeout = (id: unknown) => {
		this.timers.delete(id as number);
	};
	advance(ms: number) {
		this.time += ms;
		for (const [id, timer] of [...this.timers]) {
			if (timer.at > this.time) continue;
			this.timers.delete(id);
			timer.run();
		}
	}
}

const MINUTE = 60_000;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let lock: FakeWakeLock;
let clock: FakeClock;
let visible: boolean;
let awake: ScreenAwake;

beforeEach(() => {
	lock = new FakeWakeLock();
	clock = new FakeClock();
	visible = true;
	awake = new ScreenAwake(lock, () => visible, clock);
});

describe('keeping the screen on', () => {
	it('holds the screen for the chosen minutes after the last input', async () => {
		awake.setPlaying(true);
		awake.setChoice('5');
		await settle();
		expect(awake.held).toBe(true);

		clock.advance(4 * MINUTE);
		awake.input();
		clock.advance(4 * MINUTE);
		await settle();
		expect(awake.held).toBe(true);

		clock.advance(MINUTE);
		await settle();
		expect(awake.held).toBe(false);
		expect(lock.current?.released).toBe(true);

		awake.input();
		await settle();
		expect(awake.held).toBe(true);
		expect(lock.requests).toBe(2);
	});

	it('holds it without end when always on, and never when off', async () => {
		awake.setPlaying(true);
		awake.setChoice('always');
		await settle();
		clock.advance(120 * MINUTE);
		expect(awake.held).toBe(true);

		awake.setChoice('off');
		expect(awake.held).toBe(false);
		awake.input();
		await settle();
		expect(awake.held).toBe(false);
		expect(lock.requests).toBe(1);
	});

	it('lets go once the puzzle is solved, and holds again for the next one', async () => {
		awake.setChoice('always');
		await settle();
		expect(lock.requests).toBe(0);

		awake.setPlaying(true);
		await settle();
		expect(awake.held).toBe(true);
		awake.setPlaying(false);
		expect(awake.held).toBe(false);
		awake.setPlaying(true);
		await settle();
		expect(awake.held).toBe(true);
	});

	it('takes the screen again when the page shows after the browser let it go', async () => {
		awake.setPlaying(true);
		awake.setChoice('always');
		await settle();

		visible = false;
		await lock.current!.release();
		awake.visibilityChanged();
		expect(awake.held).toBe(false);

		visible = true;
		awake.visibilityChanged();
		await settle();
		expect(awake.held).toBe(true);
		expect(lock.requests).toBe(2);
	});

	it('asks once while a request is on its way', async () => {
		awake.setPlaying(true);
		awake.setChoice('always');
		awake.input();
		awake.input();
		await settle();
		expect(lock.requests).toBe(1);
		expect(awake.held).toBe(true);
	});

	it('gives back a lock granted after it was no longer wanted', async () => {
		awake.setPlaying(true);
		awake.setChoice('always');
		awake.setChoice('off');
		await settle();
		expect(lock.requests).toBe(1);
		expect(lock.current?.released).toBe(true);
		expect(awake.held).toBe(false);
	});

	it('leaves the screen to the system when the browser refuses or has no wake lock', async () => {
		lock.refuse = true;
		awake.setPlaying(true);
		awake.setChoice('always');
		await settle();
		expect(awake.held).toBe(false);

		lock.refuse = false;
		awake.input();
		await settle();
		expect(awake.held).toBe(true);

		const none = new ScreenAwake(undefined, () => true, clock);
		none.setPlaying(true);
		none.setChoice('always');
		await settle();
		expect(none.held).toBe(false);
	});

	it('lets go for good when stopped', async () => {
		awake.setPlaying(true);
		awake.setChoice('always');
		await settle();
		awake.stop();
		expect(awake.held).toBe(false);
		awake.input();
		await settle();
		expect(lock.requests).toBe(1);
	});
});

describe('the choice', () => {
	beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));

	it('is stored on the device, with a default for anything unknown', () => {
		expect(loadKeepAwake()).toBe(DEFAULT_KEEP_AWAKE);
		saveKeepAwake('always');
		expect(loadKeepAwake()).toBe('always');
		localStorage.setItem('vp:keepAwake', '"7"');
		expect(loadKeepAwake()).toBe(DEFAULT_KEEP_AWAKE);
	});
});

describe('the page', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('finds the browser wake lock where there is one', () => {
		vi.stubGlobal('navigator', {});
		expect(browserWakeLock()).toBeUndefined();
		vi.stubGlobal('navigator', { wakeLock: lock });
		expect(browserWakeLock()).toBe(lock);
	});

	it('counts input and showing the page, and lets go when the page goes', async () => {
		vi.useFakeTimers();
		const win = new EventTarget();
		const doc = new EventTarget();
		vi.stubGlobal('window', win);
		vi.stubGlobal('document', doc);
		const page = new ScreenAwake(lock, () => visible);
		const stop = keepScreenAwake(page);
		page.setPlaying(true);
		page.setChoice('2');
		await vi.advanceTimersByTimeAsync(0);
		expect(page.held).toBe(true);

		await vi.advanceTimersByTimeAsync(MINUTE);
		win.dispatchEvent(new Event('pointerdown'));
		await vi.advanceTimersByTimeAsync(1.5 * MINUTE);
		expect(page.held).toBe(true);
		await vi.advanceTimersByTimeAsync(MINUTE);
		expect(page.held).toBe(false);

		doc.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(page.held).toBe(true);

		stop();
		expect(page.held).toBe(false);
		win.dispatchEvent(new Event('keydown'));
		await vi.advanceTimersByTimeAsync(0);
		expect(page.held).toBe(false);
		expect(lock.requests).toBe(2);
	});
});
