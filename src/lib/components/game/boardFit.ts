/**
 * The size of the board's cells: as big as fits the screen without scrolling (the automatic size),
 * times the player's zoom. The game page measures the page around the board (`BoardFit`); the
 * arithmetic is here.
 */

/** Cell size before the page is measured. */
export const DEFAULT_CELL = 36;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 3;

export interface FitInput {
	/** Width of the board area. */
	areaWidth: number;
	viewportHeight: number;
	/** Page offset of the board's top edge, without the board's own surface around it. */
	boardTop: number;
	/** Everything on the page below the board area (see `afterBoard`). */
	afterBoard: number;
	/** Padding of the board's surface on each side. */
	stagePad: number;
	/** The puzzle's grid in cells. */
	width: number;
	height: number;
	/** Board height in cells beyond the grid (e.g. a number pad). */
	padRows?: number;
	/** Coordinates around the grid take room too. */
	showCoordinates?: boolean;
}

/** Largest cell size that shows the whole board without scrolling. */
export function fitCellSize(i: FitInput): number {
	if (!i.areaWidth) return DEFAULT_CELL;
	// The boards' padding in cells: up to 0.2 per side (Pinwheel), more with coordinates.
	const margin = i.showCoordinates ? 1.3 : 0.4;
	// Everything above and below the board (on phones that includes the room kept free for the
	// fixed tool bar).
	const chrome = i.boardTop + 4 + i.afterBoard + 2 * i.stagePad;
	const byWidth = (i.areaWidth - 2 * i.stagePad) / (i.width + margin);
	const byHeight =
		Math.max(240, i.viewportHeight - chrome) / (i.height + margin + (i.padRows ?? 0));
	return Math.max(16, Math.min(96, Math.floor(Math.min(byWidth, byHeight))));
}

/** The cell size at `zoom` (1 = the automatic size). */
export function zoomedCellSize(fit: number, zoom: number): number {
	return Math.max(8, Math.round(fit * zoom));
}

export function clampZoom(zoom: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** A stored zoom, or 1 for anything that is none. */
export function storedZoom(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? clampZoom(value) : 1;
}

/** Cell size of the printed board: about 640 px wide, at most 40 px a cell. */
export function printCellSize(width: number): number {
	return Math.min(40, Math.floor(640 / (width + 1)));
}

/** Where the parts below the board end, as page coordinates (`getBoundingClientRect().bottom`). */
export interface Bottoms {
	body: number;
	boardArea: number;
	/** The page's root, without its bottom padding. */
	rootContent: number;
	/** The game column, which a longer side panel may reach beyond. */
	gameColumn: number;
}

/** Height of everything below the board area up to the page's end, without a longer side panel. */
export function afterBoard(b: Bottoms): number {
	return b.body - b.boardArea - Math.max(0, b.rootContent - b.gameColumn);
}
