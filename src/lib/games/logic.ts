import type { GameLogic } from '../core/types';
import { loopLogic } from './loop/logic';
import { pinwheelLogic } from './pinwheel/logic';
import { sudokuLogic } from './sudoku/logic';
import { tetroidLogic } from './tetroid/logic';

/** Game logic by id. Shared by the client, the generator worker and the optional server. */
export const GAME_LOGIC: Record<string, GameLogic> = {
	tetroid: tetroidLogic,
	pinwheel: pinwheelLogic,
	sudoku: sudokuLogic,
	loop: loopLogic
};

/** The logic of a game ID from outside the app (a request, a stored key); never `Object`'s own. */
export function gameLogic(id: unknown): GameLogic | undefined {
	return typeof id === 'string' && Object.hasOwn(GAME_LOGIC, id) ? GAME_LOGIC[id] : undefined;
}
