import { turn } from './rules';

/** The middle of each side of a cell, from its centre, clockwise from the top. */
const ends = (half: number) => ['0 ' + -half, half + ' 0', '0 ' + half, -half + ' 0'];

/**
 * The pipe of a tile as an SVG path around the cell's centre, `half` being half a cell: from the
 * centre to the middle of each side it opens to. Opposite sides make one straight pipe, so that
 * its walls run on through the middle; a bend turns there.
 */
export function tilePath(mask: number, half: number): string {
	const end = ends(half);
	const sides = [0, 1, 2, 3].filter((k) => mask & (1 << k));
	const straight = sides.filter((k) => k < 2 && sides.includes(k + 2));
	const rest = sides.filter((k) => !straight.includes(k % 2));
	let d = straight.map((k) => `M${end[k]}L${end[k + 2]}`).join('');
	if (rest.length === 2) d += `M${end[rest[0]]}L0 0L${end[rest[1]]}`;
	else if (rest.length === 1) d += `M0 0L${end[rest[0]]}`;
	return d;
}

/** For each tile, the quarter turns clockwise from how it was dealt (`base`) to how it lies. */
export function spinFrom(base: readonly number[], tiles: readonly number[]): number[] {
	return tiles.map((mask, c) =>
		Math.max(
			0,
			[0, 1, 2, 3].findIndex((q) => turn(base[c], q) === mask)
		)
	);
}

/**
 * The shortest turn from `before` to `after`, in quarter turns: clockwise for a quarter (also
 * when a straight pipe could go either way), anticlockwise for three quarters, else half round.
 */
export function quartersBetween(before: number, after: number): number {
	if (turn(before, 1) === after) return 1;
	if (turn(before, 3) === after) return -1;
	return turn(before, 2) === after ? 2 : 0;
}

/**
 * Rings around the source, two tiles deep along the pipes, as a number per tile: the win
 * animation colours them in turn, like water spreading. `met` holds the joined sides per tile.
 */
export function waterRings(nb: Int32Array, met: readonly number[], source: number): number[] {
	const depth = met.map(() => -1);
	depth[source] = 0;
	const queue = [source];
	for (let q = 0; q < queue.length; q++) {
		const c = queue[q];
		for (let k = 0; k < 4; k++) {
			const m = nb[c * 4 + k];
			if (!(met[c] & (1 << k)) || depth[m] >= 0) continue;
			depth[m] = depth[c] + 1;
			queue.push(m);
		}
	}
	// Tiles the water does not reach form a ring of their own beyond the others.
	const last = Math.max(...depth);
	return depth.map((d) => Math.floor((d < 0 ? last + 2 : d) / 2));
}
