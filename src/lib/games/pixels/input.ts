import { nextMark } from '../../client/marks';
import type { PixelsState } from './rules';

/**
 * A move with the pointer or the keys: it starts on a cell and runs along its row or column.
 * Every cell on the way that has the start cell's mark (`from`) gets the move's mark (`to`), so
 * a drag fills empty cells without touching crosses, or clears filled cells and nothing else.
 */
export interface Stroke {
	start: number;
	/** The cell the pointer or the cursor is at now. */
	end: number;
	from: number;
	to: number;
}

/** A move from `cell` with `tool` (`inverse` for the right button or Shift). */
export function startStroke(
	cells: readonly number[],
	tool: string,
	cell: number,
	inverse: boolean
): Stroke {
	return { start: cell, end: cell, from: cells[cell], to: nextMark(tool, cells[cell], inverse) };
}

/**
 * The cells a move covers, from its start: along its row towards the end's column, or along its
 * column towards the end's row, whichever is further away.
 */
export function strokeLine(s: Stroke, width: number): number[] {
	const [r0, c0] = [Math.floor(s.start / width), s.start % width];
	const [r1, c1] = [Math.floor(s.end / width), s.end % width];
	const across = Math.abs(c1 - c0) >= Math.abs(r1 - r0);
	const steps = across ? Math.abs(c1 - c0) : Math.abs(r1 - r0);
	const step = across ? Math.sign(c1 - c0) : Math.sign(r1 - r0) * width;
	return Array.from({ length: steps + 1 }, (_, k) => s.start + k * step);
}

/** `state` with a move applied, and the cells it changes. */
export function applyStroke(
	state: PixelsState,
	s: Stroke,
	width: number
): { state: PixelsState; changed: number[] } {
	const changed = strokeLine(s, width).filter((c) => state.cells[c] === s.from && s.from !== s.to);
	if (!changed.length) return { state, changed };
	const cells = state.cells.slice();
	for (const c of changed) cells[c] = s.to;
	return { state: { cells }, changed };
}
