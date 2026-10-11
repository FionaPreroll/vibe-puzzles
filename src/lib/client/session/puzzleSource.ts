import type { BasePuzzle, GameLogic } from '../../core/types';
import {
	decodePuzzleId,
	encodePuzzleId,
	periodKey,
	randomSeed,
	specialSeed
} from '../../core/variants';
import { issuePuzzle, serverPuzzles } from '../api';
import { findInBank, loadPuzzleSource, pickFromBank } from '../bank';
import { generate } from '../generate';

/** Where a puzzle came from: issued by the server (ranked), the collection, or made here. */
export type PuzzleOrigin = 'local' | 'bank' | 'server';

/** A puzzle to play, with what the session needs to know of where it came from. */
export interface FoundPuzzle<P> {
	puzzle: P;
	/** 0 for a server puzzle until it is solved: the ID would reveal the seed. */
	puzzleId: number;
	/** The server's ticket for a ranked puzzle. */
	ticket: string | null;
	/** Start of the competitive clock: for a server puzzle, when the server issued it. */
	startedAt: number;
	source: PuzzleOrigin;
}

/**
 * Finds the puzzles a game session plays: a requested one, or the next one from the server (if
 * it issues them), the collection (if the player chose it) or the device's generator. The next
 * local puzzle is generated ahead in the background (`prefetch`).
 */
export class PuzzleSource<P extends BasePuzzle> {
	/** Seed of the puzzle `prefetch` prepared. */
	private nextSeed: number | null = null;

	constructor(private readonly game: Pick<GameLogic<P>, 'id' | 'variants' | 'isValidPuzzle'>) {}

	/**
	 * Puzzle `puzzleId`, or (null) the next puzzle of type `variantIndex`. `serverFailed` is called
	 * as soon as a server puzzle turns out to be unavailable, while a local one is made instead.
	 * Rejects when no puzzle could be made.
	 */
	async find(
		variantIndex: number,
		puzzleId: number | null,
		serverFailed: () => void = () => {}
	): Promise<FoundPuzzle<P>> {
		const startedAt = Date.now();
		if (puzzleId == null) {
			const issued = await this.fromServer(variantIndex, serverFailed);
			if (issued) return issued;
			const banked = await this.fromBank(variantIndex);
			if (banked) return { ...banked, ticket: null, startedAt, source: 'bank' };
		}
		const id = puzzleId ?? this.localPuzzleId(variantIndex);
		const { variantIndex: index, seed } = decodePuzzleId(id);
		const v = this.game.variants[index];
		// A puzzle from the collection needs no generating (big ones take a while).
		const stored = v ? await findInBank<P>(this.game.id, v, id) : null;
		const puzzle =
			stored && this.game.isValidPuzzle(stored, v)
				? stored
				: await generate<P>(this.game.id, index, seed);
		return { puzzle, puzzleId: id, ticket: null, startedAt, source: 'local' };
	}

	/** Generate the next puzzle of a regular type in the background. */
	prefetch(variantIndex: number) {
		if (this.game.variants[variantIndex].special) return;
		this.nextSeed = randomSeed();
		generate(this.game.id, variantIndex, this.nextSeed).catch(() => undefined);
	}

	/** The next local puzzle: the current special, the prefetched or a random one. */
	private localPuzzleId(variantIndex: number): number {
		const v = this.game.variants[variantIndex];
		if (v.special) {
			return encodePuzzleId(
				variantIndex,
				specialSeed(this.game.id, v.special, periodKey(v.special))
			);
		}
		const seed = this.nextSeed ?? randomSeed();
		this.nextSeed = null;
		return encodePuzzleId(variantIndex, seed);
	}

	/** A new puzzle from the collection, if the player's choice of source says so. */
	private async fromBank(variantIndex: number): Promise<{ puzzleId: number; puzzle: P } | null> {
		const v = this.game.variants[variantIndex];
		const source = loadPuzzleSource();
		if (v.special || source === 'local') return null;
		if (source === 'mixed' && Math.random() < 0.5) return null;
		const pick = await pickFromBank<P>(this.game.id, v.key);
		return pick && this.game.isValidPuzzle(pick.puzzle, v)
			? { puzzleId: pick.id, puzzle: pick.puzzle }
			: null;
	}

	/** Ask the server for a puzzle; null (play locally, unranked) if it does not issue them. */
	private async fromServer(
		variantIndex: number,
		serverFailed: () => void
	): Promise<FoundPuzzle<P> | null> {
		if (!(await serverPuzzles())) return null;
		const v = this.game.variants[variantIndex];
		try {
			const issued = await issuePuzzle<P>(this.game.id, v.key);
			if (this.game.isValidPuzzle(issued.puzzle, v)) {
				return {
					puzzle: issued.puzzle,
					puzzleId: issued.puzzleId ?? 0,
					ticket: issued.ticket,
					startedAt: issued.issuedAt,
					source: 'server'
				};
			}
		} catch {
			/* fall back to a local puzzle */
		}
		serverFailed();
		return null;
	}
}
