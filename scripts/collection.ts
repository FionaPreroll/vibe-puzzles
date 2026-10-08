import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	chunkPath,
	indexPath,
	layoutType,
	serialize,
	type BankEntry,
	type BankFile,
	type BankIndex
} from '../src/lib/core/bank';
import type { SpecialKind } from '../src/lib/core/variants';

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
