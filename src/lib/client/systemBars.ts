/**
 * Android's system bars around the page: the status bar at the top and the navigation bar (the
 * gesture hint) at the bottom.
 *
 * An installed app (WebAPK) colours its status bar with `<meta name="theme-color">`, which
 * `followThemeColor` keeps to the colour at the top of the page, by day and by night and in every
 * look. The navigation bar would take the manifest's fixed `theme_color`; with `viewport-fit=cover`
 * (`app.html`) Chrome draws the page behind it instead, so it shows the page's own background, and
 * the theme colour decides whether its buttons are light or dark. The page keeps its content above
 * the bar with the safe area insets (`env(safe-area-inset-*)`, see `layout.css`).
 */

/** The colour that `layers` paint, bottom first, as `#rrggbb`: later ones may be translucent. */
export function paintedColor(layers: string[]): string {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return '#000000';
	// An opaque start, as the screen under the page is.
	ctx.fillStyle = '#000000';
	ctx.fillRect(0, 0, 1, 1);
	for (const layer of layers) {
		ctx.fillStyle = layer;
		ctx.fillRect(0, 0, 1, 1);
	}
	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
	return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * The colour at the top of the page: the header bar over the page's background, or the background
 * alone while the header bar is hidden (`headerBar`).
 */
export function topColor(headerShown: boolean): string {
	const layers = [getComputedStyle(document.documentElement).backgroundColor];
	const header = document.querySelector('header');
	if (header && headerShown) layers.push(getComputedStyle(header).backgroundColor);
	return paintedColor(layers);
}

/** Set `<meta name="theme-color">` to the colour at the top of the page. */
export function followThemeColor(headerShown: boolean) {
	let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (!meta) {
		meta = document.createElement('meta');
		meta.name = 'theme-color';
		document.head.append(meta);
	}
	meta.content = topColor(headerShown);
}

/** Height of the system bar over the bottom of the page (0 where the page does not reach under it). */
export function safeAreaBottom(): number {
	const probe = document.createElement('div');
	probe.style.cssText =
		'position:fixed;visibility:hidden;pointer-events:none;height:env(safe-area-inset-bottom,0px)';
	document.body.append(probe);
	const height = probe.offsetHeight;
	probe.remove();
	return height;
}
