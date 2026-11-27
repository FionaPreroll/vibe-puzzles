import { Rng } from '../../core/rng';
import type { Difficulty } from '../../core/variants';
import { bridgesGraph, type BridgesGraph, type BridgesPuzzle } from './rules';
import { BridgesLevel, BridgesSolver } from './solver';

/**
 * Boards this wide and wider grow their islands along their bridges and then change bridges
 * until the solver decides every link (`grownBridges`). Smaller ones (7×7) draw whole layouts
 * until one fits (`drawnBridges`): that was the first generator, and puzzle IDs keep it.
 */
const GROWN_FROM = 10;

/** Layouts tried per puzzle, each with the same `Rng`: a hard 7×7 takes about 160 on average. */
const ATTEMPTS = 5000;
/** Grown layouts tried per puzzle: a hard 10×10 takes about 30. */
const GROWN_ATTEMPTS = 2000;
/** Changed bridges per grown layout before it is given up. */
const CHANGES = 300;
/** Changes tried on a unique hard puzzle to leave `Isolation` more links it cannot decide. */
const HARDEN = 100;
/** Share of the board's cells that become islands. */
const DENSITY = 0.25;
/** Spanning trees tried on one set of islands before it is given up. */
const TREES = 20;
/** Chance that a link left out of the tree gets a bridge too (where none crosses it). */
const EXTRA = 0.1;
/** Chance that a link with a bridge gets a second one. */
const DOUBLE = 0.35;

/**
 * Grown layouts: hard boards have more islands, more links with a bridge beyond the tree, and
 * fewer with a second one.
 */
const NORMAL = { density: DENSITY, extra: EXTRA, double: DOUBLE };
const HARD = { density: 0.3, extra: 0.3, double: 0.2 };

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
 * A Bridges puzzle with one solution, as hard as `difficulty` says (see `drawnBridges` and
 * `grownBridges`).
 */
export function generateBridges(
	width: number,
	height: number,
	difficulty: Difficulty,
	seed: number
): GeneratedBridges {
	const rng = new Rng(seed);
	const made =
		width < GROWN_FROM
			? drawnBridges(width, height, difficulty, rng)
			: grownBridges(width, height, difficulty, rng);
	if (made) return made;
	throw new Error(`generation failed for ${width}x${height} ${difficulty} #${seed}`);
}

/** Random islands with a random solution, until the solver's techniques decide one at that level. */
function drawnBridges(
	width: number,
	height: number,
	difficulty: Difficulty,
	rng: Rng
): GeneratedBridges | null {
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
	return null;
}

/**
 * Islands that grow along their bridges: the first anywhere, each next one two or more cells
 * away from an island already there, over water that no bridge crosses, never next to another
 * island, with a bridge to it (two at `double`). Then a bridge on some links more (`extra`)
 * where none crosses them. The islands, one character per cell (`0` for an island), with their
 * graph and the bridges per link.
 */
export function grownLayout(
	width: number,
	height: number,
	rng: Rng,
	{ density, extra, double }: { density: number; extra: number; double: number }
): { islands: string[]; g: BridgesGraph; bridges: number[] } {
	const n = width * height;
	const cells = new Array<string>(n).fill('.');
	/** Cells that a bridge crosses. */
	const spanned = new Uint8Array(n);
	const isIsland = (r: number, c: number) =>
		r >= 0 && c >= 0 && r < height && c < width && cells[r * width + c] !== '.';
	const target = Math.max(2, Math.round(n * density));
	const placed = [rng.int(n)];
	cells[placed[0]] = '0';
	const built: [number, number, number][] = [];
	for (let tries = 0; tries < 60 * target && placed.length < target; tries++) {
		const from = rng.pick(placed);
		const [dr, dc] = rng.pick(STEPS);
		const spots: number[] = [];
		let r = Math.floor(from / width) + dr;
		let c = (from % width) + dc;
		for (let away = 1; r >= 0 && c >= 0 && r < height && c < width; away++, r += dr, c += dc) {
			if (cells[r * width + c] !== '.' || spanned[r * width + c]) break;
			const near =
				isIsland(r - 1, c) || isIsland(r + 1, c) || isIsland(r, c - 1) || isIsland(r, c + 1);
			if (away >= 2 && !near) spots.push(r * width + c);
		}
		if (!spots.length) continue;
		const cell = rng.pick(spots);
		const step = dr * width + dc;
		for (let x = from + step; x !== cell; x += step) spanned[x] = 1;
		cells[cell] = '0';
		placed.push(cell);
		built.push([Math.min(from, cell), Math.max(from, cell), rng.next() < double ? 2 : 1]);
	}
	const g = bridgesGraph({ width, height, islands: cells.join('') });
	const links = g.ends.length / 2;
	const linkOf = new Map<number, number>();
	for (let l = 0; l < links; l++)
		linkOf.set(g.cells[g.ends[2 * l]] * n + g.cells[g.ends[2 * l + 1]], l);
	const bridges = new Array<number>(links).fill(0);
	// No island lies on a bridge built before it, so each bridge is still one link.
	for (const [a, b, value] of built) bridges[linkOf.get(a * n + b)!] = value;
	for (const l of rng.shuffle(Array.from({ length: links }, (_, l) => l))) {
		if (bridges[l] || g.crossing[l].some((m) => bridges[m] > 0) || rng.next() >= extra) continue;
		bridges[l] = rng.next() < double ? 2 : 1;
	}
	return { islands: cells, g, bridges };
}

/** The links that `level`'s techniques leave undecided on the puzzle of `bridges`. */
function undecided(
	width: number,
	height: number,
	islands: string[],
	bridges: readonly number[],
	level: BridgesLevel
): number[] {
	const solver = new BridgesSolver(puzzleOf(width, height, islands, bridges));
	const k = solver.start();
	// The bridges are a solution, so the techniques never break a rule.
	solver.propagate(k, level);
	return Array.from({ length: solver.links }, (_, l) => l).filter((l) => k[2 * l] !== k[2 * l + 1]);
}

/**
 * The other bridges link `l` can take in a solution: up to two; a bridge only where none
 * crosses it, and none only where the others still join all islands.
 */
export function otherValues(g: BridgesGraph, bridges: readonly number[], l: number): number[] {
	const out: number[] = [];
	for (const value of [0, 1, 2]) {
		if (value === bridges[l]) continue;
		if (value && g.crossing[l].some((m) => bridges[m] > 0)) continue;
		if (!value && !joinedWithout(g, bridges, l)) continue;
		out.push(value);
	}
	return out;
}

/** Whether the bridges join all islands without those of link `l`. */
function joinedWithout(g: BridgesGraph, bridges: readonly number[], l: number): boolean {
	const root = g.cells.map((_, i) => i);
	const find = (x: number): number => (root[x] === x ? x : (root[x] = find(root[x])));
	let groups = g.cells.length;
	bridges.forEach((value, m) => {
		if (!value || m === l) return;
		const [a, b] = [find(g.ends[2 * m]), find(g.ends[2 * m + 1])];
		if (a === b) return;
		root[a] = b;
		groups--;
	});
	return groups === 1;
}

/**
 * Islands grown with their bridges (`grownLayout`), then the bridges change where the solver
 * gets stuck: a link it leaves open takes another number of bridges (and the islands at its
 * ends other numbers), as long as that leaves it no more links open. Once the techniques of
 * `Isolation` (normal) or `Connect` (hard) decide every link, the solution is unique. A hard
 * puzzle must leave `Isolation` links open, and then changes more bridges at random (`HARDEN`
 * times): each change that keeps it decided by `Connect` and leaves `Isolation` at least as many
 * links open stays.
 */
function grownBridges(
	width: number,
	height: number,
	difficulty: Difficulty,
	rng: Rng
): GeneratedBridges | null {
	const hard = difficulty === 'hard';
	const level = hard ? BridgesLevel.Connect : BridgesLevel.Isolation;
	for (let attempt = 0; attempt < GROWN_ATTEMPTS; attempt++) {
		const { islands, g, bridges } = grownLayout(width, height, rng, hard ? HARD : NORMAL);
		const open = (at: BridgesLevel) => undecided(width, height, islands, bridges, at).length;
		/** Changes link `l` at random and keeps the change if `keep` says so. */
		const tryChange = (l: number, keep: () => boolean) => {
			const values = otherValues(g, bridges, l);
			if (!values.length) return;
			const before = bridges[l];
			bridges[l] = rng.pick(values);
			if (!keep()) bridges[l] = before;
		};
		let left = undecided(width, height, islands, bridges, level);
		for (let change = 0; change < CHANGES && left.length; change++) {
			tryChange(rng.pick(left), () => {
				const next = undecided(width, height, islands, bridges, level);
				if (next.length > left.length) return false;
				left = next;
				return true;
			});
		}
		if (left.length) continue;
		if (hard) {
			let isolated = open(BridgesLevel.Isolation);
			if (!isolated) continue;
			for (let change = 0; change < HARDEN; change++) {
				tryChange(rng.int(bridges.length), () => {
					if (open(BridgesLevel.Connect)) return false;
					const next = open(BridgesLevel.Isolation);
					if (next < isolated) return false;
					isolated = next;
					return true;
				});
			}
		}
		return { puzzle: puzzleOf(width, height, islands, bridges), solution: bridges };
	}
	return null;
}
