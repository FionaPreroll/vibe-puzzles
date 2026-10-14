/**
 * The page's header bar. On short screens (a phone on its side) the game page hides it (`autoHide`)
 * so that the board gets the screen's height; the header then comes down over the page while
 * `shown`, from the menu button in the game's panel, and goes away again on a tap elsewhere.
 */
export const headerBar = $state({ autoHide: false, shown: false });

/** Let the game page hide the header bar, or show it as usual again. */
export function autoHideHeader(on: boolean) {
	headerBar.autoHide = on;
	headerBar.shown = false;
}

/** Bring the hidden header bar down, or put it away. */
export function toggleHeader() {
	headerBar.shown = headerBar.autoHide && !headerBar.shown;
}
