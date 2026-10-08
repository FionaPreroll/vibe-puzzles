import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	use: {
		baseURL: 'http://localhost:4173',
		// Optional: use a preinstalled Chromium instead of the one Playwright downloads.
		launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }
	}
});
