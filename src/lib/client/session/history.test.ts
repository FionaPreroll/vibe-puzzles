import { describe, expect, it } from 'vitest';
import { History, MAX_CHECKPOINTS, MAX_UNDO } from './history.svelte';

/** Positions are plain data: a fresh copy of the same position counts as the same. */
const pos = (n: number) => ({ cells: [n] });

function started(n = 0): History<{ cells: number[] }> {
	const h = new History<{ cells: number[] }>();
	h.reset({ state: pos(n) });
	return h;
}

describe('history', () => {
	it('has no position until a game starts', () => {
		const h = new History<{ cells: number[] }>();
		expect(h.state).toBeNull();
		expect(h.push(pos(1))).toBe(false);
		expect(h.step(pos(1))).toBe(false);
		expect(h.undo()).toBe(false);
		expect(h.saveCheckpoint()).toBe(false);
		expect(h.startTrial()).toBe(false);
		expect(h.state).toBeNull();
	});

	it('undoes and redoes moves; a new move ends redo', () => {
		const h = started();
		expect(h.push(pos(1))).toBe(true);
		expect(h.push(pos(2))).toBe(true);
		expect(h.undo()).toBe(true);
		expect(h.state).toEqual(pos(1));
		expect(h.future).toEqual([pos(2)]);
		expect(h.redo()).toBe(true);
		expect(h.state).toEqual(pos(2));
		expect(h.redo()).toBe(false);
		h.undo();
		h.push(pos(3));
		expect(h.future).toEqual([]);
		expect(h.past).toEqual([pos(0), pos(1)]);
	});

	it('takes no step for a move that changes nothing', () => {
		const h = started();
		expect(h.push(pos(0))).toBe(false);
		expect(h.past).toEqual([]);
		// A step taken on purpose counts even so (e.g. a solution the game completed).
		expect(h.step(pos(0))).toBe(true);
		expect(h.past).toEqual([pos(0)]);
	});

	it(`keeps the last ${MAX_UNDO} positions to undo`, () => {
		const h = started();
		for (let i = 1; i <= MAX_UNDO + 20; i++) h.push(pos(i));
		expect(h.past).toHaveLength(MAX_UNDO);
		expect(h.past[0]).toEqual(pos(20));
	});

	it('starts over without undo and trial, keeping the checkpoints', () => {
		const h = started();
		h.push(pos(1));
		h.addCheckpoint();
		h.startTrial();
		h.restart(pos(0));
		expect(h).toMatchObject({ state: pos(0), past: [], future: [], trial: null });
		expect(h.checkpoints).toEqual([pos(1)]);
	});

	it('resets everything for another game', () => {
		const h = started();
		h.push(pos(1));
		h.addCheckpoint();
		h.reset({ state: pos(5), checkpoints: [pos(6)], currentCheckpoint: 0, trial: pos(4) });
		expect(h).toMatchObject({
			state: pos(5),
			past: [],
			future: [],
			checkpoints: [pos(6)],
			currentCheckpoint: 0,
			trial: pos(4)
		});
		h.reset(null);
		expect(h).toMatchObject({ state: null, checkpoints: [], currentCheckpoint: -1, trial: null });
	});
});

describe('checkpoints', () => {
	it('adds, overwrites, loads and deletes checkpoints', () => {
		const h = started();
		h.push(pos(1));
		// Saving without a checkpoint adds one.
		expect(h.saveCheckpoint()).toBe(true);
		expect(h.checkpoints).toEqual([pos(1)]);
		h.push(pos(2));
		expect(h.addCheckpoint()).toBe(true);
		expect(h.currentCheckpoint).toBe(1);
		h.push(pos(3));
		h.saveCheckpoint();
		expect(h.checkpoints).toEqual([pos(1), pos(3)]);

		// Loading is an undoable step, unless the board shows the checkpoint already.
		expect(h.loadCheckpoint(0)).toBe(true);
		expect(h.state).toEqual(pos(1));
		expect(h.past.at(-1)).toEqual(pos(3));
		expect(h.loadCheckpoint(0)).toBe(false);
		expect(h.loadCheckpoint(5)).toBeNull();

		expect(h.deleteCheckpoint(0)).toBe(true);
		expect(h.checkpoints).toEqual([pos(3)]);
		expect(h.currentCheckpoint).toBe(0);
		expect(h.deleteCheckpoint(3)).toBe(false);
		h.deleteCheckpoint(0);
		expect(h.currentCheckpoint).toBe(-1);
	});

	it(`keeps at most ${MAX_CHECKPOINTS}`, () => {
		const h = started();
		for (let i = 0; i < MAX_CHECKPOINTS; i++) expect(h.addCheckpoint()).toBe(true);
		expect(h.addCheckpoint()).toBe(false);
		expect(h.checkpoints).toHaveLength(MAX_CHECKPOINTS);
	});
});

describe('trials', () => {
	it('keep a trial: its moves stay', () => {
		const h = started();
		expect(h.startTrial()).toBe(true);
		expect(h.startTrial()).toBe(false);
		h.push(pos(1));
		expect(h.keepTrial()).toBe(true);
		expect(h.trial).toBeNull();
		expect(h.state).toEqual(pos(1));
		expect(h.keepTrial()).toBe(false);
	});

	it('discard a trial: back to where it began, its moves gone from the history', () => {
		const h = started();
		h.push(pos(1));
		h.startTrial();
		h.push(pos(2));
		h.push(pos(3));
		h.undo();
		expect(h.dropTrial()).toBe(true);
		expect(h.state).toEqual(pos(1));
		expect(h.past).toEqual([pos(0)]);
		expect(h.future).toEqual([]);
		expect(h.dropTrial()).toBeNull();
	});

	it('discard a trial that changed nothing', () => {
		const h = started();
		h.startTrial();
		expect(h.dropTrial()).toBe(false);
		expect(h.trial).toBeNull();
	});

	it('go back to where a trial began as an undoable step when the history no longer has it', () => {
		const h = started();
		h.reset({ state: pos(2), trial: pos(1) });
		expect(h.dropTrial()).toBe(true);
		expect(h.state).toEqual(pos(1));
		expect(h.past).toEqual([pos(2)]);
	});
});
