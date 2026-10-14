import { describe, expect, it } from 'vitest';
import { autoHideHeader, headerBar, toggleHeader } from './headerBar.svelte';

describe('header bar', () => {
	it('comes down and goes away only while hidden', () => {
		toggleHeader();
		expect(headerBar.shown).toBe(false);

		autoHideHeader(true);
		toggleHeader();
		expect(headerBar.shown).toBe(true);
		toggleHeader();
		expect(headerBar.shown).toBe(false);

		toggleHeader();
		autoHideHeader(false);
		expect(headerBar).toEqual({ autoHide: false, shown: false });
	});
});
