/**
 * What differs between two states of a board, in the boards' element keys (`lastChange`): a
 * trial draws the marks set since it began in its own colour.
 */

/** Indices where two lists differ, as keys with an optional prefix (`c:3`, or `3`). */
export function changedCells(
	from: readonly number[],
	to: readonly number[],
	prefix = ''
): string[] {
	const out: string[] = [];
	for (let i = 0; i < to.length; i++) if (from[i] !== to[i]) out.push(`${prefix}${i}`);
	return out;
}

/** Edges whose mark differs, as `h:i:j` and `v:i:j` (the edge layout of Loop and Pinwheel). */
export function changedEdges(
	width: number,
	from: { h: readonly number[]; v: readonly number[] },
	to: { h: readonly number[]; v: readonly number[] }
): string[] {
	const out: string[] = [];
	for (let k = 0; k < to.h.length; k++) {
		if (from.h[k] !== to.h[k]) out.push(`h:${Math.floor(k / width)}:${k % width}`);
	}
	for (let k = 0; k < to.v.length; k++) {
		if (from.v[k] !== to.v[k]) out.push(`v:${Math.floor(k / (width + 1))}:${k % (width + 1)}`);
	}
	return out;
}
