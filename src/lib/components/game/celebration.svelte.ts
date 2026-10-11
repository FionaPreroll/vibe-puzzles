/** How long the celebration of a solve lasts. */
export const CELEBRATION_MS = 1800;

/**
 * Whether the short celebration runs: when the puzzle gets solved while playing (not when a solved
 * one opens), if enabled. A new puzzle, or anything else ending the solved state, ends it.
 */
export class CelebrationTimer {
	on = $state(false);
	private wasSolved = false;

	/**
	 * Follow the session's state; call from an effect, which takes the returned cleanup:
	 * `$effect(() => timer.follow(session.solved, session.loading, enabled))`.
	 */
	follow(solved: boolean, loading: boolean, enabled: boolean): (() => void) | undefined {
		const starts = solved && !this.wasSolved && !loading && enabled;
		this.wasSolved = solved;
		if (!starts) return;
		this.on = true;
		const timer = setTimeout(() => (this.on = false), CELEBRATION_MS);
		return () => {
			clearTimeout(timer);
			this.on = false;
		};
	}
}
