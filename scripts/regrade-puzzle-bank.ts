/**
 * Replaces stored puzzles that miss their type's difficulty, e.g. after a generator change made
 * the rating stricter (see docs/generators.md, "Changing a generator").
 *
 * - A regular puzzle gets a new one with a fresh seed in its place, so every other puzzle keeps
 *   its chunk and position. The removed ID keeps working: a device then generates its puzzle.
 * - A special puzzle is generated again for its period, or dropped (left to on-device
 *   generation) if that misses too.
 * - Special puzzles of periods before DIFFICULTY_CHECKED_FROM stay as they are: they may have
 *   been played already.
 *
 *   pnpm bank:regrade [--game ID] [--variants KEY,KEY]
 */
import type { BankEntry } from '../src/lib/core/bank';
import { encodePuzzleId, randomSeed } from '../src/lib/core/variants';
import { GAME_LOGIC } from '../src/lib/games/logic';
import { checkedPuzzle, checksDifficulty, readType, writeType } from './collection';

const args = process.argv.slice(2);
const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const onlyGame = value('--game');
const onlyVariants = value('--variants')?.split(',');
const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

let replaced = 0;
let dropped = 0;
for (const logic of Object.values(GAME_LOGIC)) {
	if (onlyGame && logic.id !== onlyGame) continue;
	logic.variants.forEach((variant, index) => {
		if (variant.comingSoon || (onlyVariants && !onlyVariants.includes(variant.key))) return;
		const kind = variant.special;
		const puzzles = readType('static', logic.id, variant.key, kind);
		const known = new Set(puzzles.map((p) => p.id));
		let changed = 0;
		const kept: BankEntry[] = [];
		for (const entry of puzzles) {
			if (!checksDifficulty(kind, entry.period) || logic.fitsDifficulty(entry.puzzle, variant)) {
				kept.push(entry);
				continue;
			}
			changed++;
			if (kind) {
				// The seed of a special period is fixed: the current generator gets one more try.
				const checked = checkedPuzzle(logic, variant, entry.id);
				if ('puzzle' in checked) kept.push({ ...entry, puzzle: checked.puzzle });
				else dropped++;
				continue;
			}
			for (let tries = 0; ; tries++) {
				if (tries === 1000) throw new Error(`${logic.id} ${variant.key}: no puzzle fits`);
				const id = encodePuzzleId(index, randomSeed(secureRandom));
				const checked = known.has(id) ? null : checkedPuzzle(logic, variant, id);
				if (!checked || !('puzzle' in checked)) continue;
				known.add(id);
				kept.push({ id, puzzle: checked.puzzle });
				break;
			}
		}
		if (!changed) return;
		writeType('static', logic.id, variant.key, kept, kind);
		replaced += changed;
		console.log(`${logic.id} ${variant.key}: ${changed} of ${puzzles.length} replaced`);
	});
}
console.log(
	`Replaced ${replaced} puzzles${dropped ? `, of which ${dropped} special ones dropped` : ''}.`
);
