import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectionRevisions } from './revisions';

let root = '';

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = '';
});

/** Writes a collection file under `root`. */
function put(path: string, text: string) {
	const file = join(root, 'puzzles', path);
	mkdirSync(join(file, '..'), { recursive: true });
	writeFileSync(file, text);
}

describe('collection revisions', () => {
	it('gives every type of every game a short revision, the same for the same files', () => {
		root = mkdtempSync(join(tmpdir(), 'revisions-'));
		expect(collectionRevisions(root)).toEqual({});
		put('sizes.json', '{}');
		put('g/5n/0000.json', 'a');
		put('g/5n/index.json', 'i');
		put('g/daily/2026-11.json', 'd');
		put('h/5n/0000.json', 'a');
		const revisions = collectionRevisions(root);
		expect(Object.keys(revisions)).toEqual(['g', 'h']);
		expect(Object.keys(revisions.g)).toEqual(['5n', 'daily']);
		for (const revision of [revisions.g['5n'], revisions.g.daily, revisions.h['5n']]) {
			expect(revision).toMatch(/^[\w-]{8}$/);
		}
		expect(revisions.g['5n']).not.toBe(revisions.h['5n']);
		expect(collectionRevisions(root)).toEqual(revisions);
	});

	it('changes the revision of a type when one of its files changes, is added or renamed', () => {
		root = mkdtempSync(join(tmpdir(), 'revisions-'));
		put('g/5n/0000.json', 'a');
		put('g/10n/0000.json', 'b');
		const other = collectionRevisions(root).g['10n'];
		const seen = new Set<string>();
		const step = (change: () => void) => {
			change();
			const revisions = collectionRevisions(root);
			seen.add(revisions.g['5n']);
			// The other type keeps its revision.
			expect(revisions.g['10n']).toBe(other);
		};
		step(() => undefined);
		step(() => put('g/5n/0000.json', 'c'));
		step(() => put('g/5n/0001.json', 'd'));
		step(() =>
			renameSync(join(root, 'puzzles/g/5n/0001.json'), join(root, 'puzzles/g/5n/0002.json'))
		);
		expect(seen.size).toBe(4);
	});
});
