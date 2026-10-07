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
