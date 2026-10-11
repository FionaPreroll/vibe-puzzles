/** How long the celebration of a solve lasts. */
export const CELEBRATION_MS = 1800;

/**
 * Whether the short celebration runs: when the puzzle gets solved while playing (not when a solved
 * one opens), if `enabled`. A new puzzle, or anything else ending the solved state, ends it.
 * Call while a component is created: it follows the session with an effect.
 */
export function celebration(
	session: { readonly solved: boolean; readonly loading: boolean },
	enabled: () => boolean
): { readonly on: boolean } {
	let on = $state(false);
	let wasSolved = false;
	$effect(() => {
		const solved = session.solved;
		const loading = session.loading;
		if (solved && !wasSolved && !loading && enabled()) {
			on = true;
			const timer = setTimeout(() => (on = false), CELEBRATION_MS);
			wasSolved = solved;
			return () => {
				clearTimeout(timer);
				on = false;
			};
		}
		wasSolved = solved;
	});
	return {
		get on() {
			return on;
		}
	};
}
