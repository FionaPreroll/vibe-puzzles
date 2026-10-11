import type { KeyPress } from '../../core/types';

/**
 * The game page's keyboard shortcuts, for the keys the board leaves (`KeyDispatcher`). One table
 * serves both the page's key handler (`findShortcut`) and the list in the shortcuts dialog
 * (`shortcutList`), so the two cannot drift apart. The tool and colour keys come from the game.
 */

export type ShortcutAction =
	| 'undo'
	| 'redo'
	| 'done'
	| 'newPuzzle'
	| 'hint'
	| 'save'
	| 'add'
	| 'trial'
	| 'trialDrop'
	| 'colourTool'
	| 'escape'
	| 'help';

/** What decides which shortcuts the page offers. */
export interface ShortcutContext {
	/** The game has hints and the player shows the Hint button. */
	hint: boolean;
	/** The game has a colour tool and the tool buttons are shown. */
	colourTool: boolean;
}

interface Shortcut {
	action: ShortcutAction;
	/** The keys as the dialog shows them; `mod` is Ctrl, or ⌘ on Apple devices. */
	keys(mod: string): string[];
	/** Whether a key press triggers it (the first in the table that does wins). */
	matches(e: KeyPress, ctx: ShortcutContext): boolean;
	/** Offered at all. */
	when?(ctx: ShortcutContext): boolean;
	/** The browser's own meaning of the key (e.g. saving the page) is suppressed. */
	preventDefault?: boolean;
}

const mod = (e: KeyPress) => e.ctrlKey || e.metaKey;
/** A plain key: no Ctrl, ⌘ or Alt (Shift is part of some keys). */
const plain = (e: KeyPress) => !mod(e) && !e.altKey;
const key = (e: KeyPress) => e.key.toLowerCase();

/** In the order of the dialog; the handler tries them in this order too. */
const SHORTCUTS: Shortcut[] = [
	{
		action: 'undo',
		keys: (m) => ['Z', `${m}+Z`],
		// After redo, which takes Shift+Z.
		matches: (e) => key(e) === 'z' && !e.shiftKey,
		preventDefault: true
	},
	{
		action: 'redo',
		keys: (m) => ['X', 'Shift+Z', `${m}+Y`],
		matches: (e) =>
			(key(e) === 'z' && e.shiftKey) || (key(e) === 'x' && !mod(e)) || (mod(e) && key(e) === 'y'),
		preventDefault: true
	},
	{
		action: 'done',
		keys: () => ['Enter'],
		// A focused button takes Enter for itself.
		matches: (e) =>
			e.key === 'Enter' &&
			!mod(e) &&
			(e.target as { tagName?: string } | null)?.tagName !== 'BUTTON',
		preventDefault: true
	},
	{
		action: 'newPuzzle',
		keys: () => ['+'],
		matches: (e) => (e.key === '=' || e.key === '+') && plain(e),
		preventDefault: true
	},
	{
		action: 'hint',
		keys: () => ['H'],
		matches: (e, ctx) => key(e) === 'h' && plain(e) && ctx.hint,
		when: (ctx) => ctx.hint,
		preventDefault: true
	},
	{
		action: 'save',
		keys: (m) => [`${m}+S`],
		matches: (e) => mod(e) && key(e) === 's' && !e.shiftKey,
		preventDefault: true
	},
	{
		action: 'add',
		keys: (m) => [`${m}+Shift+S`],
		matches: (e) => mod(e) && key(e) === 's' && e.shiftKey,
		preventDefault: true
	},
	{
		action: 'trial',
		keys: () => ['T'],
		matches: (e) => key(e) === 't' && plain(e) && !e.shiftKey,
		preventDefault: true
	},
	{
		action: 'trialDrop',
		keys: () => ['Shift+T'],
		matches: (e) => key(e) === 't' && plain(e) && e.shiftKey,
		preventDefault: true
	},
	{
		action: 'colourTool',
		keys: () => [']'],
		matches: (e, ctx) => e.key === ']' && ctx.colourTool,
		when: (ctx) => ctx.colourTool
	},
	{
		action: 'escape',
		keys: () => ['Esc'],
		// Closes what is open on top of the page; the page handles it before the table.
		matches: () => false
	},
	{
		action: 'help',
		keys: () => ['?'],
		matches: (e) => e.key === '?'
	}
];

/** The shortcut a key press triggers, if any. */
export function findShortcut(
	e: KeyPress,
	ctx: ShortcutContext
): { action: ShortcutAction; preventDefault: boolean } | null {
	const found = SHORTCUTS.find((s) => (s.when?.(ctx) ?? true) && s.matches(e, ctx));
	return found ? { action: found.action, preventDefault: !!found.preventDefault } : null;
}

/** The shortcuts the page offers, for the dialog: keys and the action's translation key. */
export function shortcutList(
	modKey: string,
	ctx: ShortcutContext
): { keys: string[]; label: `shortcuts.${ShortcutAction}`; action: ShortcutAction }[] {
	return SHORTCUTS.filter((s) => s.when?.(ctx) ?? true).map((s) => ({
		keys: s.keys(modKey),
		label: `shortcuts.${s.action}`,
		action: s.action
	}));
}

/** The modifier key's name: ⌘ on Apple devices, Ctrl elsewhere. */
export function modifierName(userAgent: string): string {
	return /Mac|iPhone|iPad/.test(userAgent) ? '⌘' : 'Ctrl';
}
