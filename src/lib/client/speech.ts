import type { Edge } from './edgeInput';
import type { Dot } from '../core/path';
import { t } from '../i18n/index.svelte';

/**
 * What a screen reader says about the place of the keyboard cursor: each board describes the
 * cell or dot under it (`games/<game>/speech.ts`), and its `BoardSpeech` reads that out whenever
 * it changes. These are the words the boards share.
 */

/** A direction from a dot: towards one of its edges, or one of the cells around it. */
export type Direction =
	'upLeft' | 'up' | 'upRight' | 'left' | 'here' | 'right' | 'downLeft' | 'down' | 'downRight';

/** "Row 3, column 4" for the cell in row `row` and column `col`, both counted from 0. */
export const cellPlace = (row: number, col: number) =>
	t('speech.cell', { row: row + 1, col: col + 1 });

/** "Dot in row 2, column 3", counted from 1 at the top left like the cells. */
export const dotPlace = (dot: Dot) => t('speech.dot', { row: dot.i + 1, col: dot.j + 1 });

/** The name of a direction, e.g. "up left". */
export const direction = (dir: Direction) => t(`speech.${dir}`);

/** `text` with what else holds there in brackets, e.g. "5 (given, error)"; false ones are left out. */
export function withStates(text: string, states: (string | false)[]): string {
	const shown = states.filter((s) => s !== false);
	return shown.length ? `${text} (${shown.join(', ')})` : text;
}

/** A labelled list such as "Lines: up, right"; null without items. */
export function listOf(key: string, items: string[]): string | null {
	return items.length ? t(key, { list: items.join(', ') }) : null;
}

/** The parts of a description that are there, as sentences. */
export const sentences = (parts: (string | null)[]) => parts.filter((p) => p !== null).join('. ');

/** The edges at a dot of a board `width`×`height` cells, clockwise from the top. */
export function edgesAt(dot: Dot, width: number, height: number): { dir: Direction; edge: Edge }[] {
	const { i, j } = dot;
	const out: { dir: Direction; edge: Edge }[] = [];
	if (i > 0) out.push({ dir: 'up', edge: { kind: 'v', i: i - 1, j } });
	if (j < width) out.push({ dir: 'right', edge: { kind: 'h', i, j } });
	if (i < height) out.push({ dir: 'down', edge: { kind: 'v', i, j } });
	if (j > 0) out.push({ dir: 'left', edge: { kind: 'h', i, j: j - 1 } });
	return out;
}

/** The cells around a dot of a board `width` cells wide and `height` high, in reading order. */
export function cellsAt(
	dot: Dot,
	width: number,
	height: number
): { dir: Direction; cell: number }[] {
	const out: { dir: Direction; cell: number }[] = [];
	for (const [dir, r, c] of [
		['upLeft', dot.i - 1, dot.j - 1],
		['upRight', dot.i - 1, dot.j],
		['downLeft', dot.i, dot.j - 1],
		['downRight', dot.i, dot.j]
	] as const) {
		if (r >= 0 && r < height && c >= 0 && c < width) out.push({ dir, cell: r * width + c });
	}
	return out;
}
