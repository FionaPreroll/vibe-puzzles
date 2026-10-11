import { describe, expect, it } from 'vitest';
import { changedCells, changedEdges } from './changes';

describe('changes between two states', () => {
	it('names the cells that differ, with a prefix if given', () => {
		expect(changedCells([0, 1, 2], [0, 2, 2])).toEqual(['1']);
		expect(changedCells([0, 1, 2], [1, 1, 0], 'c:')).toEqual(['c:0', 'c:2']);
		expect(changedCells([5], [5])).toEqual([]);
	});

	it('names the edges that differ in the edge layout of Loop and Pinwheel', () => {
		// Width 2, height 1: three rows of two horizontal edges, one row of three vertical ones.
		const from = { h: [0, 0, 0, 0, 0, 0], v: [0, 0, 0] };
		const to = { h: [0, 0, 0, 1, 0, 0], v: [0, 0, 2] };
		expect(changedEdges(2, from, to)).toEqual(['h:1:1', 'v:0:2']);
		expect(changedEdges(2, from, from)).toEqual([]);
	});
});
