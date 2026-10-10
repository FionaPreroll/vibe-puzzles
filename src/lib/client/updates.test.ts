import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleUpdateChecks, UPDATE_INTERVAL_MS, UPDATE_MIN_GAP_MS } from './updates';

const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('window', new EventTarget());
	vi.stubGlobal('document', doc);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('update checks', () => {
	it('look now and then, not right after loading', () => {
		const check = vi.fn(async () => false);
		const stop = scheduleUpdateChecks(check);
		expect(check).not.toHaveBeenCalled();
		vi.advanceTimersByTime(UPDATE_INTERVAL_MS);
		expect(check).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(UPDATE_INTERVAL_MS);
		expect(check).toHaveBeenCalledTimes(2);
		stop();
		vi.advanceTimersByTime(UPDATE_INTERVAL_MS * 3);
		expect(check).toHaveBeenCalledTimes(2);
	});

	it('look when the page is shown or back online, at most every few minutes', () => {
		const check = vi.fn(() => Promise.reject(new Error('offline')));
		const stop = scheduleUpdateChecks(check);
		window.dispatchEvent(new Event('online'));
		expect(check).not.toHaveBeenCalled();
		vi.advanceTimersByTime(UPDATE_MIN_GAP_MS);
		window.dispatchEvent(new Event('online'));
		document.dispatchEvent(new Event('visibilitychange'));
		expect(check).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(UPDATE_MIN_GAP_MS);
		doc.visibilityState = 'hidden';
		document.dispatchEvent(new Event('visibilitychange'));
		expect(check).toHaveBeenCalledTimes(1);
		doc.visibilityState = 'visible';
		document.dispatchEvent(new Event('visibilitychange'));
		expect(check).toHaveBeenCalledTimes(2);
		stop();
		vi.advanceTimersByTime(UPDATE_MIN_GAP_MS);
		window.dispatchEvent(new Event('online'));
		expect(check).toHaveBeenCalledTimes(2);
	});
});
