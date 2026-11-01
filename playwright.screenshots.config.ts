import { defineConfig } from '@playwright/test';

/**
 * The screenshots in the README (`pnpm screenshots`), kept out of the regular e2e run. Each one is
 * a snapshot in docs/screenshots: a run writes those that are missing or look different.
 */
export default defineConfig({
	testDir: 'e2e-screenshots',
	testMatch: '**/*.e2e.ts',
	snapshotPathTemplate: 'docs/screenshots/{arg}{ext}',
	updateSnapshots: 'changed',
	reporter: [['list']],
	webServer: { command: 'pnpm build && pnpm preview', port: 4173, reuseExistingServer: true },
	use: {
		baseURL: 'http://localhost:4173',
		browserName: 'chromium',
		launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }
	}
});
