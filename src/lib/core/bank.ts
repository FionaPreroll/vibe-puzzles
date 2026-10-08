import { encodePuzzleId, periodKey, specialSeed, type SpecialKind } from './variants';

/**
 * The puzzle collection: pre-generated puzzles in `static/puzzles/<game>/<variant>/`, grown by a
 * scheduled GitHub workflow (scripts/grow-puzzle-bank.ts). Each entry is checked for a unique
 * solution before it is added, and again by the tests.
 *
 * A regular type is split into chunks of CHUNK_SIZE puzzles (`0000.json`, `0001.json`, …) in the
 * order they were added, plus an `index.json` with the IDs of each chunk. New puzzles fill the
 * last chunk, so full chunks never change. Picking or looking up a puzzle loads the index and one
 * chunk instead of the whole type.
 *
 * Special types (daily, weekly, monthly) hold the puzzle of each period ahead of time, tagged
 * with its period key, in one file per month (daily) or year (weekly, monthly), e.g.
 * `daily/2026-10.json` or `weekly/2026.json`.
 */

export const CHUNK_SIZE = 100;

export interface BankEntry<P = unknown> {
	id: number;
	puzzle: P;
	/** Special types only: the period this puzzle belongs to, e.g. 2026-10-07. */
	period?: string;
}

/** A chunk of a regular type, or the file of a group of special periods. */
export interface BankFile<P = unknown> {
	version: 2;
	game: string;
	variant: string;
	puzzles: BankEntry<P>[];
}

/** The IDs in each chunk of a regular type, in chunk order. */
export interface BankIndex {
	version: 2;
	game: string;
	variant: string;
	chunks: number[][];
}

const dir = (game: string, variant: string) => `puzzles/${game}/${variant}`;
export const indexPath = (game: string, variant: string) => `${dir(game, variant)}/index.json`;
export const chunkPath = (game: string, variant: string, chunk: number) =>
	`${dir(game, variant)}/${String(chunk).padStart(4, '0')}.json`;

/** The file a special period belongs to: its month for daily puzzles, else its year. */
export const specialGroup = (kind: SpecialKind, period: string) =>
	kind === 'daily' ? period.slice(0, 7) : period.slice(0, 4);
export const specialPath = (game: string, variant: string, kind: SpecialKind, period: string) =>
	`${dir(game, variant)}/${specialGroup(kind, period)}.json`;

/**
 * The files of one type, by path: chunks and index for a regular type, one file per group of
 * periods for a special type (`kind`), with its puzzles in period order.
 */
export function layoutType(
	game: string,
	variant: string,
	entries: BankEntry[],
	kind?: SpecialKind
): Record<string, BankFile | BankIndex> {
	const file = (puzzles: BankEntry[]): BankFile => ({ version: 2, game, variant, puzzles });
	const files: Record<string, BankFile | BankIndex> = {};
	if (kind) {
		const sorted = [...entries].sort((a, b) => a.period!.localeCompare(b.period!));
		for (const entry of sorted) {
			const path = specialPath(game, variant, kind, entry.period!);
			((files[path] ??= file([])) as BankFile).puzzles.push(entry);
		}
		return files;
	}
	const chunks: number[][] = [];
	for (let start = 0; start < entries.length; start += CHUNK_SIZE) {
		const puzzles = entries.slice(start, start + CHUNK_SIZE);
		files[chunkPath(game, variant, chunks.length)] = file(puzzles);
		chunks.push(puzzles.map((p) => p.id));
	}
	files[indexPath(game, variant)] = { version: 2, game, variant, chunks };
	return files;
}

/** File text with one puzzle (or one chunk of IDs) per line, so diffs stay small. */
export function serialize(file: BankFile | BankIndex): string {
	const { version, game, variant } = file;
	const head = `{\n\t"version": ${version},\n\t"game": ${JSON.stringify(game)},\n\t"variant": ${JSON.stringify(variant)},\n`;
	const [key, items] = 'chunks' in file ? ['chunks', file.chunks] : ['puzzles', file.puzzles];
	const lines = items.map((item) => `\t\t${JSON.stringify(item)}`).join(',\n');
	return `${head}\t"${key}": [${items.length ? `\n${lines}\n\t` : ''}]\n}\n`;
}

/** Reads a collection file by its path; null if there is none. */
export type ReadFile = (path: string) => Promise<unknown>;

/**
 * Reads the collection through `read`, keeping the most recently used files in memory (the
 * collection keeps growing, and a long session or a server instance visits many types).
 * Missing or failed files are not kept, so the next call tries again.
 */
export class Collection {
	private files = new Map<string, Promise<unknown>>();

	constructor(
		private readonly read: ReadFile,
		private readonly keep = 16
	) {}

	private file<T>(path: string): Promise<T | null> {
		let file = this.files.get(path);
		if (file) this.files.delete(path);
		else {
			file = this.read(path);
			file.then(
				(f) => f ?? this.files.delete(path),
				() => this.files.delete(path)
			);
		}
		this.files.set(path, file);
		if (this.files.size > this.keep) this.files.delete(this.files.keys().next().value!);
		return file as Promise<T | null>;
	}

	index(game: string, variant: string) {
		return this.file<BankIndex>(indexPath(game, variant));
	}

	async chunk<P>(game: string, variant: string, chunk: number): Promise<BankEntry<P>[]> {
		return (await this.file<BankFile<P>>(chunkPath(game, variant, chunk)))?.puzzles ?? [];
	}

	/** A random puzzle of a regular type that `skip` does not rule out, or null. */
	async pick<P>(
		game: string,
		variant: string,
		skip: (id: number) => boolean = () => false,
		random: () => number = Math.random
	): Promise<BankEntry<P> | null> {
		const index = await this.index(game, variant);
		const ids = index?.chunks.flat().filter((id) => !skip(id)) ?? [];
		if (!ids.length) return null;
		return this.find<P>(game, variant, ids[Math.floor(random() * ids.length)]);
	}

	/** The puzzle of a regular type with this ID, or null. */
	async find<P>(game: string, variant: string, id: number): Promise<BankEntry<P> | null> {
		const index = await this.index(game, variant);
		const chunk = index?.chunks.findIndex((ids) => ids.includes(id)) ?? -1;
		if (chunk < 0) return null;
		return (await this.chunk<P>(game, variant, chunk)).find((p) => p.id === id) ?? null;
	}

	/** The puzzle of a special type for a period (the current one by default), or null. */
	async special<P>(
		game: string,
		variant: string,
		kind: SpecialKind,
		period = periodKey(kind)
	): Promise<BankEntry<P> | null> {
		const file = await this.file<BankFile<P>>(specialPath(game, variant, kind, period));
		return file?.puzzles.find((p) => p.period === period) ?? null;
	}
}

/** How far ahead the collection holds special puzzles, in periods. */
export const SPECIAL_PERIODS_AHEAD: Record<SpecialKind, number> = {
	daily: 400,
	weekly: 60,
	monthly: 14
};

/** Keys of `count` consecutive periods of a special type, starting with the one of `from`. */
export function upcomingPeriods(kind: SpecialKind, count: number, from = new Date()): string[] {
	const keys: string[] = [];
	const day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
	while (keys.length < count) {
		const key = periodKey(kind, day);
		if (keys[keys.length - 1] !== key) keys.push(key);
		if (kind === 'monthly') day.setUTCMonth(day.getUTCMonth() + 1, 1);
		else day.setUTCDate(day.getUTCDate() + (kind === 'weekly' ? 7 : 1));
	}
	return keys;
}

/** ID of the puzzle every player gets for a special period. */
export const specialPuzzleId = (
	game: string,
	variantIndex: number,
	kind: SpecialKind,
	period: string
) => encodePuzzleId(variantIndex, specialSeed(game, kind, period));
