/**
 * Adds new puzzles to the collection in static/puzzles. Every run picks fresh random seeds, so
 * the collection grows over time. Each new puzzle is checked for a unique solution and for the
 * difficulty of its type.
 *
 * Special types (daily, weekly, monthly) get the puzzle of every period up to
 * SPECIAL_PERIODS_AHEAD first. Regular types then grow in turns, one puzzle each, so that every
 * type gets its share when the time limit ends the run.
 *
 *   pnpm bank:grow [--per-variant N] [--max-minutes M] [--game ID]
 *     [--variants KEY,KEY]
 *
 * --game limits the run to one game, e.g. to seed the collection of a new game; --variants
 * limits it further to some puzzle types, e.g. new ones.
 */
import {
	SPECIAL_PERIODS_AHEAD,
	specialPuzzleId,
	upcomingPeriods,
	type BankEntry
} from '../src/lib/core/bank';
import type { GameLogic } from '../src/lib/core/types';
import { encodePuzzleId, randomSeed } from '../src/lib/core/variants';
import { GAME_LOGIC } from '../src/lib/games/logic';
import { checkedPuzzle, readType, writeType } from './collection';

const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? Number(args[i + 1]) : fallback;
};
const perVariant = option('per-variant', 5);
const onlyGame = args.includes('--game') ? args[args.indexOf('--game') + 1] : undefined;
const onlyVariants = args.includes('--variants')
	? args[args.indexOf('--variants') + 1].split(',')
	: undefined;
const deadline = Date.now() + option('max-minutes', 20) * 60_000;
const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

interface Slot {
	logic: GameLogic;
	index: number;
	puzzles: BankEntry[];
	known: Set<number>;
	added: number;
}

function open(logic: GameLogic, index: number): Slot {
	const variant = logic.variants[index];
	const puzzles = readType('static', logic.id, variant.key, variant.special);
	return { logic, index, puzzles, known: new Set(puzzles.map((p) => p.id)), added: 0 };
}

/**
 * Adds the puzzle with this ID if it has a unique solution and fits its type's difficulty.
 * Skipping a seed changes no ID.
 */
function add(slot: Slot, id: number, period?: string): boolean {
	const variant = slot.logic.variants[slot.index];
	const checked = checkedPuzzle(slot.logic, variant, id);
	if ('reason' in checked) {
		console.warn(`skipped ${slot.logic.id} ${variant.key} #${id}: ${checked.reason}`);
		return false;
	}
	const { puzzle } = checked;
	slot.puzzles.push(period ? { id, period, puzzle } : { id, puzzle });
	slot.known.add(id);
	slot.added++;
	return true;
}

function write(slot: Slot) {
	if (slot.added === 0) return;
	const variant = slot.logic.variants[slot.index];
	writeType('static', slot.logic.id, variant.key, slot.puzzles, variant.special);
	console.log(`${slot.logic.id} ${variant.key}: +${slot.added} (${slot.puzzles.length} total)`);
}

const specials: Slot[] = [];
const regulars: Slot[] = [];
for (const logic of Object.values(GAME_LOGIC)) {
	if (onlyGame && logic.id !== onlyGame) continue;
	logic.variants.forEach((v, index) => {
		if (onlyVariants && !onlyVariants.includes(v.key)) return;
		(v.special ? specials : regulars).push(open(logic, index));
	});
}

// The special puzzles of the coming periods; their seeds are fixed, so a puzzle that is not
// uniquely solvable or misses its difficulty cannot be replaced and is left to on-device
// generation.
for (const slot of specials) {
	const kind = slot.logic.variants[slot.index].special!;
	for (const period of upcomingPeriods(kind, SPECIAL_PERIODS_AHEAD[kind])) {
		if (Date.now() >= deadline) break;
		const id = specialPuzzleId(slot.logic.id, slot.index, kind, period);
		if (!slot.known.has(id)) add(slot, id, period);
	}
	write(slot);
}

// Regular types in turns, so a time limit leaves every type with new puzzles.
let growing = regulars.filter(() => perVariant > 0);
while (growing.length && Date.now() < deadline) {
	for (const slot of growing) {
		if (Date.now() >= deadline) break;
		const id = encodePuzzleId(slot.index, randomSeed(secureRandom));
		if (!slot.known.has(id)) add(slot, id);
	}
	growing = growing.filter((s) => s.added < perVariant);
}
regulars.forEach(write);

const added = [...specials, ...regulars].reduce((n, s) => n + s.added, 0);
console.log(`Added ${added} puzzles${Date.now() >= deadline ? ' (time limit reached)' : ''}.`);
