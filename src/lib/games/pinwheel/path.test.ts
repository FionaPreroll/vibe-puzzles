import { describe, expect, it } from 'vitest';
import { extendPath, type Dot } from './path';

const d = (i: number, j: number): Dot => ({ i, j });

describe('extendPath', () => {
	it('extends in a straight line and shortens when going back', () => {
		let path = [d(0, 0)];
		path = extendPath(path, d(0, 2));
		expect(path).toEqual([d(0, 0), d(0, 1), d(0, 2)]);
		expect(extendPath(path, d(0, 1))).toEqual([d(0, 0), d(0, 1)]);
		expect(extendPath(path, d(1, 1))).toBe(path);
	});

	it('keeps the clicked edge when the drag starts towards its far end', () => {
		// Clicked edge (0,1)-(0,2) near dot (0,1), then dragged right past (0,2) to (0,3).
		let path = [d(0, 2), d(0, 1)];
		path = extendPath(path, d(0, 2), true);
		expect(path).toEqual([d(0, 1), d(0, 2)]);
		path = extendPath(path, d(0, 3), true);
		expect(path).toEqual([d(0, 1), d(0, 2), d(0, 3)]);
	});

	it('never shrinks an edge-started path below the clicked edge', () => {
		const path = [d(0, 1), d(0, 2), d(0, 3)];
		expect(extendPath(path, d(0, 1), true)).toEqual([d(0, 1), d(0, 2)]);
	});

	it('without an anchor, going back to the start leaves only the start dot', () => {
		expect(extendPath([d(0, 2), d(0, 1)], d(0, 2))).toEqual([d(0, 2)]);
	});
});
