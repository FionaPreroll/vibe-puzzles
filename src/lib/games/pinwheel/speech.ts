import type { Edge } from '../../client/edgeInput';
import {
	direction,
	dotPlace,
	edgesAt,
	listOf,
	sentences,
	withStates,
	type Direction
} from '../../client/speech';
import type { Dot } from '../../core/path';
import { t } from '../../i18n/index.svelte';
import {
	CROSS,
	edgeValue,
	LINE,
	type PinwheelAnalysis,
	type PinwheelPuzzle,
	type PinwheelState
} from './rules';

/** What the board shows of the rules: errors in red, finished regions as black holes. */
export interface PinwheelShown {
	errors: boolean;
	blackHoles: boolean;
}

/** Where a circle lies seen from a dot, by its offset in half cells: rows, then columns. */
const AROUND: Direction[][] = [
	['upLeft', 'up', 'upRight'],
	['left', 'here', 'right'],
	['downLeft', 'down', 'downRight']
];

/**
 * What a screen reader says about `dot`: the lines and crosses at it, the border of the board,
 * and the circles on it or next to it, e.g. "Dot in row 2, column 3. Lines: down. Circles: here
 * (locked)".
 */
export function sayDot(
	p: PinwheelPuzzle,
	s: PinwheelState,
	a: PinwheelAnalysis,
	dot: Dot,
	shown: PinwheelShown
): string {
	const onBorder = (e: Edge) =>
		e.kind === 'h' ? e.i === 0 || e.i === p.height : e.j === 0 || e.j === p.width;
	const edges = edgesAt(dot, p.width, p.height);
	const towards = (keep: (e: Edge) => boolean) =>
		edges.filter(({ edge }) => keep(edge)).map(({ dir }) => direction(dir));
	const marked = (mark: number) => (e: Edge) =>
		!onBorder(e) && edgeValue(p, s, e.kind, e.i, e.j) === mark;
	// A dot lies at half-cell coordinates (2i - 1, 2j - 1), like the circles.
	const circles = p.centres
		.map(([hr, hc], k) => ({ k, dr: hr - 2 * dot.i + 1, dc: hc - 2 * dot.j + 1 }))
		.filter(({ dr, dc }) => Math.abs(dr) <= 1 && Math.abs(dc) <= 1)
		.sort((x, y) => x.dr - y.dr || x.dc - y.dc)
		.map(({ k, dr, dc }) => {
			// As on the board: a locked circle shows that it is locked, a black hole that it is done.
			const locked = !!s.locks[k];
			const done = !locked && shown.blackHoles && a.complete[a.centreRegion[k]];
			const error = !locked && !done && shown.errors && a.centreError[k];
			return withStates(direction(AROUND[dr + 1][dc + 1]), [
				locked && t('games.pinwheel.speech.locked'),
				done && t('speech.complete'),
				error && t('speech.error')
			]);
		});
	return sentences([
		dotPlace(dot),
		listOf('speech.lines', towards(marked(LINE))),
		listOf('speech.crosses', towards(marked(CROSS))),
		listOf('games.pinwheel.speech.border', towards(onBorder)),
		listOf('games.pinwheel.speech.circles', circles)
	]);
}
