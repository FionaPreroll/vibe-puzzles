// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** Build information, injected by vite.config.ts. */
	const __BUILD__: {
		version: string;
		commit: string;
		date: string;
	};
	/** Open source packages that ship with the app, with their licence texts (vite.config.ts). */
	const __LICENSES__: import('../scripts/licenses').ShippedLicense[];

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
