import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encodePuzzleId, isPlayable } from '../core/variants';
import { GAME_LOGIC } from './logic';

/**
 * A puzzle ID stands for whatever the generator makes of its seed, so a change to a generator, a
 * solver it calls or the order of its random draws silently changes the puzzle behind every
 * generated ID: shared links show another puzzle, and a device without the collection gets
 * another daily puzzle than everyone else.
 *
 * This test pins the puzzle behind a few IDs of every distinct generator setting (rule set, size
 * and difficulty; special types share the setting of a regular type except Pinwheel's monthly
 * 20×20). Types that are only announced (`comingSoon`) have no IDs yet, so they are left out. If it fails, the generator changed what an ID means. When that is deliberate, treat it
 * as a migration (see docs/generators.md) and replace the hashes with the new ones.
 *
 * Keys are `<game> <type> <seed>`; values are the first 16 hex digits of the SHA-256 of the
 * generated puzzle as JSON. Seeds are picked so that big puzzles stay quick to generate.
 */
const PINNED: Record<string, string> = {
	'tetroid 6n 1': '47d6cf32cee95d4f',
	'tetroid 6n 2': '21e6c9de61d5bb04',
	'tetroid 6h 1': 'eaa6a650f88beef9',
	'tetroid 6h 2': '3d2bd60b106aaaff',
	'tetroid 8n 1': '2497ceda7b8891d9',
	'tetroid 8n 2': '02c2f80ff59b9748',
	'tetroid 8h 1': '255361e5e82a0bfa',
	'tetroid 8h 2': '0f430de03647a6e0',
	'tetroid 10n 1': 'c8c4f24c76f8b2de',
	'tetroid 10n 2': '0b66ddcdf09798c4',
	'tetroid 10h 1': '32d9fd37cccc65d3',
	'tetroid 10h 2': 'e27073ad77f0419b',
	'tetroid 15n 2': 'a257ff5a7ad1f1eb',
	'tetroid 15h 1': 'c273eeaf15afc653',
	'tetroid 20n 1': 'e6b11a5d89fa7356',
	'tetroid 20h 2': '1c5101f0ae625545',
	'pinwheel 5n 1': 'c20a0211fd80198a',
	'pinwheel 5n 2': 'd0eb8c324b46f163',
	'pinwheel 5h 1': '3444f9e8cf78fd5b',
	'pinwheel 5h 2': '93694d88a92c033f',
	'pinwheel 7n 1': 'cc8467c4018f2ca0',
	'pinwheel 7n 2': '255ac76d0438a80e',
	'pinwheel 7h 1': 'aad68387e7db34b7',
	'pinwheel 7h 2': 'ab409c7e2615b737',
	'pinwheel 10n 1': 'a508cae9592d43b3',
	'pinwheel 10n 2': '7414073d3b03ec56',
	'pinwheel 10h 1': 'eaff8db760a413ac',
	'pinwheel 10h 2': '66cd11bb267d1000',
	'pinwheel 15n 2': '33ad12789b80f42c',
	'pinwheel 15h 2': '6487a148bdb3fca8',
	'pinwheel monthly 2': '3d2f69a5bf65d337',
	'sudoku 9e 1': 'ea49061732062b79',
	'sudoku 9e 2': '1293a8b7fe55ce09',
	'sudoku 9n 1': 'f897bfeb4f3178dd',
	'sudoku 9n 2': 'f10c760c22e1a0e9',
	'sudoku 9h 1': 'b73e024a843d8de8',
	'sudoku 9h 2': '791417479cd8555d',
	'sudoku c5e 1': 'eb3291af09601a4e',
	'sudoku c5e 2': '205a4a7ab0ae315d',
	'sudoku c5n 1': 'f502b26c319dded7',
	'sudoku c5n 2': '45bb89e1891e82d3',
	'sudoku c5h 1': 'c7090f3400e0289d',
	'sudoku c5h 2': '4ebb2e675482d968',
	'sudoku c7e 1': '234117ddef4dd69e',
	'sudoku c7e 2': 'fb12f1f341f2a4cc',
	'sudoku c7n 1': '2c9cdc7373a73709',
	'sudoku c7n 2': '938fe9e0dc1b9364',
	'sudoku c7h 1': 'aa10c130db1e9c95',
	'sudoku c7h 2': '4f21ef3e32bb5e13',
	'sudoku c9e 1': 'cff57b5dd23360e5',
	'sudoku c9e 2': 'fff8fe68602f29c1',
	'sudoku c9n 1': 'dae7fd291803f970',
	'sudoku c9n 2': 'fb76d99a75b2a786',
	'sudoku c9h 1': '7c5013b70677a45c',
	'sudoku c9h 2': '6459a1f29ab946b2',
	'loop 5n 1': 'd0776dab15a623d4',
	'loop 5n 2': 'cdfb602fde10c8ea'
};

const fingerprint = (puzzle: unknown) =>
	createHash('sha256').update(JSON.stringify(puzzle)).digest('hex').slice(0, 16);

describe('generated puzzle IDs', () => {
	it('pins every distinct generator setting', () => {
		const pinned = new Set(Object.keys(PINNED).map((key) => key.split(' ').slice(0, 2).join(' ')));
		for (const logic of Object.values(GAME_LOGIC)) {
			const settings = new Map<string, string>();
			for (const v of logic.variants.filter(isPlayable)) {
				const setting = `${v.mode ?? ''} ${v.width}x${v.height} ${v.difficulty}`;
				if (pinned.has(`${logic.id} ${v.key}`)) settings.set(setting, v.key);
				else if (!settings.has(setting)) settings.set(setting, '');
			}
			for (const [setting, key] of settings) expect(key, `${logic.id} ${setting}`).not.toBe('');
		}
	});

	// Big puzzles take a few seconds each, so these get more than the 5 s default.
	it.each(Object.entries(PINNED))(
		'keeps the puzzle of %s',
		(key, hash) => {
			const [game, variantKey, seed] = key.split(' ');
			const logic = GAME_LOGIC[game];
			const index = logic.variants.findIndex((v) => v.key === variantKey);
			const puzzle = logic.generate(logic.variants[index], Number(seed));
			const id = encodePuzzleId(index, Number(seed));
			expect(fingerprint(puzzle), `${game} #${id} changed: a generator migration?`).toBe(hash);
		},
		60_000
	);
});
