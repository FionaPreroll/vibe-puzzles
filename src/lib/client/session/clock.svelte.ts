/**
 * The two clocks of a game: the competitive one runs from `startedAt` (for a server puzzle, from
 * when the server issued it) whatever the player does; the personal one counts only the time the
 * clock runs. The session decides when it may run (`mayRun`): not while loading, paused, solved,
 * or (unless the timer is hidden) while the page is in the background.
 */
export class Clock {
	/** Competitive clock start (epoch ms). */
	startedAt = $state(0);
	/** Personal play time accumulated before `runningSince`. */
	playMs = $state(0);
	runningSince = $state<number | null>(null);
	/** Paused with the Pause button (personal timer mode). */
	manualPause = $state(false);
	/** Final times once solved. */
	finalMs = $state(0);
	finalPlayMs = $state(0);
	/** The page is visible and has the focus. */
	active = true;

	constructor(private readonly mayRun: () => boolean) {}

	/** A game starts or continues with these times; the clock stands until `resume`. */
	reset(startedAt: number, playMs = 0) {
		this.startedAt = startedAt;
		this.playMs = playMs;
		this.runningSince = null;
		this.manualPause = false;
	}

	resume(now = Date.now()) {
		if (this.runningSince != null || !this.mayRun()) return;
		this.runningSince = now;
	}

	pause(now = Date.now()) {
		if (this.runningSince == null) return;
		this.playMs += now - this.runningSince;
		this.runningSince = null;
	}

	/** Personal time so far, with the part since the clock last started. */
	played(now = Date.now()): number {
		return this.playMs + (this.runningSince != null ? now - this.runningSince : 0);
	}

	/** Solved at `now`: stop and keep the final times. */
	finish(now = Date.now()) {
		this.pause(now);
		this.finalMs = now - this.startedAt;
		this.finalPlayMs = this.playMs;
	}

	/** Solved before (e.g. in another tab) at `at`, after the play time already saved. */
	finished(at: number) {
		this.finalMs = Math.max(0, at - this.startedAt);
		this.finalPlayMs = this.playMs;
	}
}
