import type { GameLogic } from '../core/types';
import { pinwheelLogic } from './pinwheel/logic';
import { sudokuLogic } from './sudoku/logic';
import { tetroidLogic } from './tetroid/logic';

/** Game logic by id. Shared by the client, the generator worker and the optional server. */
export const GAME_LOGIC: Record<string, GameLogic> = {
	tetroid: tetroidLogic,
	pinwheel: pinwheelLogic,
	sudoku: sudokuLogic
};
