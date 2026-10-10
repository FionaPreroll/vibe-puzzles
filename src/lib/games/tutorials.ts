import { tutorialDoneKey as doneKey } from '../client/storageKeys';
import type { BasePuzzle, GameTutorial } from '../core/types';
import type { AnyGame } from './index';

/** A game's tutorial, or the one of a mode such as Calcudoku in Sudoku. */
export interface TutorialRef {
	game: AnyGame;
	mode?: string;
	tutorial: GameTutorial<BasePuzzle, unknown>;
}

/** The main tutorial first, then one per mode. */
export function tutorialsOf(game: AnyGame): TutorialRef[] {
	const out: TutorialRef[] = game.tutorial ? [{ game, tutorial: game.tutorial }] : [];
	for (const [mode, tutorial] of Object.entries(game.modeTutorials ?? {})) {
		out.push({ game, mode, tutorial });
	}
	return out;
}

export function findTutorial(game: AnyGame, mode?: string): TutorialRef | undefined {
	return tutorialsOf(game).find((r) => r.mode === mode);
}

/** Storage key that marks the tutorial as solved. */
export const tutorialDoneKey = (r: { game: AnyGame; mode?: string }) => doneKey(r.game.id, r.mode);

/** Translation key of the step texts. */
export const tutorialTextKey = (r: { game: AnyGame; mode?: string }) =>
	r.mode ? `games.${r.game.id}.modes.${r.mode}.tutorial` : `games.${r.game.id}.tutorial`;

/** The puzzle type a finished tutorial leads to: the first of its mode, or the game's default. */
export const tutorialNextVariant = (r: { game: AnyGame; mode?: string }) =>
	r.mode ? r.game.variants.find((v) => v.mode === r.mode)?.key : undefined;
