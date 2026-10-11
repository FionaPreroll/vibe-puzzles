import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	newestVersion,
	parseChangelog,
	parseInline,
	readChangelog,
	SECTIONS,
	UNRELEASED
} from './changelog';

const SAMPLE = `# Changelog

What changes for players. This text is not shown.

## [Unreleased]

### Fixed

- A fix that waits for the next version.

## [1.2.0] - 2026-10-11

The first version, with a note
over two lines.

A second paragraph.

### Fixed

- **Zoom** keeps its place.

### Added

- A \`code\` piece, and a change
  that goes on on the next line.
- Another one.

## [1.1.0] - 2026-09-01

### Removed

- Something old.
`;

describe('parseChangelog', () => {
	it('reads releases, notes, sections and changes, newest first', () => {
		const releases = parseChangelog(SAMPLE);
		expect(releases.map((r) => [r.version, r.date])).toEqual([
			[UNRELEASED, null],
			['1.2.0', '2026-10-11'],
			['1.1.0', '2026-09-01']
		]);
		const [, release] = releases;
		expect(release.notes).toEqual([
			[{ text: 'The first version, with a note over two lines.' }],
			[{ text: 'A second paragraph.' }]
		]);
		// Sections come in a fixed order, whatever the file's.
		expect(release.sections.map((s) => s.title)).toEqual(['Added', 'Fixed']);
		expect(release.sections[0].items).toEqual([
			[
				{ text: 'A ' },
				{ text: 'code', code: true },
				{ text: ' piece, and a change that goes on on the next line.' }
			],
			[{ text: 'Another one.' }]
		]);
		expect(release.sections[1].items).toEqual([
			[{ text: 'Zoom', strong: true }, { text: ' keeps its place.' }]
		]);
	});

	it('names the newest released version, past unreleased changes', () => {
		expect(newestVersion(parseChangelog(SAMPLE))).toBe('1.2.0');
		expect(newestVersion(parseChangelog('## [Unreleased]\n'))).toBeNull();
		expect(newestVersion([])).toBeNull();
	});

	it.each([
		['## Version 1.0.0', 'a release heading is'],
		['## [1.0.0]', 'release 1.0.0 needs a date'],
		['## [Unreleased] - 2026-10-11', 'unreleased changes have no date'],
		['## [1.0.0] - 2026-10-11\n## [1.0.0] - 2026-10-12', '1.0.0 twice'],
		['## [1.0.0] - 2026-10-11\n### New', 'a section is one of Added, Changed, Fixed, Removed'],
		['## [1.0.0] - 2026-10-11\n### Added\n### Added', 'Added twice'],
		['## [1.0.0] - 2026-10-11\n#### Detail', 'only `##` releases and `###` sections'],
		['## [1.0.0] - 2026-10-11\n- Without a section', 'a change belongs in a section'],
		['## [1.0.0] - 2026-10-11\n### Added\n- One\nNot indented', 'a change starts with `- `']
	])('refuses %j', (text, why) => {
		expect(() => parseChangelog(text)).toThrow(why);
	});

	it('says on which line', () => {
		expect(() => parseChangelog('# Changelog\n\n## [1.0.0]')).toThrow('CHANGELOG.md line 3:');
	});
});

describe('parseInline', () => {
	it('splits plain text, code and strong pieces, and leaves lone marks as text', () => {
		expect(parseInline('**New**: press `H` for a hint')).toEqual([
			{ text: 'New', strong: true },
			{ text: ': press ' },
			{ text: 'H', code: true },
			{ text: ' for a hint' }
		]);
		expect(parseInline('a ` b ** c')).toEqual([{ text: 'a ` b ** c' }]);
	});
});

describe("the project's changelog", () => {
	it('reads, and its newest version is the one in package.json', () => {
		const releases = readChangelog('.');
		const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
		expect(newestVersion(releases)).toBe(version);
		for (const r of releases) {
			// Every release says what changed, in the kinds the About page names.
			expect(r.sections.length).toBeGreaterThan(0);
			for (const s of r.sections) {
				expect(SECTIONS).toContain(s.title);
				expect(s.items.length).toBeGreaterThan(0);
			}
		}
	});

	it('is read from the project root', () => {
		const root = mkdtempSync(join(tmpdir(), 'changelog-'));
		try {
			writeFileSync(join(root, 'CHANGELOG.md'), '## [0.1.0] - 2026-01-01\n### Added\n- One\n');
			expect(readChangelog(root)[0].version).toBe('0.1.0');
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
