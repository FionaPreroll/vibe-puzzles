import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	use: {
		baseURL: 'http://localhost:4173',
		// The classic look whatever the date; halloween.e2e.ts tests the seasonal one. The standard
		// layout on screens in landscape too; widescreen.e2e.ts tests the default, widescreen.
		storageState: {
			cookies: [],
			origins: [
				{
					origin: 'http://localhost:4173',
					localStorage: [
						{ name: 'vp:look', value: '"classic"' },
						{ name: 'vp:layout', value: '"standard"' }
					]
				}
			]
		}
	},
	projects: [
		{
			name: 'chromium',
			use: {
				browserName: 'chromium',
				// Optional: use a preinstalled Chromium instead of the one Playwright downloads.
				launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }
			}
		},
		{
			// Safari's engine, for the tests tagged @webkit: the home page, a move in each game, taps
			// on a phone and the backup. `--project chromium` leaves it out.
			name: 'webkit',
			use: { browserName: 'webkit' },
			grep: /@webkit/
		}
	]
});
