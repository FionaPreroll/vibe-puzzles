/**
 * Adds new puzzles to the collection in static/puzzles. Every run picks fresh random seeds, so
 * the collection grows over time. Each new puzzle is checked for a unique solution.
 *
 *   npx tsx scripts/grow-puzzle-bank.ts [--per-variant N] [--max-minutes M]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { bankPath, type PuzzleBank } from '../src/lib/core/bank';
import { encodePuzzleId, randomSeed } from '../src/lib/core/variants';
import { GAME_LOGIC } from '../src/lib/games/logic';

const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? Number(args[i + 1]) : fallback;
};
const perVariant = option('per-variant', 5);
const deadline = Date.now() + option('max-minutes', 20) * 60_000;
const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

let added = 0;
for (const logic of Object.values(GAME_LOGIC)) {
	logic.variants.forEach((variant, index) => {
		if (variant.special) return;
		const file = join('static', bankPath(logic.id, variant.key));
		const bank: PuzzleBank = existsSync(file)
			? JSON.parse(readFileSync(file, 'utf8'))
			: { version: 1, game: logic.id, variant: variant.key, puzzles: [] };
		const known = new Set(bank.puzzles.map((p) => p.id));
		let count = 0;
		while (count < perVariant && Date.now() < deadline) {
			const seed = randomSeed(secureRandom);
			const id = encodePuzzleId(index, seed);
			if (known.has(id)) continue;
			const puzzle = logic.generate(variant, seed);
			const check = logic.countSolutions(puzzle, 2);
			if (!check.finished || check.count !== 1) {
				console.warn(`skipped ${logic.id} ${variant.key} #${id}: not uniquely solvable`);
				continue;
			}
			bank.puzzles.push({ id, puzzle });
			known.add(id);
			count++;
		}
		if (count === 0) return;
		mkdirSync(dirname(file), { recursive: true });
		// One puzzle per line keeps diffs small as the collection grows.
		const lines = bank.puzzles.map((p) => `\t\t${JSON.stringify(p)}`).join(',\n');
		writeFileSync(
			file,
			`{\n\t"version": 1,\n\t"game": "${bank.game}",\n\t"variant": "${bank.variant}",\n\t"puzzles": [\n${lines}\n\t]\n}\n`
		);
		added += count;
		console.log(`${logic.id} ${variant.key}: +${count} (${bank.puzzles.length} total)`);
	});
}
console.log(`Added ${added} puzzles.`);
