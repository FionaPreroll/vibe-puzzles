import type { Component } from 'svelte';
import type { Variant } from './variants';

export interface ToolInfo {
	id: string;
	label: string;
	/** Shortcut key. */
	key: string;
}

export interface SettingInfo {
	key: string;
	label: string;
	default: boolean;
	/** Only offered while this other setting has the given value. */
	requires?: { key: string; value: boolean };
	/** Stays on this device even when settings sync. */
	deviceOnly?: boolean;
}

export type Settings = Record<string, boolean>;

/** Everything the shared game shell passes to a game's board component. */
export interface BoardProps<P, S> {
	puzzle: P;
	state: S;
	settings: Settings;
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
	/** Whether the board reacts to the keyboard (only one instance per page). */
	keyboard?: boolean;
	touchMode: TouchMode;
	/** Apply a move. `changed` lists element keys for "Highlight last change". */
	onmove: (next: S, changed: string[]) => void;
	/** Some boards switch tools temporarily (e.g. Shift for colour). */
	ontool?: (tool: string) => void;
}

export type TouchMode = 'auto' | 'draw' | 'pan';

/** Pure game logic, shared by the client and the optional server. */
export interface GameLogic<P = unknown, S = unknown> {
	id: string;
	variants: Variant[];
	generate(variant: Variant, seed: number): P;
	/** Sanity check for a puzzle definition received from elsewhere. */
	isValidPuzzle(puzzle: unknown, variant: Variant): puzzle is P;
	emptyState(puzzle: P): S;
	/** Post-processing after a move by the player (e.g. auto crosses). */
	afterMove?(puzzle: P, state: S, settings: Settings): S;
	isSolved(puzzle: P, state: S): boolean;
	/** Alternative acceptance (e.g. by colours). Returns the completed state or null. */
	acceptAlternative?(puzzle: P, state: S, settings: Settings): S | null;
	/** Compact answer as submitted to the server. */
	answer(puzzle: P, state: S): string;
	verifyAnswer(puzzle: P, answer: string): boolean;
	encodeState(state: S): string;
	decodeState(puzzle: P, text: string): S | null;
	isValidState(puzzle: P, state: unknown): state is S;
}

export interface ToolOption {
	value: number;
	label: string;
	key: string;
	color: string;
}

/** A game as presented by the client. */
export interface GameModule<P = unknown, S = unknown> extends GameLogic<P, S> {
	name: string;
	tagline: string;
	rules: string[];
	notes: string[];
	tools: ToolInfo[];
	defaultTool(touch: boolean): string;
	/** Optional per-tool options (e.g. colours), selected with extra keys. */
	toolOptions?: { tool: string; values: ToolOption[]; default: number };
	settings: SettingInfo[];
	board: Component<BoardProps<P, S>>;
	/** Small static preview for the home page. */
	icon: string;
}
