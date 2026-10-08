/**
 * Adds new puzzles to the collection in static/puzzles. Every run picks fresh random seeds, so
 * the collection grows over time. Each new puzzle is checked for a unique solution.
 *
 * Special types (daily, weekly, monthly) get the puzzle of every period up to
 * SPECIAL_PERIODS_AHEAD first. Regular types then grow in turns, one puzzle each, so that every
 * type gets its share when the time limit ends the run.
 *
 *   npx tsx scripts/grow-puzzle-bank.ts [--per-variant N] [--max-minutes M] [--game ID]
 *
 * --game limits the run to one game, e.g. to seed the collection of a new game.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	bankPath,
	SPECIAL_PERIODS_AHEAD,
	specialPuzzleId,
	upcomingPeriods,
	type PuzzleBank
} from '../src/lib/core/bank';
import type { GameLogic } from '../src/lib/core/types';
import { decodePuzzleId, encodePuzzleId, randomSeed } from '../src/lib/core/variants';
import { GAME_LOGIC } from '../src/lib/games/logic';

const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? Number(args[i + 1]) : fallback;
};
const perVariant = option('per-variant', 5);
const onlyGame = args.includes('--game') ? args[args.indexOf('--game') + 1] : undefined;
const deadline = Date.now() + option('max-minutes', 20) * 60_000;
const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

interface Slot {
	logic: GameLogic;
	index: number;
	file: string;
	bank: PuzzleBank;
	known: Set<number>;
	added: number;
}

function open(logic: GameLogic, index: number): Slot {
	const variant = logic.variants[index];
	const file = join('static', bankPath(logic.id, variant.key));
	const bank: PuzzleBank = existsSync(file)
		? JSON.parse(readFileSync(file, 'utf8'))
		: { version: 1, game: logic.id, variant: variant.key, puzzles: [] };
	return { logic, index, file, bank, known: new Set(bank.puzzles.map((p) => p.id)), added: 0 };
}

/** Adds the puzzle with this ID if it has a unique solution. */
function add(slot: Slot, id: number, period?: string): boolean {
	const variant = slot.logic.variants[slot.index];
	const puzzle = slot.logic.generate(variant, decodePuzzleId(id).seed);
	const check = slot.logic.countSolutions(puzzle, 2);
	if (!check.finished || check.count !== 1) {
		console.warn(`skipped ${slot.logic.id} ${variant.key} #${id}: not uniquely solvable`);
		return false;
	}
	slot.bank.puzzles.push(period ? { id, period, puzzle } : { id, puzzle });
	slot.known.add(id);
	slot.added++;
	return true;
}

function write(slot: Slot) {
	if (slot.added === 0) return;
	const { bank } = slot;
	if (bank.puzzles.some((p) => p.period)) {
		bank.puzzles.sort((a, b) => (a.period ?? '').localeCompare(b.period ?? ''));
	}
	mkdirSync(dirname(slot.file), { recursive: true });
	// One puzzle per line keeps diffs small as the collection grows.
	const lines = bank.puzzles.map((p) => `\t\t${JSON.stringify(p)}`).join(',\n');
	writeFileSync(
		slot.file,
		`{\n\t"version": 1,\n\t"game": "${bank.game}",\n\t"variant": "${bank.variant}",\n\t"puzzles": [\n${lines}\n\t]\n}\n`
	);
	console.log(`${bank.game} ${bank.variant}: +${slot.added} (${bank.puzzles.length} total)`);
}

const specials: Slot[] = [];
const regulars: Slot[] = [];
for (const logic of Object.values(GAME_LOGIC)) {
	if (onlyGame && logic.id !== onlyGame) continue;
	logic.variants.forEach((v, index) => (v.special ? specials : regulars).push(open(logic, index)));
}

// The special puzzles of the coming periods; their seeds are fixed, so a puzzle that is not
// uniquely solvable cannot be replaced and is left to on-device generation.
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
