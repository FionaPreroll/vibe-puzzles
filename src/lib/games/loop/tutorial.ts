import type { TutorialStep } from '../../core/types';
import { CROSS, hIndex, LINE, vIndex, type LoopPuzzle, type LoopState } from './rules';

/**
 * First puzzle for new players, 5×5. A 0 in the top half with a 3 on three sides of it: the 0
 * crosses its sides, the 3s then have just three sides left, their line has one way on at each
 * end, and those ends meet where the loop must not close yet. The rest is the player's, with the
 * same three ideas.
 */
export const LOOP_TUTORIAL: LoopPuzzle = {
	width: 5,
	height: 5,
	// prettier-ignore
	clues:
		'.....' +
		'.303.' +
		'..3..' +
		'20.02' +
		'..3..'
};

/** The 0 and the three 3s around it, as cell indices. */
const ZERO = 7;
const THREES = [6, 8, 12];

/** Edge keys as the board uses them (`h:i:j`, `v:i:j`). */
const ZERO_SIDES = ['h:1:2', 'h:2:2', 'v:1:2', 'v:1:3'];
// prettier-ignore
const THREE_SIDES = [
	'h:1:1', 'v:1:1', 'h:2:1',
	'h:1:3', 'v:1:4', 'h:2:3',
	'v:2:2', 'h:3:2', 'v:2:3'
];
/** Where the line goes on above the 0, and the edge between the two ends that would close it. */
const LINE_ENDS = ['v:0:2', 'v:0:3'];
export const EARLY_LOOP = 'h:0:2';

/** Dots as `d:` keys, numbered `i * (W + 1) + j`. */
const dot = (i: number, j: number) => `d:${i * (LOOP_TUTORIAL.width + 1) + j}`;

function index(p: LoopPuzzle, key: string): { kind: 'h' | 'v'; at: number } {
	const [kind, i, j] = key.split(':');
	return kind === 'h'
		? { kind: 'h', at: hIndex(p, Number(i), Number(j)) }
		: { kind: 'v', at: vIndex(p, Number(i), Number(j)) };
}

/** A task that marks `edges` with `mark` (LINE or CROSS); "Show me" sets them. */
function edgeStep(
	edges: string[],
	mark: number,
	spotlight: string[]
): TutorialStep<LoopPuzzle, LoopState> {
	return {
		spotlight,
		done: (p, s) =>
			edges.every((key) => {
				const { kind, at } = index(p, key);
				return s[kind][at] === mark;
			}),
		show: (p, s) => {
			const next = { h: s.h.slice(), v: s.v.slice() };
			for (const key of edges) {
				const { kind, at } = index(p, key);
				next[kind][at] = mark;
			}
			return next;
		}
	};
}

/** Texts under `games.loop.tutorial`, one per step. */
export const LOOP_TUTORIAL_STEPS: TutorialStep<LoopPuzzle, LoopState>[] = [
	// The goal: one closed loop, and what a number counts.
	{},
	// A 0: no line on any side. The player meets the Cross tool.
	edgeStep(ZERO_SIDES, CROSS, [`c:${ZERO}`]),
	// Each 3 has lost the side it shares with the 0, so its other three sides have lines.
	edgeStep(
		THREE_SIDES,
		LINE,
		THREES.map((c) => `c:${c}`)
	),
	// Two lines or none at every dot: both ends above the 0 have one way on.
	edgeStep(LINE_ENDS, LINE, [dot(1, 2), dot(1, 3)]),
	// The ends are now neighbours: joining them would close the loop around these cells only.
	edgeStep([EARLY_LOOP], CROSS, [dot(0, 2), dot(0, 3), EARLY_LOOP]),
	// The rest alone; the tutorial ends when the loop is closed.
	{}
];
