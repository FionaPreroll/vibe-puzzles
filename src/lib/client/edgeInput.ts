import { extendPath, type Dot } from '../core/path';
import { interpolate, type BoardPoint } from './boardInput';
import type { CursorBoard } from './keyCursor.svelte';
import { MARK } from './marks';

/**
 * Drawing on the edges of a grid, as Loop and Pinwheel do: which edge or dot a pointer is on, and
 * how a move grows as the pointer is dragged or the keyboard cursor steps from dot to dot. The
 * board keeps the move and applies it; this module only computes it.
 */

/** An edge: horizontal (`h`) from dot (i, j) to (i, j + 1), vertical (`v`) to (i + 1, j). */
export interface Edge {
	kind: 'h' | 'v';
	i: number;
	j: number;
}

/** An edge's key, as the boards name changes, hints and highlights: `h:2:3`. */
export const edgeKey = (e: Edge) => `${e.kind}:${e.i}:${e.j}`;

export function parseEdge(key: string): Edge {
	const [kind, i, j] = key.split(':');
	return { kind: kind as Edge['kind'], i: Number(i), j: Number(j) };
}

/** The edge between two neighbouring dots. */
export function edgeBetween(a: Dot, b: Dot): Edge {
	return a.i === b.i
		? { kind: 'h', i: a.i, j: Math.min(a.j, b.j) }
		: { kind: 'v', i: Math.min(a.i, b.i), j: a.j };
}

/** A move under way: the edges it sets, or a line drawn along a path of dots. */
export interface EdgeMove {
	/** What the move sets its edges to; null until an edge decides, for a move begun on a dot. */
	status: number | null;
	/** Right button (or Ctrl): the tool's other mark. */
	inverse: boolean;
	edges: string[];
	/** A continuous line through these dots, in place of `edges`. */
	path: Dot[] | null;
	/** The path began on an edge, which stays drawn whichever way the pointer goes. */
	anchored?: boolean;
}

/** What `EdgeInput` needs to know of its board. */
export interface EdgeBoard {
	/** Size in cells. */
	size(): { width: number; height: number };
	/** Lines are drawn along a path of dots rather than edge by edge (a setting). */
	continuous(): boolean;
	/** What a move sets edge `e` to, or null where it cannot change (a fixed edge, say). */
	statusOf(e: Edge, inverse: boolean): number | null;
}

/** Closer than this to a dot (in cells), the pointer is on the dot rather than on an edge. */
const ON_DOT = 0.2;
/** Closer than this to a dot, a continuous line reaches the dot. */
const REACH_DOT = 0.45;

export class EdgeInput {
	constructor(private readonly board: EdgeBoard) {}

	/** The dot nearest to (x, y), on the board. */
	nearestDot(x: number, y: number): Dot {
		const { width, height } = this.board.size();
		return {
			i: Math.min(height, Math.max(0, Math.round(y))),
			j: Math.min(width, Math.max(0, Math.round(x)))
		};
	}

	/** The edge nearest to (x, y): inside a cell the closest of its sides; null near a dot. */
	edgeAt(x: number, y: number): Edge | null {
		const { edge, fromDot } = this.#nearest(x, y);
		return fromDot < ON_DOT ? null : edge;
	}

	/** A move begun at (x, y), on a dot or on an edge; null on an edge that cannot change. */
	begin(x: number, y: number, inverse: boolean): EdgeMove | null {
		const dot = this.nearestDot(x, y);
		if (Math.hypot(x - dot.j, y - dot.i) < ON_DOT) return this.beginAt(dot, inverse);
		const e = this.#nearest(x, y).edge;
		const status = this.board.statusOf(e, inverse);
		if (status == null) return null;
		let path: Dot[] | null = null;
		if (status === MARK && this.board.continuous()) {
			const ends: [Dot, Dot] = [
				{ i: e.i, j: e.j },
				e.kind === 'h' ? { i: e.i, j: e.j + 1 } : { i: e.i + 1, j: e.j }
			];
			// The line goes on from the end nearer the pointer.
			const [a, b] = ends;
			path = Math.hypot(x - a.j, y - a.i) < Math.hypot(x - b.j, y - b.i) ? [b, a] : [a, b];
		}
		return { status, inverse, edges: [edgeKey(e)], path, anchored: !!path };
	}

	/** A move begun on `dot`; the first edge it reaches decides what it does. */
	beginAt(dot: Dot, inverse: boolean): EdgeMove {
		return { status: null, inverse, edges: [], path: this.board.continuous() ? [dot] : null };
	}

	/** `move`, dragged on from `from` to `to`. */
	drag<M extends EdgeMove>(move: M, from: BoardPoint, to: BoardPoint): M {
		let { status, edges, path } = move;
		for (const { x, y } of interpolate(from, to, 5)) {
			if (status == null) {
				// Begun on a dot: the first edge reached that can change decides.
				const e = this.edgeAt(x, y);
				const decided = e ? this.board.statusOf(e, move.inverse) : null;
				if (!e || decided == null) continue;
				status = decided;
				if (status !== MARK || !path) {
					path = null;
					edges = [edgeKey(e)];
					continue;
				}
			}
			if (path) {
				const d = this.nearestDot(x, y);
				if (Math.hypot(x - d.j, y - d.i) < REACH_DOT) path = extendPath(path, d, move.anchored);
			} else {
				edges = withEdge(edges, this.edgeAt(x, y));
			}
		}
		return { ...move, status, edges, path };
	}

	/** `move`, stepped on by the keyboard cursor from dot `from` to its neighbour `to`. */
	step<M extends EdgeMove>(move: M, from: Dot, to: Dot): M {
		const e = edgeBetween(from, to);
		let { status, path } = move;
		if (status == null) {
			// Begun on a dot: the first edge that can change decides.
			status = this.board.statusOf(e, move.inverse);
			if (status != null && status !== MARK) path = null;
		}
		if (path) return { ...move, status, path: extendPath(path, to) };
		return { ...move, status, path, edges: withEdge(move.edges, e) };
	}

	/** The keys of the edges `move` sets. */
	edgesOf(move: EdgeMove): string[] {
		const path = move.path;
		if (!path) return move.edges;
		return path.slice(1).map((to, k) => edgeKey(edgeBetween(path[k], to)));
	}

	/** The places of a keyboard cursor on the dots (`KeyCursor`): from the top left corner. */
	readonly dots: Pick<CursorBoard<Dot>, 'first' | 'step'> = {
		first: () => ({ i: 0, j: 0 }),
		step: (at, rows, cols) => {
			const { width, height } = this.board.size();
			const dot = { i: at.i + rows, j: at.j + cols };
			return dot.i < 0 || dot.i > height || dot.j < 0 || dot.j > width ? null : dot;
		}
	};

	/**
	 * The edge nearest to (x, y), also next to a dot, and how far from the nearest dot the point
	 * is. A point off the board counts where it would be on its border.
	 */
	#nearest(x: number, y: number): { edge: Edge; fromDot: number } {
		const { width, height } = this.board.size();
		const cx = Math.min(width, Math.max(0, x));
		const cy = Math.min(height, Math.max(0, y));
		const dx = Math.abs(cx - Math.round(cx));
		const dy = Math.abs(cy - Math.round(cy));
		const edge: Edge =
			dy <= dx
				? { kind: 'h', i: Math.round(cy), j: Math.min(width - 1, Math.floor(cx)) }
				: { kind: 'v', i: Math.min(height - 1, Math.floor(cy)), j: Math.round(cx) };
		return { edge, fromDot: Math.hypot(dx, dy) };
	}
}

/** `edges` with `e` added, unless it is there already (or none). */
function withEdge(edges: string[], e: Edge | null): string[] {
	return !e || edges.includes(edgeKey(e)) ? edges : [...edges, edgeKey(e)];
}
