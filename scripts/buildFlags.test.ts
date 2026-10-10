import { describe, expect, it } from 'vitest';
import { networkDefaults, readFlag } from './buildFlags';

describe('build flags', () => {
	it('reads yes and no in their usual spellings', () => {
		for (const v of ['true', '1', 'YES', ' on ']) expect(readFlag({ X: v }, 'X', false)).toBe(true);
		for (const v of ['false', '0', 'No', 'OFF']) expect(readFlag({ X: v }, 'X', true)).toBe(false);
	});

	it('falls back when unset or empty and fails on anything else', () => {
		expect(readFlag({}, 'X', true)).toBe(true);
		expect(readFlag({ X: '' }, 'X', false)).toBe(false);
		expect(() => readFlag({ X: 'maybe' }, 'X', true)).toThrow('X must be true or false');
	});

	it('defaults to a server, online, with update checks', () => {
		expect(networkDefaults({})).toEqual({ server: true, offline: false, updateCheck: true });
		expect(
			networkDefaults({
				HAS_SERVER: 'false',
				DEFAULT_OFFLINE_MODE: 'true',
				DEFAULT_UPDATE_CHECK: 'false'
			})
		).toEqual({ server: false, offline: true, updateCheck: false });
	});
});
