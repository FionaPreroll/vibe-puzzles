import { describe, expect, it } from 'vitest';
import { i18n } from '../../i18n/index.svelte';
import de from './de';
import en from './en';
import { ti } from '.';

/** Every leaf of a dictionary as [dotted key, value]. */
function leaves(node: unknown, prefix = ''): [string, unknown][] {
	if (node == null || typeof node !== 'object') return [[prefix, node]];
	return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

const placeholders = (text: unknown) =>
	[...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Inside texts', () => {
	it('exist in German for every English key, with the same placeholders', () => {
		const english = new Map(leaves(en));
		const german = new Map(leaves(de));
		expect([...german.keys()]).toEqual([...english.keys()]);
		for (const [key, text] of english) {
			expect(typeof text, key).toBe('string');
			expect(placeholders(german.get(key)), key).toEqual(placeholders(text));
		}
	});

	it('follow the app language and fill in values', () => {
		try {
			i18n.locale = 'de';
			expect(ti('player.step', { n: 2, count: 9 })).toBe('Schritt 2 von 9');
			i18n.locale = 'en';
			expect(ti('player.step', { n: 2, count: 9 })).toBe('Step 2 of 9');
			expect(ti('player.missing')).toBe('player.missing');
		} finally {
			i18n.locale = 'en';
		}
	});
});
