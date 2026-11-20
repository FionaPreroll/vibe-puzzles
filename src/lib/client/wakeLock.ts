import { load, save } from './storage';
import { KEY } from './storageKeys';

/**
 * How long the screen stays on during a game: not at all (the system dims and locks it as usual),
 * for some minutes after the last touch, click or key, or for as long as the puzzle is open.
 */
export type KeepAwake = 'off' | '2' | '5' | '15' | '30' | 'always';

export const KEEP_AWAKE_CHOICES: KeepAwake[] = ['off', '2', '5', '15', '30', 'always'];

export const DEFAULT_KEEP_AWAKE: KeepAwake = '5';

/** The player's choice on this device; never synced, since it depends on the device. */
export function loadKeepAwake(): KeepAwake {
	const stored = load<unknown>(KEY.keepAwake, DEFAULT_KEEP_AWAKE);
	return KEEP_AWAKE_CHOICES.find((c) => c === stored) ?? DEFAULT_KEEP_AWAKE;
}

export function saveKeepAwake(choice: KeepAwake) {
	save(KEY.keepAwake, choice);
}

/** The part of the Screen Wake Lock API (`navigator.wakeLock`) used here. */
export interface WakeLockApi {
	request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

export interface WakeLockSentinelLike extends EventTarget {
	readonly released: boolean;
	release(): Promise<void>;
}

/** The browser's Screen Wake Lock API, or undefined where it has none (or outside HTTPS). */
export function browserWakeLock(): WakeLockApi | undefined {
	if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;
	return (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
}

interface Clock {
	now(): number;
	setTimeout(run: () => void, ms: number): unknown;
	clearTimeout(id: unknown): void;
}

const realClock: Clock = {
	now: () => Date.now(),
	setTimeout: (run, ms) => setTimeout(run, ms),
	clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>)
};

/**
 * Keeps the screen from dimming and locking while it is wanted: the choice is not `off`, the page
 * is visible, a puzzle is being played (`setPlaying`) and, for a duration, the last input
 * (`input`) is less than that long ago. The browser drops the lock when the page is hidden; it is
 * taken again when the page shows (`visibilityChanged`, which counts as input). A refused request
 * (battery saver, no permission) leaves the screen to the system.
 */
export class ScreenAwake {
	private choice: KeepAwake = 'off';
	private playing = false;
	private lastInput: number;
	private sentinel: WakeLockSentinelLike | null = null;
	private requesting = false;
	private timer: unknown = null;
	private stopped = false;

	constructor(
		private readonly api: WakeLockApi | undefined,
		private readonly visible: () => boolean,
		private readonly clock: Clock = realClock
	) {
		this.lastInput = clock.now();
	}

	/** The screen is kept on now. */
	get held(): boolean {
		return this.sentinel !== null && !this.sentinel.released;
	}

	setChoice(choice: KeepAwake) {
		this.choice = choice;
		this.input();
	}

	setPlaying(playing: boolean) {
		this.playing = playing;
		this.update();
	}

	/** The player touched, clicked or typed: a duration starts again. */
	input() {
		this.lastInput = this.clock.now();
		this.update();
	}

	visibilityChanged() {
		if (this.visible()) this.input();
		else this.update();
	}

	/** Lets the screen go and stops for good. */
	stop() {
		this.stopped = true;
		this.update();
	}

	private durationMs(): number {
		return this.choice === 'off' || this.choice === 'always' ? 0 : Number(this.choice) * 60_000;
	}

	private wanted(): boolean {
		if (this.stopped || !this.api || this.choice === 'off' || !this.playing) return false;
		if (!this.visible()) return false;
		return this.choice === 'always' || this.clock.now() - this.lastInput < this.durationMs();
	}

	private update() {
		if (this.timer !== null) this.clock.clearTimeout(this.timer);
		this.timer = null;
		if (!this.wanted()) {
			this.release();
			return;
		}
		if (this.choice !== 'always') {
			const left = this.lastInput + this.durationMs() - this.clock.now();
			this.timer = this.clock.setTimeout(() => {
				this.timer = null;
				this.update();
			}, left);
		}
		if (!this.held) void this.request();
	}

	private async request() {
		if (this.requesting || !this.api) return;
		this.requesting = true;
		try {
			const sentinel = await this.api.request('screen');
			this.requesting = false;
			if (!this.wanted()) {
				void sentinel.release().catch(() => undefined);
				return;
			}
			this.sentinel = sentinel;
			sentinel.addEventListener('release', () => {
				if (this.sentinel === sentinel) this.sentinel = null;
			});
		} catch {
			// Refused (battery saver, hidden page, no permission): the system decides.
			this.requesting = false;
		}
	}

	private release() {
		const sentinel = this.sentinel;
		this.sentinel = null;
		if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined);
	}
}

/** Input that counts as playing, for `ScreenAwake.input`. */
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const;

/** Wire a `ScreenAwake` to the page's input and visibility, until the returned function runs. */
export function keepScreenAwake(awake: ScreenAwake): () => void {
	const input = () => awake.input();
	const visibility = () => awake.visibilityChanged();
	for (const type of INPUT_EVENTS) window.addEventListener(type, input, { passive: true });
	document.addEventListener('visibilitychange', visibility);
	return () => {
		for (const type of INPUT_EVENTS) window.removeEventListener(type, input);
		document.removeEventListener('visibilitychange', visibility);
		awake.stop();
	};
}
