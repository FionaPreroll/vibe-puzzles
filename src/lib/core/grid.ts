/** Orthogonal neighbours of cell index `i` in a `w`×`h` grid. */
export function neighbours(i: number, w: number, h: number): number[] {
	const r = Math.floor(i / w);
	const c = i % w;
	const out: number[] = [];
	if (r > 0) out.push(i - w);
	if (r < h - 1) out.push(i + w);
	if (c > 0) out.push(i - 1);
	if (c < w - 1) out.push(i + 1);
	return out;
}

/**
 * Bright colours for the win animation, neighbouring regions never share one. Each is a CSS
 * variable with the classic colour as fallback, so a look can bring its own (halloween.css).
 */
export const CELEBRATION_COLOURS = [
	'#f87171',
	'#fbbf24',
	'#34d399',
	'#60a5fa',
	'#a78bfa',
	'#f472b6',
	'#2dd4bf',
	'#fb923c'
].map((colour, i) => `var(--celebrate-${i + 1}, ${colour})`);

/**
 * A colour index per region (`region` holds a region id per cell) such that neighbouring regions
 * differ: greedy, largest regions first, cycling through `colours` choices.
 */
export function colourRegions(region: ArrayLike<number>, w: number, h: number, colours: number) {
	const count = Math.max(-1, ...Array.from(region)) + 1;
	const adjacent = Array.from({ length: count }, () => new Set<number>());
	const size = new Array<number>(count).fill(0);
	for (let i = 0; i < w * h; i++) {
		size[region[i]]++;
		for (const j of neighbours(i, w, h)) {
			if (region[j] !== region[i]) adjacent[region[i]].add(region[j]);
		}
	}
	const out = new Array<number>(count).fill(-1);
	const order = [...out.keys()].sort((a, b) => size[b] - size[a] || a - b);
	for (const [n, r] of order.entries()) {
		const used = new Set([...adjacent[r]].map((q) => out[q]));
		// Start at a different colour each time, so the board gets a mix rather than mostly one.
		let c = n % colours;
		for (let k = 0; k < colours && used.has(c); k++) c = (c + 1) % colours;
		out[r] = c;
	}
	return out;
}

/** Column label as used for board coordinates: a..z, aa, ab, … */
export function columnLabel(c: number): string {
	let s = '';
	let n = c + 1;
	while (n > 0) {
		const m = (n - 1) % 26;
		s = String.fromCharCode(97 + m) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
}

/** Pack small non-negative integers (< 16) into a URL-safe string. */
export function packDigits(values: ArrayLike<number>): string {
	const bytes = new Uint8Array(Math.ceil(values.length / 2));
	for (let i = 0; i < values.length; i++) {
		bytes[i >> 1] |= (values[i] & 15) << ((i & 1) * 4);
	}
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unpackDigits(text: string, length: number): number[] {
	const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
	const out: number[] = [];
	for (let i = 0; i < length; i++) {
		const b = bin.charCodeAt(i >> 1) || 0;
		out.push((b >> ((i & 1) * 4)) & 15);
	}
	return out;
}
