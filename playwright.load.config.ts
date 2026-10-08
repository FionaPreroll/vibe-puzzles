import { defineConfig } from '@playwright/test';

/**
 * Long-running browser tests, kept out of the regular e2e run: a soak test (a long session of
 * play) and performance budgets. `pnpm test:soak`, `pnpm test:perf`.
 */
export default defineConfig({
	testDir: 'e2e-load',
	testMatch: '**/*.e2e.ts',
	workers: 1,
	timeout: 30 * 60_000,
	reporter: [['list']],
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	use: {
		baseURL: 'http://localhost:4173',
		// For the CI artifacts: what the page looked like when a long run failed.
		screenshot: 'only-on-failure',
		// A step that cannot happen fails instead of waiting for the whole test timeout.
		actionTimeout: 30_000,
		launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }
	}
});
