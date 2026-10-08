/** Keyboard focus for drawers and popovers that sit on top of the page. */

const FOCUSABLE = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Move the focus into `node` and keep Tab and Shift+Tab inside it; Escape calls `onEscape`.
 * Returns the cleanup, which gives the focus back to where it was before, unless the player has
 * moved it elsewhere meanwhile.
 */
export function trapFocus(node: HTMLElement, onEscape?: () => void): () => void {
	const opener = document.activeElement as HTMLElement | null;
	// Controls hidden by the layout (e.g. desktop-only buttons in the phone drawer) take no focus.
	const items = () =>
		[...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length);

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && onEscape) {
			e.preventDefault();
			e.stopPropagation();
			onEscape();
			return;
		}
		if (e.key !== 'Tab') return;
		const list = items();
		const active = document.activeElement;
		const outside = !active || !node.contains(active);
		if (!list.length) return e.preventDefault();
		if (e.shiftKey && (outside || active === list[0])) {
			e.preventDefault();
			list[list.length - 1].focus();
		} else if (!e.shiftKey && (outside || active === list[list.length - 1])) {
			e.preventDefault();
			list[0].focus();
		}
	}

	node.addEventListener('keydown', onkeydown);
	items()[0]?.focus();
	return () => {
		node.removeEventListener('keydown', onkeydown);
		const active = document.activeElement;
		if (!active || active === document.body || node.contains(active)) opener?.focus();
	};
}
