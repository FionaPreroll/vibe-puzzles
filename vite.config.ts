import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

/** Shown in the footer and on the About page. */
const build = {
	version: JSON.parse(readFileSync('package.json', 'utf8')).version as string,
	commit: commit(),
	date: new Date().toISOString()
};

export default defineConfig({
	define: {
		__BUILD__: JSON.stringify(build),
		// Separate from __BUILD__, which every page uses: only the About page carries the texts.
		__LICENSES__: JSON.stringify(SHIPPED_PACKAGES.map((name) => readLicense('.', name)))
	},
	plugins: [
		checkShippedLicenses(SHIPPED_PACKAGES),
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
