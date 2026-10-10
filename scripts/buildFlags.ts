/** Network defaults of a build, read from environment variables by vite.config.ts. */
export interface NetworkDefaults {
	/** The build runs with the optional server (Cloudflare). False: no API request ever. */
	server: boolean;
	/** Offline mode is on until the player switches it off. */
	offline: boolean;
	/** The app looks for a new version now and then while online. */
	updateCheck: boolean;
}

const TRUE = ['true', '1', 'yes', 'on'];
const FALSE = ['false', '0', 'no', 'off'];

/** A yes/no environment variable; unset or empty gives `fallback`, anything unknown fails. */
export function readFlag(
	env: Record<string, string | undefined>,
	name: string,
	fallback: boolean
): boolean {
	const raw = env[name]?.trim().toLowerCase();
	if (!raw) return fallback;
	if (TRUE.includes(raw)) return true;
	if (FALSE.includes(raw)) return false;
	throw new Error(`${name} must be true or false, not "${env[name]}"`);
}

/**
 * `HAS_SERVER` (default true; the GitHub Pages build sets false), `DEFAULT_OFFLINE_MODE` (default
 * false) and `DEFAULT_UPDATE_CHECK` (default true).
 */
export function networkDefaults(env: Record<string, string | undefined>): NetworkDefaults {
	return {
		server: readFlag(env, 'HAS_SERVER', true),
		offline: readFlag(env, 'DEFAULT_OFFLINE_MODE', false),
		updateCheck: readFlag(env, 'DEFAULT_UPDATE_CHECK', true)
	};
}
