import { Rng } from '../../core/rng';
import type { Difficulty } from '../../core/variants';
import { bridgesGraph, type BridgesPuzzle } from './rules';
import { BridgesLevel, BridgesSolver } from './solver';

/** Layouts tried per puzzle, each with the same `Rng`: a hard 7×7 takes about 160 on average. */
const ATTEMPTS = 5000;
/** Share of the board's cells that become islands. */
const DENSITY = 0.25;
/** Spanning trees tried on one set of islands before it is given up. */
const TREES = 20;
/** Chance that a link left out of the tree gets a bridge too (where none crosses it). */
const EXTRA = 0.1;
/** Chance that a link with a bridge gets a second one. */
const DOUBLE = 0.35;

export interface GeneratedBridges {
	puzzle: BridgesPuzzle;
	/** The bridges of the solution, per link of the puzzle. */
	solution: number[];
}

/** Steps along a row or column: up, right, down, left. */
const STEPS = [
	[-1, 0],
	[0, 1],
	[1, 0],
	[0, -1]
] as const;

/**
 * Islands at random: the first anywhere, each next one in line with an island already there, two
 * or more cells away over water, and never next to another island. So every island faces another
 * one, and all of them can be joined. One character per cell, `0` for an island.
 */
export function randomIslands(width: number, height: number, rng: Rng): string[] {
	const n = width * height;
	const cells = new Array<string>(n).fill('.');
	const isIsland = (r: number, c: number) =>
		r >= 0 && c >= 0 && r < height && c < width && cells[r * width + c] !== '.';
	const target = Math.max(2, Math.round(n * DENSITY));
	const placed = [rng.int(n)];
	cells[placed[0]] = '0';
	for (let tries = 0; tries < 40 * target && placed.length < target; tries++) {
		const from = rng.pick(placed);
		const [dr, dc] = rng.pick(STEPS);
		const spots: number[] = [];
		let r = Math.floor(from / width) + dr;
		let c = (from % width) + dc;
		for (let away = 1; r >= 0 && c >= 0 && r < height && c < width; away++, r += dr, c += dc) {
			if (cells[r * width + c] !== '.') break;
			const near =
				isIsland(r - 1, c) || isIsland(r + 1, c) || isIsland(r, c - 1) || isIsland(r, c + 1);
			if (away >= 2 && !near) spots.push(r * width + c);
		}
		if (!spots.length) continue;
		const cell = rng.pick(spots);
		cells[cell] = '0';
		placed.push(cell);
	}
	return cells;
}

/**
 * A random solution for a set of islands: a spanning tree of the links whose bridges do not
 * cross (randomized Kruskal), some links more where no bridge crosses them, some of them double.
 * The bridges per link of `bridgesGraph`, or null if no tree came out.
 */
export function randomBridges(islands: string[], width: number, height: number, rng: Rng) {
	const g = bridgesGraph({ width, height, islands: islands.join('') });
	const links = g.ends.length / 2;
	const crossesBridge = (value: number[], l: number) => g.crossing[l].some((m) => value[m] > 0);
	for (let tree = 0; tree < TREES; tree++) {
		const root = g.cells.map((_, i) => i);
		const find = (x: number): number => (root[x] === x ? x : (root[x] = find(root[x])));
		const order = rng.shuffle(Array.from({ length: links }, (_, l) => l));
		const value = new Array<number>(links).fill(0);
		let joined = 1;
		for (const l of order) {
			const a = find(g.ends[2 * l]);
			const b = find(g.ends[2 * l + 1]);
			if (a === b || crossesBridge(value, l)) continue;
			root[a] = b;
			value[l] = 1;
			joined++;
		}
		if (joined < g.cells.length) continue;
		for (const l of order) {
			if (!value[l] && !crossesBridge(value, l) && rng.next() < EXTRA) value[l] = 1;
		}
		for (let l = 0; l < links; l++) if (value[l] && rng.next() < DOUBLE) value[l] = 2;
		return value;
	}
	return null;
}

/** The puzzle of islands with bridges: each island's number is the bridges at it. */
export function puzzleOf(
	width: number,
	height: number,
	islands: string[],
	bridges: readonly number[]
): BridgesPuzzle {
	const g = bridgesGraph({ width, height, islands: islands.join('') });
	const count = g.cells.map(() => 0);
	bridges.forEach((b, l) => {
		count[g.ends[2 * l]] += b;
		count[g.ends[2 * l + 1]] += b;
	});
	const cells = islands.slice();
	g.cells.forEach((cell, i) => (cells[cell] = String(count[i])));
	return { width, height, islands: cells.join('') };
}

/**
 * Whether a rating fits a difficulty: normal puzzles need no more than `Isolation`, hard ones
 * `Connect` or a `Trial`. Either way the techniques decide every link, which proves the solution
 * unique.
 */
export const fitsLevel = (level: BridgesLevel, difficulty: Difficulty) =>
	difficulty === 'hard' ? level >= BridgesLevel.Connect : level <= BridgesLevel.Isolation;

export function fitsBridgesDifficulty(p: BridgesPuzzle, difficulty: Difficulty): boolean {
	const rating = new BridgesSolver(p).rate();
	return !!rating && fitsLevel(rating.level, difficulty);
}

/**
 * A Bridges puzzle with one solution, as hard as `difficulty` says: random islands with a random
 * solution, until the solver's techniques decide one at that level.
 */
export function generateBridges(
	width: number,
	height: number,
	difficulty: Difficulty,
	seed: number
): GeneratedBridges {
	const rng = new Rng(seed);
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const islands = randomIslands(width, height, rng);
		const bridges = randomBridges(islands, width, height, rng);
		if (!bridges) continue;
		const puzzle = puzzleOf(width, height, islands, bridges);
		const solver = new BridgesSolver(puzzle);
		const rating = solver.rate();
		if (rating && fitsLevel(rating.level, difficulty)) {
			return { puzzle, solution: solver.values(rating.known) };
		}
	}
	throw new Error(`generation failed for ${width}x${height} ${difficulty} #${seed}`);
}
