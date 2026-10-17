import type { Timeline } from './film';

/** The speeds the player offers; 1 is normal. */
export const SPEEDS = [0.5, 1, 2, 4] as const;

/**
 * Plays a film like a video: frame after frame, each for its hold, until the end. Seeking keeps
 * playing or pausing as it was; a single step pauses, so the frame can be looked at.
 */
export class FilmPlayer<P = unknown, S = unknown> {
	timeline = $state.raw<Timeline<P, S> | null>(null);
	index = $state(0);
	playing = $state(false);
	speed = $state<number>(1);
	#timer: ReturnType<typeof setTimeout> | undefined;

	get frame() {
		return this.timeline?.frames[this.index] ?? null;
	}

	get chapter(): number {
		return this.timeline?.chapterOf(this.index) ?? 0;
	}

	get atEnd(): boolean {
		return !!this.timeline && this.index >= this.timeline.last;
	}

	/** A new film, paused on its first frame. */
	load(timeline: Timeline<P, S>) {
		this.timeline = timeline;
		this.index = 0;
		this.pause();
	}

	play() {
		if (!this.timeline) return;
		// Played to the end: start over.
		if (this.atEnd) this.index = 0;
		this.playing = true;
		this.#schedule();
	}

	pause() {
		this.playing = false;
		clearTimeout(this.#timer);
	}

	toggle() {
		if (this.playing) this.pause();
		else this.play();
	}

	seek(index: number) {
		if (!this.timeline) return;
		this.index = this.timeline.clamp(index);
		this.#schedule();
	}

	/** One frame on or back (`by` = ±1), paused. */
	step(by: number) {
		this.pause();
		this.seek(this.index + by);
	}

	/** To the start of the chapter, or of the one before (see `Timeline.back`). */
	chapterBack() {
		if (this.timeline) this.seek(this.timeline.back(this.index));
	}

	chapterNext() {
		if (this.timeline) this.seek(this.timeline.next(this.index));
	}

	setSpeed(speed: number) {
		this.speed = speed;
		this.#schedule();
	}

	/** The page goes away. */
	dispose() {
		this.pause();
	}

	#schedule() {
		clearTimeout(this.#timer);
		const timeline = this.timeline;
		if (!this.playing || !timeline) return;
		if (this.atEnd) {
			this.playing = false;
			return;
		}
		this.#timer = setTimeout(
			() => {
				this.index++;
				this.#schedule();
			},
			timeline.duration(this.index, this.speed)
		);
	}
}
