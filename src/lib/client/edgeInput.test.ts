import { describe, expect, it } from 'vitest';
import { EdgeInput, edgeBetween, edgeKey, parseEdge } from './edgeInput';
import { CROSS, EMPTY, MARK, nextMark } from './marks';

interface Options {
	/** Lines along a path of dots (the default), or edge by edge. */
	continuous?: boolean;
	/** Edges that cannot change. */
	fixed?: string[];
	/** Marks on the board; the rest is empty. */
	marks?: Record<string, number>;
}

/** Drawing on a board of 3×2 cells (dots 0–2 down, 0–3 across) with the line tool. */
function board(options: Options = {}) {
	return new EdgeInput({
		size: () => ({ width: 3, height: 2 }),
		continuous: () => options.continuous ?? true,
		statusOf: (e, inverse) =>
			options.fixed?.includes(edgeKey(e))
				? null
				: nextMark('black', options.marks?.[edgeKey(e)] ?? EMPTY, inverse)
	});
}

const at = (x: number, y: number) => ({ x, y });

describe('edges', () => {
	it('have keys, and lie between neighbouring dots', () => {
		expect(edgeKey({ kind: 'h', i: 1, j: 2 })).toBe('h:1:2');
		expect(parseEdge('v:0:3')).toEqual({ kind: 'v', i: 0, j: 3 });
		expect(edgeBetween({ i: 1, j: 2 }, { i: 1, j: 1 })).toEqual({ kind: 'h', i: 1, j: 1 });
		expect(edgeBetween({ i: 0, j: 2 }, { i: 1, j: 2 })).toEqual({ kind: 'v', i: 0, j: 2 });
		expect(edgeBetween({ i: 1, j: 2 }, { i: 0, j: 2 })).toEqual({ kind: 'v', i: 0, j: 2 });
	});
});

describe('EdgeInput', () => {
	it('finds the nearest dot and edge on the board, also for a point off it', () => {
		const input = board();
		expect(input.nearestDot(1.4, 0.6)).toEqual({ i: 1, j: 1 });
		expect(input.nearestDot(-3, 9)).toEqual({ i: 2, j: 0 });
		expect(input.nearestDot(7, -1)).toEqual({ i: 0, j: 3 });

		const edge = (x: number, y: number) => {
			const e = input.edgeAt(x, y);
			return e && edgeKey(e);
		};
		// Inside a cell, its nearest side.
		expect(edge(1.5, 0.1)).toBe('h:0:1');
		expect(edge(1.9, 0.5)).toBe('v:0:2');
		// Near a dot, none.
		expect(edge(1.05, 1.05)).toBeNull();
		// Off the board, the border edge next to it, or none where that is near a dot.
		expect(edge(-1, 1.5)).toBe('v:1:0');
		expect(edge(-0.3, 1.05)).toBeNull();
		expect(edge(3.5, 0.5)).toBe('v:0:3');
		expect(edge(2.5, 2.4)).toBe('h:2:2');
		expect(edge(5, 2.5)).toBeNull();
	});

	it('begins on a dot without a mark yet, for the first edge to decide', () => {
		const input = board();
		expect(input.begin(1.05, 0.95, false)).toEqual({
			status: null,
			inverse: false,
			edges: [],
			path: [{ i: 1, j: 1 }]
		});
		expect(input.beginAt({ i: 2, j: 3 }, true)).toEqual({
			status: null,
			inverse: true,
			edges: [],
			path: [{ i: 2, j: 3 }]
		});
		expect(board({ continuous: false }).beginAt({ i: 2, j: 3 }, false).path).toBeNull();
	});

	it('begins on an edge with the mark the tool gives it, a line from the end nearer the pointer', () => {
		expect(board().begin(1.3, 0.05, false)).toEqual({
			status: MARK,
			inverse: false,
			edges: ['h:0:1'],
			path: [
				{ i: 0, j: 2 },
				{ i: 0, j: 1 }
			],
			anchored: true
		});
		expect(board().begin(1.7, 0.05, false)!.path).toEqual([
			{ i: 0, j: 1 },
			{ i: 0, j: 2 }
		]);
		expect(board().begin(0.05, 0.6, false)).toMatchObject({
			edges: ['v:0:0'],
			path: [
				{ i: 0, j: 0 },
				{ i: 1, j: 0 }
			]
		});
		// Taking a line away, a cross, or edge by edge: no path.
		const line = board({ marks: { 'h:0:1': MARK } }).begin(1.3, 0.05, false)!;
		expect([line.status, line.path, line.anchored]).toEqual([EMPTY, null, false]);
		expect(board().begin(1.3, 0.05, true)).toMatchObject({ status: CROSS, path: null });
		expect(board({ continuous: false }).begin(1.3, 0.05, false)).toMatchObject({
			status: MARK,
			edges: ['h:0:1'],
			path: null
		});
		// An edge that cannot change begins nothing.
		expect(board({ fixed: ['h:0:1'] }).begin(1.3, 0.05, false)).toBeNull();
	});

	it('drags a line through the dots it reaches, and back', () => {
		const input = board();
		const start = input.begin(0.05, 0.05, false)!;
		const out = input.drag(start, at(0.05, 0.05), at(2, 0));
		expect(out.status).toBe(MARK);
		expect(input.edgesOf(out)).toEqual(['h:0:0', 'h:0:1']);
		expect(input.edgesOf(input.drag(out, at(2, 0), at(1, 0)))).toEqual(['h:0:0']);
		// The move it came from stays as it was.
		expect(start).toEqual(input.begin(0.05, 0.05, false));
	});

	it('keeps the edge a line began on, whichever way the pointer goes', () => {
		const input = board();
		const start = input.begin(1.3, 0.05, false)!;
		expect(input.edgesOf(input.drag(start, at(1.3, 0.05), at(2, 0)))).toEqual(['h:0:1']);
		expect(input.edgesOf(input.drag(start, at(1.3, 0.05), at(0, 0)))).toEqual(['h:0:1', 'h:0:0']);
	});

	it('drags crosses, or lines edge by edge, over the edges it passes', () => {
		const crosses = board().drag(board().begin(0.05, 0.05, true)!, at(0.05, 0.05), at(2, 0));
		expect(crosses).toMatchObject({ status: CROSS, path: null, edges: ['h:0:0', 'h:0:1'] });
		expect(board().edgesOf(crosses)).toEqual(['h:0:0', 'h:0:1']);

		const input = board({ continuous: false });
		const lines = input.drag(input.begin(0.05, 0.05, false)!, at(0.05, 0.05), at(0.1, 1.9));
		expect(lines).toMatchObject({ status: MARK, path: null, edges: ['v:0:0', 'v:1:0'] });
		// Back over the same edges: each counts once.
		expect(input.drag(lines, at(0.1, 1.9), at(0.05, 0.3)).edges).toEqual(['v:0:0', 'v:1:0']);
	});

	it('lets the first edge that can change decide a move begun on a dot', () => {
		const input = board({ fixed: ['h:0:0'] });
		const moved = input.drag(input.begin(0.05, 0.05, true)!, at(0.05, 0.05), at(2, 0));
		expect(moved).toMatchObject({ status: CROSS, edges: ['h:0:1'] });
		// Nothing that can change: still undecided.
		const still = input.drag(input.begin(0.05, 0.05, true)!, at(0.05, 0.05), at(0.9, 0));
		expect(still).toMatchObject({ status: null, edges: [] });
	});

	it('steps a line from dot to dot with the keyboard cursor', () => {
		const input = board();
		let move = input.beginAt({ i: 1, j: 0 }, false);
		move = input.step(move, { i: 1, j: 0 }, { i: 1, j: 1 });
		move = input.step(move, { i: 1, j: 1 }, { i: 0, j: 1 });
		expect(move.status).toBe(MARK);
		expect(input.edgesOf(move)).toEqual(['h:1:0', 'v:0:1']);
	});

	it('steps crosses, or anything edge by edge, over each edge once', () => {
		const input = board({ marks: { 'h:1:0': MARK } });
		let move = input.beginAt({ i: 1, j: 0 }, false);
		// A line taken away: edge by edge.
		move = input.step(move, { i: 1, j: 0 }, { i: 1, j: 1 });
		move = input.step(move, { i: 1, j: 1 }, { i: 1, j: 2 });
		move = input.step(move, { i: 1, j: 2 }, { i: 1, j: 1 });
		expect(move).toMatchObject({ status: EMPTY, path: null, edges: ['h:1:0', 'h:1:1'] });

		const plain = board({ continuous: false });
		const step = plain.step(plain.beginAt({ i: 0, j: 0 }, false), { i: 0, j: 0 }, { i: 0, j: 1 });
		expect(step).toMatchObject({ status: MARK, path: null, edges: ['h:0:0'] });
	});

	it('steps over an edge that cannot change until one can decide', () => {
		const input = board({ fixed: ['h:1:0'] });
		let move = input.step(input.beginAt({ i: 1, j: 0 }, false), { i: 1, j: 0 }, { i: 1, j: 1 });
		expect(move.status).toBeNull();
		move = input.step(move, { i: 1, j: 1 }, { i: 1, j: 2 });
		expect(move.status).toBe(MARK);
		// The board leaves out the edge that cannot change when it applies the move.
		expect(input.edgesOf(move)).toEqual(['h:1:0', 'h:1:1']);
	});

	it('keeps what a board adds to a move', () => {
		const input = board();
		const move = { ...input.beginAt({ i: 0, j: 0 }, false), kind: 'edges' as const };
		expect(input.step(move, { i: 0, j: 0 }, { i: 0, j: 1 }).kind).toBe('edges');
		expect(input.drag(move, at(0, 0), at(1, 0)).kind).toBe('edges');
	});

	it('places a keyboard cursor on the dots', () => {
		const { first, step } = board().dots;
		expect(first()).toEqual({ i: 0, j: 0 });
		expect(step({ i: 0, j: 0 }, 0, 1)).toEqual({ i: 0, j: 1 });
		expect(step({ i: 1, j: 3 }, 1, 0)).toEqual({ i: 2, j: 3 });
		for (const [i, j, rows, cols] of [
			[0, 0, -1, 0],
			[0, 0, 0, -1],
			[2, 3, 1, 0],
			[2, 3, 0, 1]
		]) {
			expect(step({ i, j }, rows, cols), `${i} ${j} ${rows} ${cols}`).toBeNull();
		}
	});
});
