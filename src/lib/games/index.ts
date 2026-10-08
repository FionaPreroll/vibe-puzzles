import type { GameModule } from '../core/types';
import { pinwheel } from './pinwheel';
import { sudoku } from './sudoku';
import { tetroid } from './tetroid';

/**
 * All games, in menu order. To add a game: create `src/lib/games/<id>/` with its logic
 * (`logic.ts`, registered in `logic.ts` here too) and a board component, then list it below.
 */
export const GAMES: GameModule[] = [
	tetroid as GameModule,
	pinwheel as GameModule,
	sudoku as GameModule
];

export function gameById(id: string): GameModule | undefined {
	return GAMES.find((g) => g.id === id);
}
