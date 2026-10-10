import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchStorage } from './storage';

describe('changes from other tabs', () => {
	beforeEach(() => vi.stubGlobal('window', new EventTarget()));
	afterEach(() => vi.unstubAllGlobals());

	/** What another tab's write looks like to this one. */
	const write = (key: string | null) =>
		window.dispatchEvent(Object.assign(new Event('storage'), { key }));

	it('names the app keys that changed, or null when all of storage was cleared', () => {
		const changed = vi.fn();
		const stop = watchStorage(changed);
		write('vp:save:tetroid:6n');
		write('other-app');
		write(null);
		expect(changed.mock.calls).toEqual([['save:tetroid:6n'], [null]]);
		stop();
		write('vp:player');
		expect(changed).toHaveBeenCalledTimes(2);
	});

	it('does nothing without a window (server rendering)', () => {
		vi.stubGlobal('window', undefined);
		expect(() => watchStorage(vi.fn())()).not.toThrow();
	});
});
