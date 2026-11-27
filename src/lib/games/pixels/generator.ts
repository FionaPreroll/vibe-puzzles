import { Rng } from '../../core/rng';
import type { Difficulty } from '../../core/variants';
import { puzzleOf, type PixelsPuzzle } from './rules';
import { PixelsLevel, PixelsSolver, UNKNOWN, type Known } from './solver';

/** Pictures tried per puzzle, each with the same `Rng`. */
const ATTEMPTS = 200;
/** Cells changed per picture until the techniques decide every cell, before it is given up. */
const CHANGES = 400;
/** Changes tried on a hard picture to leave the lines more cells they cannot decide. */
const HARDEN = 150;

/** How a picture is drawn. */
interface Profile {
	/** Share of filled cells before smoothing. */
	density: number;
	/** Rounds in which a cell takes the value most cells around it have. */
	smooth: number;
}

const NORMAL: Profile = { density: 0.5, smooth: 1 };
const HARD: Profile = { density: 0.52, smooth: 1 };
/** The share of cells that the lines leave open on a hard puzzle, at most. */
const HARD_MAX_OPEN = 0.35;
/** And at least: a hard puzzle needs the probe for more than a corner. */
const HARD_MIN_OPEN = 0.1;

export interface GeneratedPixels {
	puzzle: PixelsPuzzle;
	/** The picture: 1 for a filled cell, 0 for an empty one, row by row. */
	solution: number[];
}

/**
 * A random picture: cells filled at `density`, then `smooth` rounds in which each cell takes the
 * value that most of the cells around it (and itself) have, which joins them into blobs.
 */
export function randomPicture(
	width: number,
	height: number,
	rng: Rng,
	{ density, smooth }: Profile
): Uint8Array {
	let picture = new Uint8Array(width * height);
	for (let c = 0; c < picture.length; c++) picture[c] = rng.next() < density ? 1 : 0;
	for (let round = 0; round < smooth; round++) {
		const next = new Uint8Array(picture.length);
		for (let r = 0; r < height; r++) {
			for (let c = 0; c < width; c++) {
				let filled = 0;
				let around = 0;
				for (let dr = -1; dr <= 1; dr++) {
					for (let dc = -1; dc <= 1; dc++) {
						const rr = r + dr;
						const cc = c + dc;
						if (rr < 0 || cc < 0 || rr >= height || cc >= width) continue;
						around++;
						filled += picture[rr * width + cc];
					}
				}
				const cell = r * width + c;
				next[cell] = 2 * filled === around ? picture[cell] : 2 * filled > around ? 1 : 0;
			}
		}
		picture = next;
	}
	return picture;
}

/**
 * What the techniques up to `level` leave known of a picture's puzzle, and how many cells are
 * open: after the lines alone (`lineOpen`) and at the level (`open`). `probeIf` can leave the
 * probe out after the lines (`open` is then theirs).
 */
export function rate(
	width: number,
	height: number,
	picture: Uint8Array,
	level: PixelsLevel,
	probeIf: (lineOpen: number) => boolean = () => true
) {
	const solver = new PixelsSolver(puzzleOf(width, height, picture));
	const known = solver.start();
	solver.propagate(known);
	const lineOpen = PixelsSolver.open(known);
	if (level === PixelsLevel.Probe && lineOpen && probeIf(lineOpen)) solver.probe(known);
	return { known, lineOpen, open: PixelsSolver.open(known) };
}

/**
 * Change cells of `picture` where the techniques up to `level` get stuck, until they decide
 * every cell: a cell they leave open flips, and the flip stays if it leaves them no more cells
 * open. True once they decide all of them (the solution is then unique).
 */
export function makeDecided(
	width: number,
	height: number,
	picture: Uint8Array,
	level: PixelsLevel,
	rng: Rng
): boolean {
	let rated = rate(width, height, picture, level);
	for (let change = 0; change < CHANGES && rated.open; change++) {
		const cell = rng.pick(openCells(rated.known));
		picture[cell] ^= 1;
		const next = rate(width, height, picture, level);
		if (next.open <= rated.open) rated = next;
		else picture[cell] ^= 1;
	}
	return rated.open === 0;
}

function openCells(known: Known): number[] {
	const out: number[] = [];
	for (let c = 0; c < known.length; c++) if (known[c] === UNKNOWN) out.push(c);
	return out;
}

/**
 * Harden a picture that the probe decides: cells anywhere flip, and a flip stays if the probe
 * still decides every cell and the lines leave at least as many open as before, up to
 * `HARD_MAX_OPEN`. The share the lines leave open in the end.
 */
export function harden(width: number, height: number, picture: Uint8Array, rng: Rng): number {
	const cells = width * height;
	let open = rate(width, height, picture, PixelsLevel.Probe).lineOpen;
	for (let change = 0; change < HARDEN; change++) {
		const cell = rng.int(cells);
		picture[cell] ^= 1;
		// The lines first: the probe only where they leave the right share open.
		const fits = (lines: number) => lines >= open && lines <= HARD_MAX_OPEN * cells;
		const next = rate(width, height, picture, PixelsLevel.Probe, fits);
		if (fits(next.lineOpen) && !next.open) open = next.lineOpen;
		else picture[cell] ^= 1;
	}
	return open / cells;
}

/**
 * A Pixels puzzle with one solution: a random picture, changed where the techniques get stuck
 * until they decide every cell. Normal puzzles are decided by the lines alone; hard ones need
 * the probe, for a fair part of the board.
 */
export function generatePixels(
	width: number,
	height: number,
	difficulty: Difficulty,
	seed: number
): GeneratedPixels {
	const rng = new Rng(seed);
	const hard = difficulty === 'hard';
	const level = hard ? PixelsLevel.Probe : PixelsLevel.Line;
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const picture = randomPicture(width, height, rng, hard ? HARD : NORMAL);
		const decided = makeDecided(width, height, picture, level, rng);
		if (decided && (!hard || harden(width, height, picture, rng) >= HARD_MIN_OPEN)) {
			return { puzzle: puzzleOf(width, height, picture), solution: Array.from(picture) };
		}
	}
	throw new Error(`generation failed for ${width}x${height} ${difficulty} #${seed}`);
}

/** Whether a puzzle is decided at its level: by the lines alone (normal), or only with the probe. */
export function fitsPixelsDifficulty(p: PixelsPuzzle, difficulty: Difficulty): boolean {
	const solver = new PixelsSolver(p);
	const known = solver.start();
	if (!solver.propagate(known)) return false;
	if (PixelsSolver.done(known)) return difficulty !== 'hard';
	return difficulty === 'hard' && solver.probe(known) && PixelsSolver.done(known);
}
