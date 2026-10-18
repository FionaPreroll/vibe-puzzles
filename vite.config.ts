import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { networkDefaults } from './scripts/buildFlags.ts';
import { readChangelog } from './scripts/changelog.ts';
import { checkShippedLicenses, readLicense } from './scripts/licenses.ts';

/**
 * Open source packages whose code (or, for Tailwind CSS, generated styles, and for the fonts,
 * font files) ships with the app. The About page shows each with its licence text; the build
 * fails if the browser code holds a package that is missing here.
 */
const SHIPPED_PACKAGES = [
	'svelte',
	'@sveltejs/kit',
	'devalue',
	'clsx',
	'tailwindcss',
	'@fontsource/fredoka',
	'@fontsource/cinzel'
];

function commit(): string {
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
	try {
		return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return 'unknown';
	}
}

/** Modules of the Inside page (`src/lib/inside/`, `src/routes/inside/`). */
const INSIDE = /[/\\]src[/\\](lib|routes)[/\\]inside[/\\]/;

/**
 * Tells the service worker which built files hold the Inside page's code (`__INSIDE_FILES__`), so
 * that its install leaves them out: players who never open the page never download them. The
 * service worker is built after the app, by the same builder.
 */
function insideFiles(): Plugin {
	let files: string[] = [];
	return {
		name: 'inside-files',
		generateBundle(_, bundle) {
			if (this.environment.name !== 'client') return;
			files = Object.values(bundle)
				.filter((out) => out.type === 'chunk' && out.moduleIds.some((id) => INSIDE.test(id)))
				.map((out) => out.fileName);
		},
		transform(code) {
			if (!code.includes('__INSIDE_FILES__')) return;
			return { code: code.replaceAll('__INSIDE_FILES__', JSON.stringify(files)), map: null };
		}
	};
}

/** Shown in the footer and on the About page. */
const build = {
	version: JSON.parse(readFileSync('package.json', 'utf8')).version as string,
	commit: commit(),
	date: new Date().toISOString()
};

export default defineConfig({
	define: {
		__BUILD__: JSON.stringify(build),
		// Defaults of the connection menu (see README, "Deployment").
		__NET__: JSON.stringify(networkDefaults(process.env)),
		// Separate from __BUILD__, which every page uses: only the About page carries the texts.
		__LICENSES__: JSON.stringify(SHIPPED_PACKAGES.map((name) => readLicense('.', name))),
		// CHANGELOG.md for the About page; the build fails on a line it does not understand.
		__CHANGELOG__: JSON.stringify(readChangelog('.'))
	},
	plugins: [
		checkShippedLicenses(SHIPPED_PACKAGES),
		insideFiles(),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Static build for GitHub Pages and Cloudflare (the optional server lives in worker/).
			adapter: adapter({ fallback: '404.html' }),
			paths: { base: (process.env.BASE_PATH ?? '') as '' | `/${string}` }
		})
	],
	test: {
		expect: { requireAssertions: true },
		coverage: {
			provider: 'v8',
			// Svelte components and the service worker, which runs only in the browser, are covered
			// by the Playwright suites, which report no coverage.
			include: [
				'src/**/*.{js,ts}',
				'worker/**/*.ts',
				'scripts/licenses.ts',
				'scripts/buildFlags.ts',
				'scripts/changelog.ts',
				'scripts/collection.ts'
			],
			exclude: ['src/test/**', 'src/service-worker/**', '**/*.test.ts'],
			reporter: ['text-summary', 'lcov']
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'worker/**/*.test.ts', 'scripts/**/*.test.ts'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
