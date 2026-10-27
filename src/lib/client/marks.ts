/**
 * The marks a click sets in Tetroid, Pinwheel and Loop: each stores a cell or an edge as empty,
 * marked (shaded, or a line) or crossed, with these numbers.
 */
export const EMPTY = 0;
export const MARK = 1;
export const CROSS = 2;

/** `mark`, or empty where it is already. */
const toggle = (current: number, mark: number) => (current === mark ? EMPTY : mark);

/**
 * The mark a click with `tool` leaves where `current` is; `inverse` for the right button (or
 * Ctrl). The mark tool sets or takes away its mark and the right button a cross; the cross tool
 * the other way round. The cycle tool goes from empty to mark to cross, backwards with the right
 * button. The blank tool empties.
 */
export function nextMark(tool: string, current: number, inverse: boolean): number {
	switch (tool) {
		case 'rotate':
			return inverse ? [CROSS, EMPTY, MARK][current] : [MARK, CROSS, EMPTY][current];
		case 'cross':
			return toggle(current, inverse ? MARK : CROSS);
		case 'blank':
			return EMPTY;
		default:
			return toggle(current, inverse ? CROSS : MARK);
	}
}
