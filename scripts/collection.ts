import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	chunkPath,
	indexPath,
	layoutType,
	MAX_PER_TYPE,
	serialize,
	sizesOf,
	sizesPath,
	type BankEntry,
	type BankFile,
	type BankIndex,
	type BankSizes
} from '../src/lib/core/bank';
import type { GameLogic } from '../src/lib/core/types';
import { decodePuzzleId, type SpecialKind, type Variant } from '../src/lib/core/variants';

/** Folder of a type's collection files under `root` (the static folder). */
export const typeDir = (root: string, game: string, variant: string) =>
	join(root, 'puzzles', game, variant);

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8'));

/**
 * All puzzles of a type, in the order they were added (regular types) or of their periods
 * (special types, `kind`). Empty if the type has no files yet.
 */
export function readType(
	root: string,
	game: string,
	variant: string,
	kind?: SpecialKind
): BankEntry[] {
	const dir = typeDir(root, game, variant);
	if (!existsSync(dir)) return [];
	if (kind) {
		return readdirSync(dir)
			.filter((f) => f.endsWith('.json'))
			.sort()
			.flatMap((f) => readJson<BankFile>(join(dir, f)).puzzles);
	}
	const index = join(root, indexPath(game, variant));
	if (!existsSync(index)) return [];
	return readJson<BankIndex>(index).chunks.flatMap(
		(_, chunk) => readJson<BankFile>(join(root, chunkPath(game, variant, chunk))).puzzles
	);
}

/**
 * Writes the files of a type (see layoutType) and removes files of the type that are no longer
 * part of it. Unchanged files are written byte for byte the same, so git sees no change.
 */
export function writeType(
	root: string,
	game: string,
	variant: string,
	entries: BankEntry[],
	kind?: SpecialKind
) {
	const files = layoutType(game, variant, entries, kind);
	const dir = typeDir(root, game, variant);
	mkdirSync(dir, { recursive: true });
	for (const [path, file] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), serialize(file));
	}
	const kept = new Set(Object.keys(files).map((path) => join(root, path)));
	for (const f of readdirSync(dir)) {
		if (!kept.has(join(dir, f))) rmSync(join(dir, f));
	}
}

/** The sizes of the regular types of these games, from their index files under `root`. */
export function collectionSizes(root: string, logics: GameLogic[]): BankSizes {
	const indexes = logics.flatMap((logic) =>
		logic.variants
			.filter((v) => !v.special && existsSync(join(root, indexPath(logic.id, v.key))))
			.map((v) => readJson<BankIndex>(join(root, indexPath(logic.id, v.key))))
	);
	return sizesOf(indexes);
}

/** Text of `puzzles/sizes.json`: one game per line. */
export function serializeSizes(sizes: BankSizes): string {
	const lines = Object.entries(sizes).map(
		([game, types]) => `\t${JSON.stringify(game)}: ${JSON.stringify(types)}`
	);
	return `{\n${lines.join(',\n')}\n}\n`;
}

/** Writes `puzzles/sizes.json` under `root` for the regular types of these games. */
export function writeSizes(root: string, logics: GameLogic[]) {
	writeFileSync(join(root, sizesPath), serializeSizes(collectionSizes(root, logics)));
}

/** A regular type being grown: its puzzles so far and how many of them are new. */
export interface Growing {
	puzzles: unknown[];
	added: number;
}

/**
 * Grows regular types in turns, one puzzle each (`addOne` tries a new seed and may skip it), so a
 * time limit (`more`) still leaves every type with new puzzles. A type stops at `perType` new
 * puzzles or at MAX_PER_TYPE in all; its turns go to the types below.
 */
export function growInTurns<T extends Growing>(
	types: T[],
	perType: number,
	addOne: (type: T) => void,
	more: () => boolean
) {
	const room = (t: T) => t.added < perType && t.puzzles.length < MAX_PER_TYPE;
	let growing = types.filter(room);
	while (growing.length && more()) {
		for (const type of growing) {
			if (!more()) break;
			addOne(type);
		}
		growing = growing.filter(room);
	}
}

/**
 * The first special periods whose stored puzzle must fit its type's difficulty. Earlier ones were
 * stored before the generators were fixed (issue #84) and may have been played already, so they
 * keep their puzzle even where its difficulty is off: replacing it would change the puzzle behind
 * an ID that players have solved. With that fix, the week and the month in progress were
 * generated again on purpose; the dailies from the next day on.
 */
export const DIFFICULTY_CHECKED_FROM: Record<SpecialKind, string> = {
	daily: '2026-10-10',
	weekly: '2026-W41',
	monthly: '2026-10'
};

/** Whether a stored puzzle must fit its type's difficulty (see DIFFICULTY_CHECKED_FROM). */
export const checksDifficulty = (kind?: SpecialKind, period?: string) =>
	!kind || (period ?? '') >= DIFFICULTY_CHECKED_FROM[kind];

/**
 * The puzzle of an ID if it belongs in the collection: it has a unique solution and fits its
 * type's difficulty. Otherwise the reason it does not.
 */
export function checkedPuzzle(
	logic: GameLogic,
	variant: Variant,
	id: number
): { puzzle: unknown } | { reason: string } {
	const puzzle = logic.generate(variant, decodePuzzleId(id).seed);
	const check = logic.countSolutions(puzzle, 2);
	if (!check.finished || check.count !== 1) return { reason: 'not uniquely solvable' };
	if (!logic.fitsDifficulty(puzzle, variant)) return { reason: `not ${variant.difficulty}` };
	return { puzzle };
}

/** Changes that can make stored puzzles invalid: the game logic and the shared core. */
const LOGIC = /^src\/lib\/(games|core)\//;

/**
 * Which collection files need their puzzles checked again (validity, one solution), given the
 * paths a change touches; null (no list) means all of them. A change to the game logic can
 * invalidate any stored puzzle, so it checks everything; otherwise only the collection files
 * the change adds or edits. Paths are relative to the repository, e.g. `static/puzzles/...`.
 */
export function filesToCheck(changed: string[] | null): (path: string) => boolean {
	if (!changed || changed.some((path) => LOGIC.test(path))) return () => true;
	const touched = new Set(changed);
	return (path) => touched.has(path);
}
