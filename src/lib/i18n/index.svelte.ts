import type { Variant } from '../core/variants';
import de from './de';
import en, { type Dictionary } from './en';

export type Locale = 'en' | 'de';

export const LOCALES: { id: Locale; label: string }[] = [
	{ id: 'en', label: 'English' },
	{ id: 'de', label: 'Deutsch' }
];

const DICTIONARIES: Record<Locale, Dictionary> = { en, de };
const STORAGE_KEY = 'vp:locale';

export const i18n = $state({ locale: 'en' as Locale });

function isLocale(value: unknown): value is Locale {
	return value === 'en' || value === 'de';
}

/** Stored choice, else the browser language. Called once on startup in the browser. */
export function initLocale() {
	let stored: string | null = null;
	try {
		stored = localStorage.getItem(STORAGE_KEY);
	} catch {
		/* storage blocked */
	}
	const browser = navigator.languages?.find((l) => isLocale(l.slice(0, 2)))?.slice(0, 2);
	i18n.locale = isLocale(stored) ? stored : isLocale(browser) ? browser : 'en';
	document.documentElement.lang = i18n.locale;
}

export function setLocale(locale: Locale) {
	i18n.locale = locale;
	document.documentElement.lang = locale;
	try {
		localStorage.setItem(STORAGE_KEY, locale);
	} catch {
		/* storage blocked */
	}
}

function lookup(dict: unknown, key: string): unknown {
	let node = dict;
	for (const part of key.split('.')) {
		if (node == null || typeof node !== 'object') return undefined;
		node = (node as Record<string, unknown>)[part];
	}
	return node;
}

type Params = Record<string, string | number>;

/** Text for a dotted key such as `game.undo`, with `{name}` placeholders filled in. */
export function t(key: string, params?: Params): string {
	const value = lookup(DICTIONARIES[i18n.locale], key) ?? lookup(en, key);
	if (typeof value !== 'string') return key;
	return params ? value.replace(/\{(\w+)\}/g, (m, p) => String(params[p] ?? m)) : value;
}

/** A list of texts, e.g. the rules of a game. */
export function tList(key: string): string[] {
	const value = lookup(DICTIONARIES[i18n.locale], key) ?? lookup(en, key);
	return Array.isArray(value) ? (value as string[]) : [];
}

/** Display name of a puzzle type, e.g. "10×10 Hard" or "Daily". */
export function variantLabel(v: Variant): string {
	if (v.special) return t(`special.${v.special}`);
	const mode = v.mode ? `${t(`mode.${v.mode}`)} ` : '';
	return `${mode}${v.width}×${v.height} ${t(`difficulty.${v.difficulty}`)}`;
}

function has(key: string): boolean {
	return typeof lookup(DICTIONARIES[i18n.locale], key) === 'string';
}

/** Name of a tool: a game-specific name, the shared one, or the module's English fallback. */
export function toolLabel(gameId: string, tool: { id: string; label: string }): string {
	if (has(`games.${gameId}.tool.${tool.id}`)) return t(`games.${gameId}.tool.${tool.id}`);
	return has(`tool.${tool.id}`) ? t(`tool.${tool.id}`) : tool.label;
}

export function settingLabel(setting: { key: string; label: string }): string {
	return has(`setting.${setting.key}`) ? t(`setting.${setting.key}`) : setting.label;
}
