import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	checkShippedLicenses,
	packageDir,
	packagesOf,
	readLicense,
	repositoryUrl
} from './licenses';

let root = '';

/** A fake installed package with a package.json and, optionally, a licence file. */
function install(dir: string, pkg: object, license?: [string, string]) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
	if (license) writeFileSync(join(dir, license[0]), license[1]);
}

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = '';
});

describe('readLicense', () => {
	it('reads name, version, licence, source address and licence text', () => {
		root = mkdtempSync(join(tmpdir(), 'licenses-'));
		install(
			join(root, 'node_modules', '@scope', 'lib'),
			{ version: '1.2.3', license: 'MIT', repository: 'git+https://github.com/o/lib.git' },
			['LICENSE.md', '  MIT License\n\nCopyright (c) Someone\n']
		);
		expect(readLicense(root, '@scope/lib')).toEqual({
			name: '@scope/lib',
			version: '1.2.3',
			license: 'MIT',
			url: 'https://github.com/o/lib',
			text: 'MIT License\n\nCopyright (c) Someone'
		});
	});

	it('finds packages in the pnpm store and links npm without a repository', () => {
		root = mkdtempSync(join(tmpdir(), 'licenses-'));
		install(
			join(root, 'node_modules', '.pnpm', 'dep@2.0.0', 'node_modules', 'dep'),
			{ version: '2.0.0', license: 'ISC' },
			['license', 'ISC']
		);
		expect(packageDir(root, 'dep')).toContain('.pnpm');
		expect(readLicense(root, 'dep')).toMatchObject({
			url: 'https://www.npmjs.com/package/dep',
			text: 'ISC'
		});
	});

	it('refuses a package that is missing or comes without a licence file', () => {
		root = mkdtempSync(join(tmpdir(), 'licenses-'));
		install(join(root, 'node_modules', 'bare'), { version: '1.0.0', license: 'MIT' });
		expect(() => readLicense(root, 'bare')).toThrow('no licence file');
		expect(() => readLicense(root, 'absent')).toThrow('not installed');
	});
});

describe('repositoryUrl', () => {
	it('turns the forms of package.json repositories into web addresses', () => {
		expect(repositoryUrl('sveltejs/devalue')).toBe('https://github.com/sveltejs/devalue');
		expect(repositoryUrl({ url: 'git+https://github.com/sveltejs/svelte.git' })).toBe(
			'https://github.com/sveltejs/svelte'
		);
		expect(repositoryUrl('git://github.com/a/b.git')).toBe('https://github.com/a/b');
		expect(repositoryUrl('github:a/b')).toBe('https://github.com/a/b');
		expect(repositoryUrl('ssh://host/x')).toBeNull();
		expect(repositoryUrl(undefined)).toBeNull();
	});
});

describe('packagesOf', () => {
	it('names the package of each module file, also nested and in the pnpm store', () => {
		expect(
			packagesOf([
				'/app/node_modules/svelte/src/index.js',
				'/app/node_modules/@sveltejs/kit/src/runtime/client.js',
				'/app/node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs',
				'C:\\app\\node_modules\\devalue\\index.js',
				'/app/src/routes/+page.svelte',
				'\0virtual:module'
			])
		).toEqual(new Set(['svelte', '@sveltejs/kit', 'clsx', 'devalue']));
	});
});

describe('checkShippedLicenses', () => {
	/** Run the plugin's bundle hook on chunks made of these module files. */
	function run(listed: string[], moduleIds: string[], consumer = 'client') {
		const plugin = checkShippedLicenses(listed);
		const hook = plugin.generateBundle as (this: unknown, o: unknown, b: unknown) => void;
		const errors: string[] = [];
		const context = {
			environment: { config: { consumer } },
			error: (message: string) => errors.push(message)
		};
		hook.call(context, {}, { 'a.js': { type: 'chunk', moduleIds }, 'a.css': { type: 'asset' } });
		return errors;
	}

	it('fails the browser build when a shipped package is not listed', () => {
		const ids = ['/app/node_modules/svelte/a.js', '/app/node_modules/clsx/b.js'];
		expect(run(['svelte', 'clsx'], ids)).toEqual([]);
		expect(run(['svelte'], ids)).toEqual([expect.stringContaining('About page: clsx.')]);
		// The server build does not ship to browsers.
		expect(run(['svelte'], ids, 'server')).toEqual([]);
	});
});
