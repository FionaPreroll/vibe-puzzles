import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The revision of each type of the puzzle collection, by game and type key. */
export type CollectionRevisions = Record<string, Record<string, string>>;

/**
 * The revision of every type of the collection under `root` (the static folder): a short hash of
 * the names and contents of its files, so it changes with any of them. The build hands it to the
 * app (`__COLLECTION_REVISIONS__`), which asks for each file with its type's revision; the service
 * worker then tells a cached copy of an older collection from the current one.
 */
export function collectionRevisions(root: string): CollectionRevisions {
	const puzzles = join(root, 'puzzles');
	const names = (dir: string, dirs: boolean) =>
		readdirSync(dir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() === dirs)
			.map((entry) => entry.name)
			.sort();
	const revisions: CollectionRevisions = {};
	if (!existsSync(puzzles)) return revisions;
	for (const game of names(puzzles, true)) {
		for (const variant of names(join(puzzles, game), true)) {
			const dir = join(puzzles, game, variant);
			const hash = createHash('sha256');
			for (const file of names(dir, false)) {
				hash
					.update(`${file}\n`)
					.update(readFileSync(join(dir, file)))
					.update('\n');
			}
			(revisions[game] ??= {})[variant] = hash.digest('base64url').slice(0, 8);
		}
	}
	return revisions;
}
