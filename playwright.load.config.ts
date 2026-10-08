import { defineConfig } from '@playwright/test';

/**
 * Long-running browser tests, kept out of the regular e2e run: a soak test (a long session of
 * play) and performance budgets. `npm run test:soak`, `npm run test:perf`.
 */
export default defineConfig({
	testDir: 'e2e-load',
	testMatch: '**/*.e2e.ts',
	workers: 1,
	timeout: 30 * 60_000,
	reporter: [['list']],
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	use: {
		baseURL: 'http://localhost:4173',
		launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }
	}
});
