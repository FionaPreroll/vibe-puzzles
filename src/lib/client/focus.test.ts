import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trapFocus } from './focus';

/** Just enough of an element: focus, visibility and keydown listeners. */
class FakeElement extends EventTarget {
	children: FakeElement[] = [];
	constructor(
		public name: string,
		public visible = true
	) {
		super();
	}
	focus() {
		doc.activeElement = this;
	}
	getClientRects() {
		return this.visible ? [{}] : [];
	}
	contains(el: unknown): boolean {
		return el === this || this.children.some((c) => c.contains(el));
	}
	querySelectorAll() {
		return this.children;
	}
}

const body = new FakeElement('body');
const doc: { activeElement: FakeElement | null; body: FakeElement } = { activeElement: null, body };

function key(target: FakeElement, k: string, shiftKey = false) {
	const e = Object.assign(new Event('keydown', { cancelable: true }), { key: k, shiftKey });
	target.dispatchEvent(e);
	return e;
}

let opener: FakeElement;
let panel: FakeElement;
let first: FakeElement;
let hidden: FakeElement;
let last: FakeElement;

beforeEach(() => {
	vi.stubGlobal('document', doc);
	opener = new FakeElement('opener');
	panel = new FakeElement('panel');
	first = new FakeElement('first');
	hidden = new FakeElement('hidden', false);
	last = new FakeElement('last');
	panel.children = [hidden, first, last];
	opener.focus();
});

afterEach(() => vi.unstubAllGlobals());

const trap = (onEscape?: () => void) => trapFocus(panel as unknown as HTMLElement, onEscape);

describe('focus trap', () => {
	it('focuses the first visible control', () => {
		trap();
		expect(doc.activeElement).toBe(first);
	});

	it('keeps Tab and Shift+Tab inside', () => {
		trap();
		expect(key(panel, 'Tab', true).defaultPrevented).toBe(true);
		expect(doc.activeElement).toBe(last);
		expect(key(panel, 'Tab').defaultPrevented).toBe(true);
		expect(doc.activeElement).toBe(first);
		// Between the ends the browser moves the focus.
		expect(key(panel, 'Tab').defaultPrevented).toBe(false);
		// Focus that left the panel comes back.
		opener.focus();
		key(panel, 'Tab');
		expect(doc.activeElement).toBe(first);
		expect(key(panel, 'a').defaultPrevented).toBe(false);
	});

	it('keeps the focus where it is without controls', () => {
		panel.children = [];
		trap();
		expect(doc.activeElement).toBe(opener);
		expect(key(panel, 'Tab').defaultPrevented).toBe(true);
	});

	it('closes on Escape', () => {
		const close = vi.fn();
		trap(close);
		const e = key(panel, 'Escape');
		expect(close).toHaveBeenCalledOnce();
		expect(e.defaultPrevented).toBe(true);
		// Without a handler Escape is left alone.
		const plain = new FakeElement('plain');
		trapFocus(plain as unknown as HTMLElement);
		expect(key(plain, 'Escape').defaultPrevented).toBe(false);
	});

	it('gives the focus back when closed', () => {
		trap()();
		expect(doc.activeElement).toBe(opener);
		// Also when the focused control disappeared with the panel.
		const release = trap();
		body.focus();
		release();
		expect(doc.activeElement).toBe(opener);
		// Removed listeners: Tab no longer wraps.
		last.focus();
		expect(key(panel, 'Tab').defaultPrevented).toBe(false);
	});

	it('leaves the focus where the player moved it', () => {
		const release = trap();
		const elsewhere = new FakeElement('elsewhere');
		elsewhere.focus();
		release();
		expect(doc.activeElement).toBe(elsewhere);
	});
});
