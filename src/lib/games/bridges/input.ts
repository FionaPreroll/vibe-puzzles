import { blocked, bridgesOf, CROSS, MAX_BRIDGES, type BridgesGraph } from './rules';

/**
 * What a click on a link leaves there: with the Bridge tool one bridge more, round from two back
 * to none (a cross gives way to a bridge), and with the right button (`inverse`) a cross, or
 * none where there is one. The Cross tool the other way round.
 */
export function nextValue(tool: string, current: number, inverse: boolean): number {
	const bridge = (tool === 'cross') === inverse;
	if (!bridge) return current === CROSS ? 0 : CROSS;
	return current === CROSS ? 1 : (current + 1) % (MAX_BRIDGES + 1);
}

/** The link over water cell `cell` along an axis: across (a step left or right), or down. */
const over = (g: BridgesGraph, cell: number, isAcross: boolean) =>
	(isAcross ? g.acrossAt : g.downAt)[cell];

/**
 * The link a click at (`x`, `y`) means, in cell units, or -1: one of the links over the water
 * cell there. Where two cross, the one with bridges (the other cannot take any), else the one
 * whose line runs closer to the point.
 */
export function linkAt(g: BridgesGraph, values: readonly number[], x: number, y: number): number {
	const col = Math.floor(x);
	const row = Math.floor(y);
	if (col < 0 || row < 0 || col >= g.width || row >= g.height) return -1;
	const cell = row * g.width + col;
	const across = g.acrossAt[cell];
	const down = g.downAt[cell];
	if (across < 0 || down < 0) return Math.max(across, down);
	if (bridgesOf(values[across]) !== bridgesOf(values[down])) {
		return bridgesOf(values[across]) ? across : down;
	}
	return Math.abs(y - row - 0.5) <= Math.abs(x - col - 0.5) ? across : down;
}

/**
 * The link that a drag or the keyboard cursor follows from cell `from` to the cell `to` next to
 * it: the link over the water there along the way it moves, -1 for none (or cells apart).
 */
export function linkBetween(g: BridgesGraph, from: number, to: number): number {
	const w = g.width;
	const sideways = Math.floor(from / w) === Math.floor(to / w) && Math.abs(from - to) === 1;
	if (!sideways && Math.abs(from - to) !== w) return -1;
	const water = g.islandAt[to] < 0 ? to : from;
	return g.islandAt[water] < 0 ? over(g, water, sideways) : -1;
}

/**
 * `values` with every link of `links` set to `value`, and the links that changed: bridges only
 * where no bridge crosses them (crosses go anywhere).
 */
export function setLinks(
	g: BridgesGraph,
	values: readonly number[],
	links: readonly number[],
	value: number
): { values: number[]; changed: number[] } {
	const out = values.slice();
	const changed: number[] = [];
	for (const l of links) {
		if (out[l] === value || (bridgesOf(value) && blocked(g, out, l))) continue;
		out[l] = value;
		changed.push(l);
	}
	return { values: out, changed };
}
