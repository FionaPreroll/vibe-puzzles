import type { SettingInfo, Settings, TouchMode } from '../core/types';
import { load, save } from './storage';

const DARK_SCHEME = '(prefers-color-scheme: dark)';

/** The player's choice of night mode, null until they switch it. */
const chosenNight = () => load<boolean | null>('night', null);

const systemNight = () => typeof matchMedia === 'function' && matchMedia(DARK_SCHEME).matches;

/**
 * Night mode applies to the whole site, so it lives outside the per-game settings. Until the
 * player switches it, it follows the system's colour scheme (app.html applies the same rule
 * before the first paint).
 */
export const theme = $state({ night: chosenNight() ?? systemNight() });

/** Keeps night mode in step with the system's colour scheme while the player has not chosen. */
export function followSystemTheme(): () => void {
	if (typeof matchMedia !== 'function') return () => {};
	const scheme = matchMedia(DARK_SCHEME);
	const follow = () => {
		if (chosenNight() === null) theme.night = scheme.matches;
	};
	follow();
	scheme.addEventListener('change', follow);
	return () => scheme.removeEventListener('change', follow);
}

export function setNight(on: boolean) {
	theme.night = on;
	save('night', on);
}

export interface StoredSettings {
	values: Settings;
	updatedAt: number;
}

/** Reactive settings of one game, persisted on every change. */
export class GameSettings {
	values = $state<Settings>({});
	updatedAt = 0;

	constructor(
		readonly game: string,
		readonly info: SettingInfo[]
	) {
		const stored = load<StoredSettings | null>(`settings:${game}`, null);
		const values: Settings = {};
		for (const s of info) values[s.key] = stored?.values[s.key] ?? s.default;
		this.values = values;
		this.updatedAt = stored?.updatedAt ?? 0;
	}

	set(key: string, value: boolean) {
		this.values[key] = value;
		this.updatedAt = Date.now();
		save(`settings:${this.game}`, { values: { ...this.values }, updatedAt: this.updatedAt });
	}

	/** Settings that may follow the player to other devices. */
	syncable(): StoredSettings {
		const values: Settings = {};
		for (const s of this.info) if (!s.deviceOnly) values[s.key] = this.values[s.key];
		return { values, updatedAt: this.updatedAt };
	}

	/** Apply settings from another device if they are newer. */
	merge(remote: StoredSettings) {
		if (remote.updatedAt <= this.updatedAt) return;
		for (const s of this.info) {
			if (!s.deviceOnly && typeof remote.values[s.key] === 'boolean') {
				this.values[s.key] = remote.values[s.key];
			}
		}
		this.updatedAt = remote.updatedAt;
		save(`settings:${this.game}`, { values: { ...this.values }, updatedAt: this.updatedAt });
	}
}

export function loadTool(game: string, fallback: string): string {
	return load<string>(`tool:${game}`, fallback);
}

export function saveTool(game: string, tool: string) {
	save(`tool:${game}`, tool);
}

export function loadTouchMode(): TouchMode {
	return load<TouchMode>('touch', 'draw');
}

export function saveTouchMode(mode: TouchMode) {
	save('touch', mode);
}
