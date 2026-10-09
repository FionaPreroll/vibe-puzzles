import type { TutorialStep } from '../../core/types';
import {
	analyze,
	hIndex,
	interiorEdges,
	LINE,
	OPEN,
	vIndex,
	type PinwheelPuzzle,
	type PinwheelState
} from './rules';

/**
 * First puzzle for new players, 5×5. The steps go from the easiest region to the hardest: a
 * circle on a cell in the corner, one on an edge, one on a corner, then a zigzag in the middle.
 * The player then finishes the board alone, with two more zigzags among the last four regions.
 */
export const PINWHEEL_TUTORIAL: PinwheelPuzzle = {
	width: 5,
	height: 5,
	centres: [
		[0, 0],
		[0, 3],
		[1, 7],
		[3, 4],
		[4, 1],
		[5, 8],
		[7, 0],
		[8, 3],
		[7, 6]
	]
};

/** The solution as the centre index of every cell. */
export const PINWHEEL_TUTORIAL_SOLUTION = [
	0, 1, 1, 2, 2, 4, 3, 3, 2, 2, 4, 4, 3, 3, 5, 6, 4, 8, 8, 5, 6, 7, 7, 8, 8
];

const solutionCells = (k: number) =>
	PINWHEEL_TUTORIAL_SOLUTION.flatMap((owner, i) => (owner === k ? [i] : []));

/** Whether centre `k` has exactly its region of the solution (a different symmetric one is no help). */
export function regionDone(p: PinwheelPuzzle, s: PinwheelState, k: number): boolean {
	const a = analyze(p, s);
	const r = a.centreRegion[k];
	const want = solutionCells(k);
	return (
		a.complete[r] && a.regionCells[r].length === want.length && want.every((i) => a.region[i] === r)
	);
}

/** Draws the solution's lines around region `k` and clears any line inside it. */
export function showRegion(p: PinwheelPuzzle, s: PinwheelState, k: number): PinwheelState {
	const next: PinwheelState = { ...s, h: s.h.slice(), v: s.v.slice() };
	const own = (i: number) => PINWHEEL_TUTORIAL_SOLUTION[i] === k;
	for (const e of interiorEdges(p)) {
		if (!own(e.a) && !own(e.b)) continue;
		const value = own(e.a) && own(e.b) ? OPEN : LINE;
		if (e.kind === 'h') next.h[hIndex(p, e.i, e.j)] = value;
		else next.v[vIndex(p, e.i, e.j)] = value;
	}
	return next;
}

const regionStep = (
	k: number,
	...spotlight: string[]
): TutorialStep<PinwheelPuzzle, PinwheelState> => ({
	spotlight: [`g:${k}`, ...spotlight],
	done: (p, s) => regionDone(p, s, k),
	show: (p, s) => showRegion(p, s, k)
});

/** Texts under `games.pinwheel.tutorial`, one per step. */
export const PINWHEEL_TUTORIAL_STEPS: TutorialStep<PinwheelPuzzle, PinwheelState>[] = [
	// What the puzzle is about: every circle gets one region.
	{ spotlight: PINWHEEL_TUTORIAL.centres.map((_, k) => `g:${k}`) },
	// The symmetry rule, still without a task.
	{},
	// A circle on a cell in the corner: that cell alone.
	regionStep(0),
	// A circle on an edge: two cells.
	regionStep(1),
	// A circle on a corner: four cells.
	regionStep(2),
	// The symmetry helper finds the partner of the marked cell for a zigzag.
	regionStep(3, 'c:6'),
	// The rest alone; the tutorial ends when the board is solved.
	{}
];
