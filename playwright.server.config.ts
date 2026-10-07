import { defineConfig } from '@playwright/test';

/** Browser tests that need the optional server: the app and API in `wrangler dev` with a local D1. */
export default defineConfig({
	testDir: 'e2e-server',
	testMatch: '**/*.e2e.ts',
	workers: 1,
	webServer: {
		command: 'npm run cf:dev -- --port 8788',
		port: 8788,
		timeout: 180_000,
		env: { WRANGLER_SEND_METRICS: 'false' }
	},
	use: {
		baseURL: 'http://localhost:8788',
		launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }
	}
});
