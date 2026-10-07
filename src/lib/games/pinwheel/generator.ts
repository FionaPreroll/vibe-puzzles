import { neighbours } from '../../core/grid';
import { Rng } from '../../core/rng';
import type { Difficulty } from '../../core/variants';
import { coveredCells, mirrorCell, type PinwheelPuzzle } from './rules';
import { PinwheelSolver } from './solver';

export interface GeneratedPinwheel {
	puzzle: PinwheelPuzzle;
	/** Centre index of every cell in the unique solution. */
	solution: number[];
}

interface Galaxy {
	centre: [number, number];
	cells: Set<number>;
}

/** Partition the grid into random point-symmetric galaxies. */
function partition(w: number, h: number, rng: Rng): Galaxy[] {
	const n = w * h;
	const owner = new Int32Array(n).fill(-1);
	const galaxies: Galaxy[] = [];
	const p: PinwheelPuzzle = { width: w, height: h, centres: [] };
	const maxSize = Math.max(4, Math.round((w * h) / 6));

	const freeNeighbours = (i: number) => neighbours(i, w, h).filter((j) => owner[j] < 0).length;
	for (;;) {
		// Start at the most enclosed free cell so that few cells end up stranded alone.
		let start = -1;
		let best = Infinity;
		for (let i = 0; i < n; i++) {
			if (owner[i] >= 0) continue;
			const score = freeNeighbours(i) * 0.5 + rng.next() * 2;
			if (score < best) {
				best = score;
				start = i;
			}
		}
		if (start < 0) break;
		const r = Math.floor(start / w);
		const c = start % w;
		// Centre on the cell, an adjacent edge or a corner, if the covered cells are free.
		const options: [number, number][] = [[2 * r, 2 * c]];
		for (const [dr, dc] of [
			[0, 1],
			[1, 0],
			[1, 1],
			[0, -1],
			[-1, 0],
			[-1, -1],
			[1, -1],
			[-1, 1]
		]) {
			const centre: [number, number] = [2 * r + dr, 2 * c + dc];
			if (centre[0] < 0 || centre[1] < 0 || centre[0] > 2 * h - 2 || centre[1] > 2 * w - 2)
				continue;
			if (coveredCells(p, centre).every((i) => owner[i] < 0)) options.push(centre);
		}
		const centre = rng.pick(options);
		const id = galaxies.length;
		const cells = new Set(coveredCells(p, centre));
		cells.forEach((i) => (owner[i] = id));
		const target = 1 + rng.int(maxSize) + rng.int(maxSize);
		while (cells.size < target) {
			const frontier: number[] = [];
			for (const i of cells) {
				for (const j of neighbours(i, w, h)) {
					if (owner[j] >= 0) continue;
					const m = mirrorCell(p, j, centre);
					if (m >= 0 && owner[m] < 0 && m !== j) frontier.push(j);
				}
			}
			if (frontier.length === 0) break;
			const j = rng.pick(frontier);
			const m = mirrorCell(p, j, centre);
			cells.add(j).add(m);
			owner[j] = owner[m] = id;
		}
		galaxies.push({ centre, cells });
	}
	return absorbSingles(p, galaxies, owner, rng);
}

/** Let galaxies grow into single-cell galaxies (in symmetric pairs) to avoid many 1×1 pieces. */
function absorbSingles(p: PinwheelPuzzle, galaxies: Galaxy[], owner: Int32Array, rng: Rng) {
	const { width: w, height: h } = p;
	const single = (i: number) => galaxies[owner[i]].cells.size === 1;
	for (let round = 0; round < 3; round++) {
		for (const id of rng.shuffle(galaxies.map((_, k) => k))) {
			const g = galaxies[id];
			if (g.cells.size === 1) continue;
			for (;;) {
				const options: [number, number][] = [];
				for (const i of g.cells) {
					for (const j of neighbours(i, w, h)) {
						if (owner[j] === id || !single(j)) continue;
						const m = mirrorCell(p, j, g.centre);
						if (m >= 0 && m !== j && owner[m] !== id && single(m)) options.push([j, m]);
					}
				}
				if (options.length === 0 || rng.next() < 0.15) break;
				for (const i of rng.pick(options)) {
					galaxies[owner[i]].cells.clear();
					owner[i] = id;
					g.cells.add(i);
				}
			}
		}
	}
	return galaxies.filter((g) => g.cells.size > 0);
}

function isConnected(cells: Set<number>, w: number, h: number): boolean {
	const first = cells.values().next().value;
	if (first === undefined) return false;
	const seen = new Set([first]);
	const stack = [first];
	while (stack.length) {
		for (const j of neighbours(stack.pop()!, w, h)) {
			if (cells.has(j) && !seen.has(j)) {
				seen.add(j);
				stack.push(j);
			}
		}
	}
	return seen.size === cells.size;
}

const NODE_BUDGET = 3000;

/**
 * Split galaxies until the partition is the only solution: a cell where an alternative solution
 * differs is cut out of its galaxy together with its mirror (which keeps the rest symmetric) and
 * becomes a new galaxy (a domino if the pair touches, otherwise two single cells).
 */
function makeUnique(w: number, h: number, galaxies: Galaxy[], rng: Rng): boolean {
	const p: PinwheelPuzzle = { width: w, height: h, centres: [] };
	for (let iter = 0; iter < w * h; iter++) {
		p.centres = galaxies.map((g) => g.centre);
		const res = new PinwheelSolver(p).solve({ limit: 2, maxNodes: NODE_BUDGET });
		if (!res.finished) return false;
		const owner = new Int32Array(w * h);
		galaxies.forEach((g, k) => g.cells.forEach((i) => (owner[i] = k)));
		const other = res.solutions.find((s) => s.some((k, i) => k !== owner[i]));
		if (!other) return res.solutions.length === 1;

		let split = false;
		for (const i of rng.shuffle(Array.from({ length: w * h }, (_, i) => i))) {
			if (other[i] === owner[i]) continue;
			const g = galaxies[owner[i]];
			const m = mirrorCell(p, i, g.centre);
			if (coveredCells(p, g.centre).includes(i)) continue;
			const rest = new Set(g.cells);
			rest.delete(i);
			rest.delete(m);
			if (!isConnected(rest, w, h)) continue;
			g.cells = rest;
			const [a, b] = [i, m].sort((x, y) => x - y);
			const ra = Math.floor(a / w);
			const ca = a % w;
			const rb = Math.floor(b / w);
			const cb = b % w;
			if (Math.abs(ra - rb) + Math.abs(ca - cb) === 1) {
				galaxies.push({ centre: [ra + rb, ca + cb], cells: new Set([a, b]) });
			} else {
				galaxies.push({ centre: [2 * ra, 2 * ca], cells: new Set([a]) });
				galaxies.push({ centre: [2 * rb, 2 * cb], cells: new Set([b]) });
			}
			split = true;
			break;
		}
		if (!split) return false;
	}
	return false;
}

/**
 * Generate a puzzle with a unique solution; deterministic for a given seed.
 * Normal puzzles can be solved by propagation alone, hard puzzles need case analysis.
 */
export function generatePinwheel(
	width: number,
	height: number,
	difficulty: Difficulty,
	seed: number
): GeneratedPinwheel {
	const rng = new Rng(seed);
	let fallback: GeneratedPinwheel | null = null;
	for (let attempt = 0; attempt < 100; attempt++) {
		const galaxies = partition(width, height, rng);
		if (!makeUnique(width, height, galaxies, rng)) continue;
		// Sort centres in reading order so the puzzle does not reveal how it was built.
		const order = galaxies
			.map((g, k) => ({ g, k }))
			.sort((a, b) => a.g.centre[0] - b.g.centre[0] || a.g.centre[1] - b.g.centre[1]);
		const puzzle: PinwheelPuzzle = { width, height, centres: order.map((o) => o.g.centre) };
		const solution = new Array<number>(width * height);
		order.forEach((o, k) => o.g.cells.forEach((i) => (solution[i] = k)));
		const result = { puzzle, solution };
		const easy = new PinwheelSolver(puzzle).solve({ branch: false }).solutions.length === 1;
		if (easy === (difficulty === 'normal')) return result;
		fallback ??= result;
		if (attempt >= 8) return fallback;
	}
	if (fallback) return fallback;
	throw new Error('generation failed');
}
