import { describe, expect, it } from 'vitest';
import { FILM_GAMES, insideQuery } from '../../core/filmLink';
import { encodePuzzleId, isPlayable } from '../../core/variants';
import { GAME_LOGIC } from '../../games/logic';
import { Timeline } from '../film';
import { FILMS, filmFor } from './index';

/** The address a game links to for puzzle `seed` of its type `key`. */
function linked(game: string, key: string, seed: number, puzzle?: unknown) {
	const { variants } = GAME_LOGIC[game];
	const index = variants.findIndex((v) => v.key === key);
	const variant = variants[index];
	const id = encodePuzzleId(index, seed);
	const made = puzzle ?? GAME_LOGIC[game].generate(variant, seed);
	return { id, variant, query: new URLSearchParams(insideQuery(game, variant, id, made)!) };
}

/** The last frame's puzzle: every film ends on its puzzle. */
const lastPuzzle = (film: ReturnType<(typeof FILMS)[number]['make']>) =>
	new Timeline(film).frames.at(-1)!.puzzle;

describe('the films of the Inside page', () => {
	it('are one per game that has a film, in the order of the links', () => {
		expect(FILMS.map((f) => f.id)).toEqual(FILM_GAMES);
	});

	it('show the small types they explain as they were made', () => {
		const replayed = Object.fromEntries(
			FILMS.map((f) => [
				f.id,
				GAME_LOGIC[f.id].variants.filter((v) => isPlayable(v) && f.replays(v)).map((v) => v.key)
			])
		);
		expect(replayed).toEqual({
			sudoku: ['9e', '9n', 'daily'],
			pinwheel: ['5n', '5h', '7n', '7h'],
			tetroid: ['6n', '8n'],
			loop: ['5n', '7n']
		});
		for (const f of FILMS) expect(f.replays({ key: '', label: '', ...f.type })).toBe(true);
	});

	it('play the puzzle a game links to', () => {
		for (const [game, key, seed] of [
			['sudoku', '9e', 5],
			['pinwheel', '5h', 2],
			['tetroid', '8n', 3],
			['loop', '5n', 4]
		] as const) {
			const { id, variant, query } = linked(game, key, seed);
			const showing = filmFor(query)!;
			expect(showing.entry.id).toBe(game);
			expect(showing.asked).toEqual({ id, variant });
			expect(showing.type).toBe(variant);
			expect(lastPuzzle(showing.film)).toEqual(GAME_LOGIC[game].generate(variant, seed));
		}
	});

	it('show the example, and say why, for a type without a film or a puzzle made differently', () => {
		const big = linked('loop', '25x30n', 1, { width: 25, height: 30, clues: '' });
		const example = filmFor(big.query)!;
		expect(example.asked).toEqual({ id: big.id, variant: big.variant, missing: 'type' });
		expect(example.type).toBe(FILMS[3].type);
		expect(example.film).toEqual(FILMS[3].make());
		// A collection puzzle that an earlier generator made: its check does not match.
		const old = linked('loop', '5n', 4, { width: 5, height: 5, clues: '.'.repeat(25) });
		expect(filmFor(old.query)!.asked).toEqual({
			id: old.id,
			variant: old.variant,
			missing: 'version'
		});
		// Without a check, the ID alone is trusted.
		old.query.delete('p');
		expect(filmFor(old.query)!.asked).toEqual({ id: old.id, variant: old.variant });
	});

	it('show the game’s example for an address without a puzzle, and nothing without a game', () => {
		const plain = filmFor(new URLSearchParams('game=tetroid&id=nonsense'))!;
		expect(plain.entry.id).toBe('tetroid');
		expect(plain.asked).toBeUndefined();
		expect(filmFor(new URLSearchParams('game=chess'))).toBeNull();
		expect(filmFor(new URLSearchParams(''))).toBeNull();
	});
});
