/** A grid dot: row `i` and column `j` of the (h+1)×(w+1) dot lattice. */
export interface Dot {
	i: number;
	j: number;
}

/**
 * Follow the pointer with a continuous line through `path`, a list of neighbouring dots.
 * Moving back along the path shortens it; moving on in a straight line extends it.
 *
 * `anchored` paths started on an edge, which stays part of the line: reaching the start dot
 * turns the path around, so the line grows from that end instead of losing the clicked edge.
 */
export function extendPath(path: Dot[], target: Dot, anchored = false): Dot[] {
	const last = path[path.length - 1];
	if (target.i === last.i && target.j === last.j) return path;
	const idx = path.findIndex((d) => d.i === target.i && d.j === target.j);
	if (idx >= 0) {
		if (anchored && idx === 0) return path.length === 2 ? [path[1], path[0]] : path.slice(0, 2);
		return path.slice(0, idx + 1);
	}
	if (target.i !== last.i && target.j !== last.j) return path;
	const next = path.slice();
	let cur = last;
	while (cur.i !== target.i || cur.j !== target.j) {
		cur = { i: cur.i + Math.sign(target.i - cur.i), j: cur.j + Math.sign(target.j - cur.j) };
		next.push(cur);
	}
	return next;
}
