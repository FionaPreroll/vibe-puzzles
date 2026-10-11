import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CHANGELOG.md, as the About page shows it. The file follows "Keep a Changelog": a release per
 * `## [version] - date` heading (or `## [Unreleased]`), newest first; its changes in `###`
 * sections; one change per `- ` item, continued on indented lines. Text before a release's
 * first section is a note on the release. The build reads the file with `readChangelog` and
 * fails on anything else in it, so that the page never shows a garbled list.
 */

/** A piece of a line: plain text, `code` or **strong**. */
export interface Inline {
	text: string;
	code?: true;
	strong?: true;
}

/** The kinds of change a release lists, in this order. */
export const SECTIONS = ['Added', 'Changed', 'Fixed', 'Removed'] as const;
export type SectionTitle = (typeof SECTIONS)[number];

export interface ChangelogSection {
	title: SectionTitle;
	items: Inline[][];
}

export interface ChangelogRelease {
	/** A version such as `0.8.0`, or `Unreleased` for changes not in a version yet. */
	version: string;
	/** `YYYY-MM-DD`, or null for unreleased changes. */
	date: string | null;
	/** Paragraphs before the first section. */
	notes: Inline[][];
	sections: ChangelogSection[];
}

export const UNRELEASED = 'Unreleased';

const RELEASE = /^## \[(Unreleased|\d+\.\d+\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?$/;

/** Splits a line into plain text, `code` and **strong** pieces. */
export function parseInline(line: string): Inline[] {
	const out: Inline[] = [];
	for (const part of line.split(/(`[^`]+`|\*\*[^*]+\*\*)/)) {
		if (!part) continue;
		if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
			out.push({ text: part.slice(1, -1), code: true });
		} else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
			out.push({ text: part.slice(2, -2), strong: true });
		} else out.push({ text: part });
	}
	return out;
}

/** The releases of a changelog, newest first. Throws on a line it does not understand. */
export function parseChangelog(text: string): ChangelogRelease[] {
	const releases: ChangelogRelease[] = [];
	let release: ChangelogRelease | null = null;
	let section: ChangelogSection | null = null;
	/** The item or note paragraph that indented or following lines continue. */
	let open: string[] | null = null;
	const raw: { release: ChangelogRelease; section: ChangelogSection | null; lines: string[] }[] =
		[];
	const fail = (n: number, why: string) => {
		throw new Error(`CHANGELOG.md line ${n + 1}: ${why}`);
	};

	text.split(/\r?\n/).forEach((line, n) => {
		if (!line.trim()) {
			// A blank line ends a note paragraph; an item may go on after one only when indented.
			if (open && !section) open = null;
			return;
		}
		if (line.startsWith('## ')) {
			const m = RELEASE.exec(line.trim());
			if (!m) return fail(n, 'a release heading is `## [x.y.z] - YYYY-MM-DD` or `## [Unreleased]`');
			const [, version, date] = m;
			if ((version === UNRELEASED) !== !date) {
				if (version === UNRELEASED) return fail(n, 'unreleased changes have no date');
				return fail(n, `release ${version} needs a date`);
			}
			if (releases.some((r) => r.version === version)) return fail(n, `${version} twice`);
			release = { version, date: date ?? null, notes: [], sections: [] };
			releases.push(release);
			section = null;
			open = null;
			return;
		}
		if (!release) return; // The title and introduction above the first release.
		if (line.startsWith('### ')) {
			const title = line.slice(4).trim();
			if (!SECTIONS.includes(title as SectionTitle)) {
				return fail(n, `a section is one of ${SECTIONS.join(', ')}`);
			}
			if (release.sections.some((s) => s.title === title)) return fail(n, `${title} twice`);
			section = { title: title as SectionTitle, items: [] };
			release.sections.push(section);
			open = null;
			return;
		}
		if (line.startsWith('#')) return fail(n, 'only `##` releases and `###` sections');
		if (line.startsWith('- ')) {
			if (!section) return fail(n, 'a change belongs in a section (### Added, …)');
			open = [line.slice(2).trim()];
			raw.push({ release, section, lines: open });
			return;
		}
		if (/^\s+\S/.test(line) && open && section) {
			open.push(line.trim());
			return;
		}
		if (section) return fail(n, 'a change starts with `- `, a continued one is indented');
		// A note on the release, before its first section.
		if (!open) {
			open = [];
			raw.push({ release, section: null, lines: open });
		}
		open.push(line.trim());
	});

	for (const { release, section, lines } of raw) {
		const inline = parseInline(lines.join(' '));
		if (section) section.items.push(inline);
		else release.notes.push(inline);
	}
	for (const r of releases) {
		r.sections.sort((a, b) => SECTIONS.indexOf(a.title) - SECTIONS.indexOf(b.title));
	}
	return releases;
}

/** The newest version that is released (not `Unreleased`), or null. */
export function newestVersion(releases: ChangelogRelease[]): string | null {
	return releases.find((r) => r.version !== UNRELEASED)?.version ?? null;
}

/** CHANGELOG.md of the project at `root`. */
export function readChangelog(root: string): ChangelogRelease[] {
	return parseChangelog(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'));
}
