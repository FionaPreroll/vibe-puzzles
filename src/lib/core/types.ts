import type { Component } from 'svelte';
import type { CommonKey } from './settings';
import type { Variant } from './variants';

export interface ToolInfo {
	id: string;
	/** English fallback; the shown name comes from `tool.<id>` in the translations. */
	label: string;
	/** Short symbol for compact tool bars. */
	icon: string;
	/** Shortcut key. */
	key: string;
}

/** One on/off setting. `K` is the game's setting keys, so that `requires` names one of them. */
export interface SettingInfo<K extends string = string> {
	key: K;
	/** English fallback; the shown text comes from `setting.<key>` in the translations. */
	label: string;
	default: boolean;
	/** Only offered while this other setting has the given value. */
	requires?: { key: NoInfer<K>; value: boolean };
	/** Stays on this device even when settings sync. */
	deviceOnly?: boolean;
	/** Helps with knowledge of the solution: turning it on during a game counts as a hint. */
	countsAsHint?: boolean;
}

/** The values of the common settings and of a game's own ones (`K`). */
export type Settings<K extends string = never> = Record<CommonKey | K, boolean>;

/** What every game's puzzle has: the size of its grid in cells. */
export interface BasePuzzle {
	width: number;
	height: number;
}

/** Everything the shared game shell passes to a game's board component. */
export interface BoardProps<P, S, K extends string = never> {
	puzzle: P;
	state: S;
	settings: Settings<K>;
	tool: string;
	/** Game-specific tool option, e.g. the selected colour. */
	toolOption: number;
	/** Cell size in px. */
	cellSize: number;
	readonly: boolean;
	/** Elements changed by the last move, game-specific keys. */
	lastChange: ReadonlySet<string>;
	/** Render the empty puzzle only (printing). */
	blank?: boolean;
	/**
	 * The page's key dispatcher, for the one board instance that reacts to the keyboard: the board
	 * hands in its handlers and gets each key before the page's shortcuts.
	 */
	keys?: (board: BoardKeys) => () => void;
	/** The win animation is running: briefly colour the regions. */
	celebrate?: boolean;
	touchMode: TouchMode;
	/** Apply a move. `changed` lists element keys for "Highlight last change". */
	onmove(next: S, changed: string[]): void;
	/** Some boards switch tools temporarily (e.g. Shift for colour). */
	ontool?(tool: string): void;
	/** Elements a tutorial step points at, in the same keys as `lastChange`. */
	spotlight?: ReadonlySet<string>;
	/** Elements a hint's reasoning rests on (a region, a cage, a row), tinted more softly. */
	area?: ReadonlySet<string>;
}

/** What the boards read of a browser `KeyboardEvent` (this file has no DOM types: the server uses it). */
export interface KeyPress {
	key: string;
	code: string;
	repeat: boolean;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	target: unknown;
	preventDefault(): void;
}

/** A board's keyboard handlers, called by the page's key dispatcher (`client/keys.ts`). */
export interface BoardKeys {
	/** True when the board used the key, so that the page's shortcuts leave it alone. */
	keydown(e: KeyPress): boolean;
	keyup?(e: KeyPress): void;
	/** The window lost the focus: held keys count as released. */
	blur?(): void;
}

export interface GameTutorial<P, S> {
	puzzle: P;
	start(puzzle: P): S;
	steps: TutorialStep<P, S>[];
}

/**
 * One step of a guided tutorial, next to its texts in the translations. A step with `done` is a
 * task on the board: the player moves on once it holds. A step without it is only read.
 */
export interface TutorialStep<P, S> {
	/** Elements to point at on the board, in the board's `lastChange` keys. */
	spotlight?: string[];
	done?(puzzle: P, state: S): boolean;
	/** "Show me": the state with the task done, for a player who is stuck. */
	show?(puzzle: P, state: S): S;
}

export type TouchMode = 'auto' | 'draw' | 'pan';

/** What the hint button shows for the current position. */
export interface Hint {
	/** Wrong marks, cells that follow from the marks, or a place to start case analysis. */
	kind: 'mistake' | 'step' | 'stuck';
	/** Elements to point at, in the board's `lastChange` keys. */
	spotlight: string[];
	/** Elements the reasoning rests on (a box, a region, a cage), tinted more softly. */
	area?: string[];
	/**
	 * Translation keys of a first look, shown with `area` before the rest: where to look and which
	 * rule applies, without the result. The next press of the hint button shows the hint itself.
	 */
	teaser?: string[];
	/** Translation keys of the sentences that explain it, shown one after the other. */
	text: string[];
	/** Values for the placeholders in those sentences, e.g. `{digit}`. */
	params?: Record<string, string | number>;
}

/**
 * Pure game logic, shared by the client and the optional server. `P` and `S` are the puzzle and
 * the player's state, `K` the keys of the game's own settings.
 *
 * Every member that takes a `P`, `S` or settings is a method: methods are bivariant in their
 * parameters, so a registry can hold each game as a `GameLogic` without a cast.
 */
export interface GameLogic<
	P extends BasePuzzle = BasePuzzle,
	S = unknown,
	K extends string = never
> {
	id: string;
	variants: Variant[];
	generate(variant: Variant, seed: number): P;
	/** Number of solutions, searching for at most `limit`; `finished` is false if it gave up. */
	countSolutions(puzzle: P, limit: number): { count: number; finished: boolean };
	/** Whether a uniquely solvable puzzle is as hard as its type says, by the generator's rating. */
	fitsDifficulty(puzzle: P, variant: Variant): boolean;
	/** Sanity check for a puzzle definition received from elsewhere. */
	isValidPuzzle(puzzle: unknown, variant: Variant): puzzle is P;
	emptyState(puzzle: P): S;
	/** Post-processing after a move by the player (e.g. auto crosses). */
	afterMove?(puzzle: P, state: S, settings: Settings<K>): S;
	isSolved(puzzle: P, state: S): boolean;
	/** Alternative acceptance (e.g. by colours). Returns the completed state or null. */
	acceptAlternative?(puzzle: P, state: S, settings: Settings<K>): S | null;
	/** Compact answer as submitted to the server. */
	answer(puzzle: P, state: S): string;
	verifyAnswer(puzzle: P, answer: string): boolean;
	encodeState(state: S): string;
	decodeState(puzzle: P, text: string): S | null;
	isValidState(puzzle: P, state: unknown): state is S;
}

type Board<P, S, K extends string> = Component<BoardProps<P, S, K>>;

/**
 * A game's board component. Taken from a method so that, like the logic's methods, it is
 * bivariant in its props: the registry's boards take any puzzle, each board its own.
 */
export type BoardComponent<P, S, K extends string = never> = {
	board(...args: Parameters<Board<P, S, K>>): ReturnType<Board<P, S, K>>;
}['board'];

export interface ToolOption {
	value: number;
	label: string;
	key: string;
	color: string;
}

/**
 * A game as presented by the client. Texts (tagline, rules, notes, control hints, tutorial) live
 * in the translations under `games.<id>`.
 */
export interface GameModule<
	P extends BasePuzzle = BasePuzzle,
	S = unknown,
	K extends string = never
> extends GameLogic<P, S, K> {
	name: string;
	/** Playable before it is finished: shown with an "Early access" label. */
	earlyAccess?: boolean;
	tools: ToolInfo[];
	defaultTool(touch: boolean): string;
	/** Two tools that Space switches between (the board handles the key), e.g. digit and note. */
	spaceSwitches?: [string, string];
	/** Optional per-tool options (e.g. colours), selected with extra keys. */
	toolOptions?: { tool: string; values: ToolOption[]; default: number };
	/** The common settings and the game's own (`withCommon`). */
	settings: SettingInfo<CommonKey | K>[];
	board: BoardComponent<P, S, K>;
	/** Board height in cells beyond the grid (e.g. a number pad below it), for fitting the screen. */
	padRows?: number;
	/** Small static preview for the home page. */
	icon: string;
	/** A small hand-picked first puzzle for the interactive tutorial (texts in the translations). */
	tutorial?: GameTutorial<P, S>;
	/** Tutorials for a mode, e.g. Calcudoku in Sudoku (texts under `games.<id>.modes.<mode>`). */
	modeTutorials?: Record<string, GameTutorial<P, S>>;
	/** The next step from the player's position, or null when there is none (solved). */
	hint?(puzzle: P, state: S): Hint | null;
}
