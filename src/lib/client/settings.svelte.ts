import { settingValues, type CommonKey } from '../core/settings';
import { isLookChoice, resolveLook, type LookChoice } from '../core/theme';
import type { SettingInfo, Settings, TouchMode } from '../core/types';
import { load, save } from './storage';
import { KEY, settingsKey, toolKey } from './storageKeys';

const DARK_SCHEME = '(prefers-color-scheme: dark)';

/** The player's choice of night mode, null until they switch it. */
const chosenNight = () => load<boolean | null>(KEY.night, null);

const systemNight = () => typeof matchMedia === 'function' && matchMedia(DARK_SCHEME).matches;

/** The player's choice of look, 'auto' until they pick one. */
function chosenLook(): LookChoice {
	const stored = load<unknown>(KEY.look, 'auto');
	return isLookChoice(stored) ? stored : 'auto';
}

/**
 * Night mode and the look apply to the whole site, so they live outside the per-game settings.
 * Until the player switches night mode, it follows the system's colour scheme; until they pick a
 * look, the calendar picks it (app.html applies the same rules before the first paint).
 */
export const theme = $state({
	night: chosenNight() ?? systemNight(),
	lookChoice: chosenLook(),
	look: resolveLook(chosenLook(), new Date())
});

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
	save(KEY.night, on);
}

export function setLook(choice: LookChoice) {
	theme.lookChoice = choice;
	theme.look = resolveLook(choice, new Date());
	save(KEY.look, choice);
}

/** Settings as stored and synced: they may lack newer settings and keep removed ones. */
export interface StoredSettings {
	values: Partial<Record<string, boolean>>;
	updatedAt: number;
}

/** Reactive settings of one game (`K`: its own setting keys), persisted on every change. */
export class GameSettings<K extends string = never> {
	values: Settings<K>;
	updatedAt = 0;

	constructor(
		readonly game: string,
		readonly info: SettingInfo<CommonKey | K>[]
	) {
		const stored = load<StoredSettings | null>(settingsKey(game), null);
		this.values = $state(settingValues(info, stored?.values));
		this.updatedAt = Number.isFinite(stored?.updatedAt) ? stored!.updatedAt : 0;
	}

	set(key: CommonKey | K, value: boolean) {
		this.values[key] = value;
		this.updatedAt = Date.now();
		this.persist();
	}

	/** Settings that may follow the player to other devices. */
	syncable(): StoredSettings {
		const values: StoredSettings['values'] = {};
		for (const s of this.info) if (!s.deviceOnly) values[s.key] = this.values[s.key];
		return { values, updatedAt: this.updatedAt };
	}

	/** Apply settings from another device if they are newer. */
	merge(remote: StoredSettings) {
		if (!remote || !Number.isFinite(remote.updatedAt) || remote.updatedAt <= this.updatedAt) return;
		if (!remote.values || typeof remote.values !== 'object') return;
		for (const s of this.info) {
			const value = remote.values[s.key];
			if (!s.deviceOnly && typeof value === 'boolean') this.values[s.key] = value;
		}
		this.updatedAt = remote.updatedAt;
		this.persist();
	}

	private persist() {
		const stored: StoredSettings = { values: { ...this.values }, updatedAt: this.updatedAt };
		save(settingsKey(this.game), stored);
	}
}

export function loadTool(game: string, fallback: string): string {
	return load<string>(toolKey(game), fallback);
}

export function saveTool(game: string, tool: string) {
	save(toolKey(game), tool);
}

export function loadTouchMode(): TouchMode {
	return load<TouchMode>(KEY.touch, 'draw');
}

export function saveTouchMode(mode: TouchMode) {
	save(KEY.touch, mode);
}
