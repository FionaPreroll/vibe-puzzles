import type { BasePuzzle, GameModule } from '../core/types';
import { pinwheel } from './pinwheel';
import { sudoku } from './sudoku';
import { tetroid } from './tetroid';

/**
 * Any game of the registry. The shell passes its puzzle, state and settings only back to the same
 * game, so it needs to know no more of them.
 */
export type AnyGame = GameModule<BasePuzzle, unknown, string>;

/**
 * All games, in menu order. To add a game: create `src/lib/games/<id>/` with its logic
 * (`logic.ts`, registered in `logic.ts` here too), its settings (`settings.ts`) and a board
 * component, then list it below.
 */
export const GAMES: AnyGame[] = [tetroid, pinwheel, sudoku];

export function gameById(id: string): AnyGame | undefined {
	return GAMES.find((g) => g.id === id);
}
