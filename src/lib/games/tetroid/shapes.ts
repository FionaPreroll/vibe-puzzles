export type TetType = 'L' | 'I' | 'T' | 'S';
export const TET_TYPES: readonly TetType[] = ['L', 'I', 'T', 'S'];

/** A fixed placement shape: cell offsets [row, col], normalised to start at (0, 0). */
export interface Shape {
	type: TetType;
	cells: [number, number][];
}

const BASE: Record<TetType, [number, number][]> = {
	I: [
		[0, 0],
		[1, 0],
		[2, 0],
		[3, 0]
	],
	L: [
		[0, 0],
		[1, 0],
		[2, 0],
		[2, 1]
	],
	T: [
		[0, 0],
		[0, 1],
		[0, 2],
		[1, 1]
	],
	S: [
		[0, 1],
		[0, 2],
		[1, 0],
		[1, 1]
	]
};

function normalise(cells: [number, number][]): [number, number][] {
	const minR = Math.min(...cells.map((c) => c[0]));
	const minC = Math.min(...cells.map((c) => c[1]));
	return cells
		.map(([r, c]) => [r - minR, c - minC] as [number, number])
		.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const keyOf = (cells: [number, number][]) => cells.map(([r, c]) => `${r},${c}`).join(';');

function buildShapes(): Shape[] {
	const shapes: Shape[] = [];
	const seen = new Set<string>();
	for (const type of TET_TYPES) {
		let cells = BASE[type];
		for (let flip = 0; flip < 2; flip++) {
			for (let rot = 0; rot < 4; rot++) {
				const norm = normalise(cells);
				const key = keyOf(norm);
				if (!seen.has(key)) {
					seen.add(key);
					shapes.push({ type, cells: norm });
				}
				cells = cells.map(([r, c]) => [c, -r]);
			}
			cells = cells.map(([r, c]) => [r, -c]);
		}
	}
	return shapes;
}

/** All 18 fixed placements of L, I, T and S (rotations and reflections). */
export const SHAPES: readonly Shape[] = buildShapes();

const TYPE_BY_KEY = new Map(SHAPES.map((s) => [keyOf(s.cells), s.type]));

/** Type of four cells (indices in a grid of width `w`), or null if they are not an L/I/T/S. */
export function classify(cells: readonly number[], w: number): TetType | null {
	if (cells.length !== 4) return null;
	return TYPE_BY_KEY.get(keyOf(normalise(cells.map((i) => [Math.floor(i / w), i % w])))) ?? null;
}
