import { encodePuzzleId, periodKey, specialSeed, type SpecialKind } from './variants';

/**
 * The puzzle collection: pre-generated puzzles in `static/puzzles/<game>/<variant>/`, grown by a
 * scheduled GitHub workflow (scripts/grow-puzzle-bank.ts). Each entry is checked for a unique
 * solution before it is added, and again by the tests.
 *
 * A regular type is split into chunks of CHUNK_SIZE puzzles (`0000.json`, `0001.json`, …) in the
 * order they were added, plus an `index.json` with the IDs of each chunk. New puzzles fill the
 * last chunk, so full chunks never change. `puzzles/sizes.json` holds the number of puzzles of
 * every regular type and ships with the code, so a random pick loads one chunk and no index;
 * opening a puzzle by its ID loads the index and one chunk. A regular type grows up to
 * MAX_PER_TYPE puzzles.
 *
 * Special types (daily, weekly, monthly) hold the puzzle of each period ahead of time, tagged
 * with its period key, in one file per month (daily) or year (weekly, monthly), e.g.
 * `daily/2026-10.json` or `weekly/2026.json`.
 */

export const CHUNK_SIZE = 100;

/**
 * The most puzzles a regular type holds; the collection stops growing a type there. This bounds
 * its index (about 25 KB compressed). A puzzle ID is a seed, so a puzzle beyond the cap is still
 * generated on the device.
 */
export const MAX_PER_TYPE = 5000;

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

/** The number of puzzles of each regular type, by game and type key. */
export type BankSizes = Record<string, Record<string, number>>;

const dir = (game: string, variant: string) => `puzzles/${game}/${variant}`;
export const sizesPath = 'puzzles/sizes.json';
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

/** The sizes of the regular types whose index is among `files`. */
export function sizesOf(files: Iterable<BankFile | BankIndex>): BankSizes {
	const sizes: BankSizes = {};
	for (const file of files) {
		if (!('chunks' in file)) continue;
		(sizes[file.game] ??= {})[file.variant] = file.chunks.reduce((n, ids) => n + ids.length, 0);
	}
	return sizes;
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
		private readonly sizes: BankSizes,
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

	/** How many puzzles a regular type holds. */
	size(game: string, variant: string): number {
		return this.sizes[game]?.[variant] ?? 0;
	}

	/**
	 * A random puzzle of a regular type that `skip` does not rule out, or null. Loads no index:
	 * the chunk of a random position comes first, so every puzzle is as likely to be picked; if
	 * `skip` rules out all of its puzzles, the other chunks follow in random order.
	 */
	async pick<P>(
		game: string,
		variant: string,
		skip: (id: number) => boolean = () => false,
		random: () => number = Math.random
	): Promise<BankEntry<P> | null> {
		const size = this.size(game, variant);
		if (!size) return null;
		const first = Math.floor(Math.floor(random() * size) / CHUNK_SIZE);
		const others = Array.from({ length: Math.ceil(size / CHUNK_SIZE) }, (_, k) => k).filter(
			(k) => k !== first
		);
		for (let k = others.length - 1; k > 0; k--) {
			const j = Math.floor(random() * (k + 1));
			[others[k], others[j]] = [others[j], others[k]];
		}
		for (const chunk of [first, ...others]) {
			const open = (await this.chunk<P>(game, variant, chunk)).filter((p) => !skip(p.id));
			if (open.length) return open[Math.floor(random() * open.length)];
		}
		return null;
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
