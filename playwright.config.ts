import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	use: {
		baseURL: 'http://localhost:4173',
		// The classic look whatever the date; halloween.e2e.ts tests the seasonal one.
		storageState: {
			cookies: [],
			origins: [
				{ origin: 'http://localhost:4173', localStorage: [{ name: 'vp:look', value: '"classic"' }] }
			]
		},
		// Optional: use a preinstalled Chromium instead of the one Playwright downloads.
		launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }
	}
});
