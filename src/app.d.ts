// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** Build information, injected by vite.config.ts. */
	const __BUILD__: {
		version: string;
		commit: string;
		date: string;
		licenses: { name: string; version: string; license: string }[];
	};

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
