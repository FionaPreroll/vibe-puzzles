import { defineConfig } from 'vitest/config';

/** Generator and solver timings, kept out of the regular unit tests: `npm run test:perf`. */
export default defineConfig({
	test: {
		include: ['perf/**/*.perf.ts'],
		testTimeout: 10 * 60_000
	}
});
