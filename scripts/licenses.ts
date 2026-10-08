import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/** An open source package whose code ships with the app, as shown on the About page. */
export interface ShippedLicense {
	name: string;
	version: string;
	/** SPDX identifier from the package's package.json, e.g. MIT. */
	license: string;
	/** Source repository, or the npm page when the package names none. */
	url: string;
	/** The package's licence file: the MIT licence asks for its notice in every copy. */
	text: string;
}

/** Folder of an installed package, with npm's flat layout or pnpm's `.pnpm` store. */
export function packageDir(root: string, name: string): string {
	const flat = join(root, 'node_modules', name);
	if (existsSync(join(flat, 'package.json'))) return flat;
	const store = join(root, 'node_modules', '.pnpm');
	if (existsSync(store)) {
		for (const entry of readdirSync(store)) {
			const dir = join(store, entry, 'node_modules', name);
			if (existsSync(join(dir, 'package.json'))) return dir;
		}
	}
	throw new Error(`Package ${name} is not installed`);
}

/** Web address of a package.json `repository` field (object, URL or GitHub shorthand). */
export function repositoryUrl(repository: unknown): string | null {
	const raw =
		typeof repository === 'string' ? repository : (repository as { url?: unknown } | null)?.url;
	if (typeof raw !== 'string' || !raw) return null;
	if (/^[\w.-]+\/[\w.-]+$/.test(raw)) return `https://github.com/${raw}`;
	const url = raw
		.replace(/^git\+/, '')
		.replace(/^git:\/\//, 'https://')
		.replace(/^github:/, 'https://github.com/')
		.replace(/\.git$/, '');
	return /^https?:\/\//.test(url) ? url : null;
}

const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i;

/** Name, version, licence and licence text of an installed package. */
export function readLicense(root: string, name: string): ShippedLicense {
	const dir = packageDir(root, name);
	const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
	const file = readdirSync(dir).find((f) => LICENSE_FILE.test(f));
	if (typeof pkg.license !== 'string' || !file) {
		throw new Error(`Package ${name} has no licence or no licence file`);
	}
	return {
		name,
		version: pkg.version,
		license: pkg.license,
		url: repositoryUrl(pkg.repository) ?? `https://www.npmjs.com/package/${name}`,
		text: readFileSync(join(dir, file), 'utf8').trim()
	};
}

/** Packages that the given module files belong to (the last `node_modules` in each path). */
export function packagesOf(moduleIds: Iterable<string>): Set<string> {
	const names = new Set<string>();
	for (const id of moduleIds) {
		const path = id.replace(/\\/g, '/');
		const at = path.lastIndexOf('/node_modules/');
		if (at < 0) continue;
		const match = /^((?:@[^/]+\/)?[^/]+)\//.exec(path.slice(at + '/node_modules/'.length));
		if (match && !match[1].startsWith('.')) names.add(match[1]);
	}
	return names;
}

/**
 * Fails the browser build when its code contains a package that the About page does not list,
 * so a new dependency cannot ship without its licence notice.
 */
export function checkShippedLicenses(listed: string[]): Plugin {
	return {
		name: 'check-shipped-licenses',
		apply: 'build',
		generateBundle(_, bundle) {
			if (this.environment.config.consumer !== 'client') return;
			const ids = Object.values(bundle).flatMap((c) => (c.type === 'chunk' ? c.moduleIds : []));
			const missing = [...packagesOf(ids)].filter((name) => !listed.includes(name)).sort();
			if (missing.length) {
				this.error(
					`These packages ship with the app but are not on the About page: ${missing.join(', ')}. ` +
						'Add them to SHIPPED_PACKAGES in vite.config.ts.'
				);
			}
		}
	};
}
