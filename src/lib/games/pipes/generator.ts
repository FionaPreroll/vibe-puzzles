import { Rng } from '../../core/rng';
import { isSolvedTiles, neighbourTable, openings, sourceOf, turn, type PipesPuzzle } from './rules';
import { PipesSolver, sidesMaybe, sidesOpen } from './solver';

/** New spanning trees before giving up (never needed in practice). */
const TREES = 100;
/** Changes to one tree before starting over with another. */
const PERTURBATIONS = 50;

export interface GeneratedPipes {
	puzzle: PipesPuzzle;
	/** The tiles as they lie in the solution. */
	solution: number[];
}

/**
 * A random spanning tree of the board, as the openings of each tile: randomized Prim from the
 * source, which adds a random pipe from the tree to a tile outside it at every step. No tile gets
 * a pipe on all four sides (it would look the same in every turn). Null if a tile cannot be
 * reached any more because its neighbours in the tree are all full.
 */
export function randomTree(
	width: number,
	height: number,
	nb: Int32Array,
	rng: Rng
): number[] | null {
	const n = width * height;
	const tiles = new Array<number>(n).fill(0);
	const inTree = new Uint8Array(n);
	const frontier: number[] = [];
	const grow = (c: number) => {
		inTree[c] = 1;
		for (let k = 0; k < 4; k++) {
			const m = nb[c * 4 + k];
			if (m >= 0 && !inTree[m]) frontier.push(c * 4 + k);
		}
	};
	grow(sourceOf({ width, height }));
	let size = 1;
	while (frontier.length) {
		const i = rng.int(frontier.length);
		const edge = frontier[i];
		frontier[i] = frontier[frontier.length - 1];
		frontier.pop();
		const c = edge >> 2;
		const k = edge & 3;
		const m = nb[edge];
		if (inTree[m] || openings(tiles[c]) >= 3) continue;
		tiles[c] |= 1 << k;
		tiles[m] |= 1 << ((k + 2) % 4);
		size++;
		grow(m);
	}
	return size === n ? tiles : null;
}

/** The pipes of the tree on the way from tile `a` to tile `b`, as `cell * 4 + side`. */
function treePath(tiles: readonly number[], nb: Int32Array, a: number, b: number): number[] {
	const via = new Int32Array(tiles.length).fill(-1);
	via[a] = a * 4;
	const queue = [a];
	for (let q = 0; q < queue.length && via[b] < 0; q++) {
		const c = queue[q];
		for (let k = 0; k < 4; k++) {
			if (!(tiles[c] & (1 << k))) continue;
			const m = nb[c * 4 + k];
			if (via[m] >= 0) continue;
			via[m] = c * 4 + k;
			queue.push(m);
		}
	}
	const path: number[] = [];
	for (let c = b; c !== a; c = via[c] >> 2) path.push(via[c]);
	return path;
}

/**
 * Changes the tree where the solver got stuck: a pipe it could not rule out (between tiles in
 * `opts` that are not decided) joins the tree, and another pipe of the loop that makes leaves it,
 * so the tree stays a tree and no tile gets four pipes. False if no such change exists.
 */
function perturb(tiles: number[], opts: Uint16Array, nb: Int32Array, rng: Rng): boolean {
	const open: number[] = [];
	for (let c = 0; c < tiles.length; c++) {
		for (let k = 0; k < 2; k++) {
			const side = 1 << k;
			if (tiles[c] & side || nb[c * 4 + k] < 0) continue;
			if (sidesMaybe(opts[c]) & side && !(sidesOpen(opts[c]) & side)) open.push(c * 4 + k);
		}
	}
	rng.shuffle(open);
	const undecided = (edge: number) => {
		const c = edge >> 2;
		const side = 1 << (edge & 3);
		return !(sidesOpen(opts[c]) & side);
	};
	for (const edge of open) {
		const a = edge >> 2;
		const k = edge & 3;
		const b = nb[edge];
		const path = treePath(tiles, nb, a, b);
		const fits = (e: number) => {
			const ends = [e >> 2, nb[e]];
			return [a, b].every((x) => openings(tiles[x]) < 3 || ends.includes(x));
		};
		const choices = path.filter(fits);
		if (!choices.length) continue;
		// Rather a pipe the solver was not sure of either, inside the part it could not settle.
		const unsure = choices.filter(undecided);
		const out = rng.pick(unsure.length ? unsure : choices);
		tiles[out >> 2] &= ~(1 << (out & 3));
		tiles[nb[out]] &= ~(1 << (((out & 3) + 2) % 4));
		tiles[a] |= 1 << k;
		tiles[b] |= 1 << ((k + 2) % 4);
		return true;
	}
	return false;
}

/**
 * A Pipes puzzle with one solution that the solver's techniques find without trying anything:
 * a random spanning tree of the board, changed where the solver gets stuck until it no longer
 * does, then every tile turned at random.
 */
export function generatePipes(
	width: number,
	height: number,
	wrap: boolean,
	seed: number
): GeneratedPipes {
	const rng = new Rng(seed);
	const shape = { width, height, wrap };
	const nb = neighbourTable(shape);
	for (let attempt = 0; attempt < TREES; attempt++) {
		const tiles = randomTree(width, height, nb, rng);
		if (!tiles) continue;
		for (let round = 0; round <= PERTURBATIONS; round++) {
			const tree: PipesPuzzle = { ...shape, tiles: hex(tiles) };
			const solver = new PipesSolver(tree);
			const opts = solver.start();
			const ok = solver.propagate(opts);
			if (ok && opts.every((set) => !(set & (set - 1)))) {
				return { puzzle: { ...shape, tiles: hex(deal(tree, tiles, rng)) }, solution: tiles };
			}
			if (!ok || round === PERTURBATIONS || !perturb(tiles, opts, nb, rng)) break;
		}
	}
	throw new Error(`generation failed for ${width}x${height}${wrap ? ' wrap' : ''} #${seed}`);
}

/** Every tile turned at random, so that the puzzle does not start solved. */
function deal(tree: PipesPuzzle, tiles: number[], rng: Rng): number[] {
	for (;;) {
		const out = tiles.map((t) => turn(t, rng.int(4)));
		if (!isSolvedTiles(tree, out)) return out;
	}
}

const hex = (tiles: readonly number[]) => tiles.map((t) => t.toString(16)).join('');
