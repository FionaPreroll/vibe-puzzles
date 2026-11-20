import { afterEach, describe, expect, it, vi } from 'vitest';
import { followThemeColor, paintedColor, safeAreaBottom, topColor } from './systemBars';

afterEach(() => vi.unstubAllGlobals());

/**
 * A 1×1 canvas that paints like a browser's: an `rgb(r g b / a)` colour (or `#rrggbb`) goes over
 * the pixel with its alpha.
 */
function fakeCanvas(context = true) {
	const pixel = [0, 0, 0];
	const ctx = {
		fillStyle: '',
		fillRect() {
			const hex = /^#(..)(..)(..)$/.exec(this.fillStyle);
			const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(this.fillStyle);
			const [r, g, b, a] = hex
				? [...hex.slice(1).map((c) => parseInt(c, 16)), 1]
				: [+rgb![1], +rgb![2], +rgb![3], rgb![4] === undefined ? 1 : +rgb![4]];
			[r, g, b].forEach((c, k) => (pixel[k] = Math.round(c * a + pixel[k] * (1 - a))));
		},
		getImageData: () => ({ data: [...pixel, 255] })
	};
	return { width: 0, height: 0, getContext: () => (context ? ctx : null) };
}

interface Page {
	background: string;
	header?: string;
	meta?: { name?: string; content: string } | null;
	canvas?: boolean;
}

/** A page with the given background, header bar and theme-color meta; returns its `<head>`. */
function stubPage({ background, header, meta = null, canvas = true }: Page) {
	const head: { name?: string; content: string }[] = [];
	const root = { background };
	const headerEl = header === undefined ? null : { background: header };
	vi.stubGlobal('getComputedStyle', (el: { background: string }) => ({
		backgroundColor: el.background
	}));
	vi.stubGlobal('document', {
		documentElement: root,
		head: { append: (el: { name?: string; content: string }) => head.push(el) },
		querySelector: (selector: string) =>
			selector === 'header' ? headerEl : selector.startsWith('meta') ? meta : null,
		createElement: (tag: string) => (tag === 'canvas' ? fakeCanvas(canvas) : { content: '' })
	});
	return head;
}

describe('the colour at the top of the page', () => {
	it('lays the layers over each other, translucent ones too', () => {
		stubPage({ background: '#000000' });
		expect(paintedColor(['rgb(250 250 249)'])).toBe('#fafaf9');
		expect(paintedColor(['#ffffff', 'rgb(0 0 0 / 0.5)'])).toBe('#808080');
		expect(paintedColor([])).toBe('#000000');
	});

	it('is black where the browser cannot paint', () => {
		stubPage({ background: '#ffffff', canvas: false });
		expect(paintedColor(['#ffffff'])).toBe('#000000');
	});

	it('is the header bar over the background, or the background while the bar is hidden', () => {
		stubPage({ background: 'rgb(12 10 9)', header: 'rgb(28 25 23 / 0.8)' });
		expect(topColor(true)).toBe('#191614');
		expect(topColor(false)).toBe('#0c0a09');
		stubPage({ background: 'rgb(12 10 9)' });
		expect(topColor(true)).toBe('#0c0a09');
	});
});

describe('the theme colour', () => {
	it('goes into the page’s theme-color meta', () => {
		const meta = { content: '#000000' };
		const head = stubPage({ background: '#fafaf9', header: '#ffffff', meta });
		followThemeColor(true);
		expect(meta.content).toBe('#ffffff');
		followThemeColor(false);
		expect(meta.content).toBe('#fafaf9');
		expect(head).toEqual([]);
	});

	it('adds the meta where the page has none', () => {
		const head = stubPage({ background: '#fafaf9' });
		followThemeColor(false);
		expect(head).toEqual([{ name: 'theme-color', content: '#fafaf9' }]);
	});
});

it('measures the safe area at the bottom with a probe that it takes away again', () => {
	const probe = { style: { cssText: '' }, offsetHeight: 24, remove: vi.fn() };
	const append = vi.fn();
	vi.stubGlobal('document', { createElement: () => probe, body: { append } });
	expect(safeAreaBottom()).toBe(24);
	expect(probe.style.cssText).toContain('env(safe-area-inset-bottom');
	expect(append).toHaveBeenCalledWith(probe);
	expect(probe.remove).toHaveBeenCalled();
});
