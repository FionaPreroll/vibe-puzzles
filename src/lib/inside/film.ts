/**
 * The films of the Inside page: how a generator or solver works, shown on the game's own board,
 * frame by frame. A film is computed in full before it plays (from the algorithm's trace), so the
 * player can jump to any frame at once.
 */

/** A text of the Inside page: a key of its dictionaries and the values for its placeholders. */
export interface Caption {
	key: string;
	params?: Record<string, string | number>;
}

/** One picture: a board as the game draws it, what it points at, and what is said about it. */
export interface Frame<P, S> {
	puzzle: P;
	state: S;
	/** Elements in the board's keys (as for hints): ringed, tinted softly. */
	spotlight?: string[];
	area?: string[];
	/** The ring in the error colour: something that failed. */
	mistake?: boolean;
	/** What is said, for everyone. */
	caption: Caption;
	/** The same in technical terms, shown with "More detail". */
	detail?: Caption;
	/** How long the frame stays, in beats; 1 if not given. */
	hold?: number;
}

export interface Chapter<P, S> {
	/** Key of the chapter's title. */
	title: string;
	frames: Frame<P, S>[];
}

export interface Film<P, S> {
	/** The game whose board shows the film. */
	game: string;
	chapters: Chapter<P, S>[];
}

/** A beat at normal speed, in ms. */
export const BEAT = 800;

/** A film's frames in one list, and where its chapters start in it. */
export class Timeline<P = unknown, S = unknown> {
	readonly frames: Frame<P, S>[];
	readonly starts: number[];

	constructor(readonly film: Film<P, S>) {
		this.frames = film.chapters.flatMap((c) => c.frames);
		let at = 0;
		this.starts = film.chapters.map((c) => {
			const start = at;
			at += c.frames.length;
			return start;
		});
	}

	get last(): number {
		return this.frames.length - 1;
	}

	/** A frame number within the film. */
	clamp(index: number): number {
		return Math.max(0, Math.min(this.last, Math.round(index)));
	}

	/** The chapter that frame `index` belongs to. */
	chapterOf(index: number): number {
		let chapter = 0;
		this.starts.forEach((start, k) => {
			if (start <= index) chapter = k;
		});
		return chapter;
	}

	/** How long frame `index` stays at `speed`, in ms. */
	duration(index: number, speed: number): number {
		return ((this.frames[index]?.hold ?? 1) * BEAT) / speed;
	}

	/**
	 * Where "back" goes from `index`: the start of its chapter, or the start of the chapter before
	 * when `index` is on its first frames already (as a video player's back button does).
	 */
	back(index: number): number {
		const chapter = this.chapterOf(index);
		const start = this.starts[chapter];
		if (index - start > 1 || chapter === 0) return start;
		return this.starts[chapter - 1];
	}

	/** Where "next" goes from `index`: the start of the next chapter, or the last frame. */
	next(index: number): number {
		return this.starts[this.chapterOf(index) + 1] ?? this.last;
	}
}
