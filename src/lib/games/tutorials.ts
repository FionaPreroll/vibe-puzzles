import type { GameModule, GameTutorial } from '../core/types';

/** A game's tutorial, or the one of a mode such as Calcudoku in Sudoku. */
export interface TutorialRef {
	game: GameModule;
	mode?: string;
	tutorial: GameTutorial<unknown, unknown>;
}

/** The main tutorial first, then one per mode. */
export function tutorialsOf(game: GameModule): TutorialRef[] {
	const out: TutorialRef[] = game.tutorial ? [{ game, tutorial: game.tutorial }] : [];
	for (const [mode, tutorial] of Object.entries(game.modeTutorials ?? {})) {
		out.push({ game, mode, tutorial });
	}
	return out;
}

export function findTutorial(game: GameModule, mode?: string): TutorialRef | undefined {
	return tutorialsOf(game).find((r) => r.mode === mode);
}

/** Storage key that marks the tutorial as solved. */
export const tutorialDoneKey = (r: { game: GameModule; mode?: string }) =>
	`tutorialDone:${r.game.id}${r.mode ? `:${r.mode}` : ''}`;

/** Translation key of the step texts. */
export const tutorialTextKey = (r: { game: GameModule; mode?: string }) =>
	r.mode ? `games.${r.game.id}.modes.${r.mode}.tutorial` : `games.${r.game.id}.tutorial`;

/** The puzzle type a finished tutorial leads to: the first of its mode, or the game's default. */
export const tutorialNextVariant = (r: { game: GameModule; mode?: string }) =>
	r.mode ? r.game.variants.find((v) => v.mode === r.mode)?.key : undefined;
