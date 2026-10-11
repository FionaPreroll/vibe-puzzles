/**
 * Whether two plain data values (as saved: objects, arrays, numbers, strings, booleans, null) are
 * equal, as their JSON would be, but without building the text. Key order does not matter, and a
 * key whose value is `undefined` counts as missing, as in JSON.
 *
 * The games' states are such values; their `encodeState` is no substitute, as it may leave parts
 * out (Tetroid's leaves out which crosses a helper placed).
 */
export function sameData(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (!sameData(a[i], b[i])) return false;
		return true;
	}
	if (Array.isArray(b)) return false;
	const x = a as Record<string, unknown>;
	const y = b as Record<string, unknown>;
	const keys = Object.keys(x).filter((k) => x[k] !== undefined);
	if (keys.length !== Object.keys(y).filter((k) => y[k] !== undefined).length) return false;
	return keys.every((k) => Object.hasOwn(y, k) && sameData(x[k], y[k]));
}
