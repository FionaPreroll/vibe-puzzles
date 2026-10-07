import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = (name: string) =>
	JSON.parse(readFileSync(`${name ? `node_modules/${name}/` : ''}package.json`, 'utf8'));

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

/** Shown on the About page. */
const build = {
	version: pkg('').version as string,
	commit: commit(),
	date: new Date().toISOString(),
	// Libraries whose code or generated styles ship with the app.
	licenses: ['svelte', '@sveltejs/kit', 'tailwindcss'].map((name) => {
		const p = pkg(name);
		return { name, version: p.version as string, license: p.license as string };
	})
};

export default defineConfig({
	define: { __BUILD__: JSON.stringify(build) },
	plugins: [
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
			// Svelte components are covered by the Playwright suites, which report no coverage.
			include: ['src/**/*.{js,ts}', 'worker/**/*.ts'],
			exclude: ['src/test/**', '**/*.test.ts'],
			reporter: ['text-summary', 'lcov']
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'worker/**/*.test.ts'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
