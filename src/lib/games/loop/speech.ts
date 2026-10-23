import type { Edge } from '../../client/edgeInput';
import {
	cellsAt,
	direction,
	dotPlace,
	edgesAt,
	listOf,
	sentences,
	withStates
} from '../../client/speech';
import type { Dot } from '../../core/path';
import { t } from '../../i18n/index.svelte';
import {
	clueAt,
	CROSS,
	hIndex,
	LINE,
	vIndex,
	type LoopAnalysis,
	type LoopPuzzle,
	type LoopState
} from './rules';

/** What the board shows of the rules: errors in red, numbers with all their lines in grey. */
export interface LoopShown {
	errors: boolean;
	dimSatisfied: boolean;
}

/**
 * What a screen reader says about `dot`: the lines and crosses at it, and the numbers in the
 * cells around it, e.g. "Dot in row 2, column 3. Lines: up, right. Numbers: 3 up left".
 */
export function sayDot(
	p: LoopPuzzle,
	s: LoopState,
	a: LoopAnalysis,
	dot: Dot,
	shown: LoopShown
): string {
	const value = (e: Edge) => (e.kind === 'h' ? s.h[hIndex(p, e.i, e.j)] : s.v[vIndex(p, e.i, e.j)]);
	const edges = edgesAt(dot, p.width, p.height);
	const towards = (mark: number) =>
		edges.filter(({ edge }) => value(edge) === mark).map(({ dir }) => direction(dir));
	const numbers = cellsAt(dot, p.width, p.height)
		.filter(({ cell }) => clueAt(p, cell) >= 0)
		.map(({ dir, cell }) => {
			const clue = clueAt(p, cell);
			// As on the board: a number in red is not greyed out.
			const error = shown.errors && a.clueError[cell];
			const done = !error && shown.dimSatisfied && a.count[cell] === clue;
			return withStates(`${clue} ${direction(dir)}`, [
				error && t('speech.error'),
				done && t('speech.complete')
			]);
		});
	const k = dot.i * (p.width + 1) + dot.j;
	return sentences([
		withStates(dotPlace(dot), [shown.errors && a.dotError[k] && t('speech.error')]),
		listOf('speech.lines', towards(LINE)),
		listOf('speech.crosses', towards(CROSS)),
		listOf('games.loop.speech.numbers', numbers)
	]);
}
