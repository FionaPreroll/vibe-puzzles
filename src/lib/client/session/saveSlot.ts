import type { BasePuzzle, GameLogic } from '../../core/types';
import type { Variant } from '../../core/variants';
import { pushSave } from '../api';
import { load, save } from '../storage';
import {
	hasProgress,
	playableSave,
	SAVE_VERSION,
	type PlayableSave,
	type SavedGame
} from './saves';

/** How long after the last change a game is uploaded, so that quick moves upload once. */
export const PUSH_DELAY_MS = 1500;

/** What the session saves of its game; the slot adds the format version and the time. */
export type GameRecord<S> = Omit<SavedGame<S>, 'version' | 'updatedAt'>;

/**
 * The storage slot of the game being played (`saveKey`): writing it locally and, after a short
 * pause, to the server, and telling this tab's saves from those of other tabs.
 *
 * Every save gets a time of its own (`updatedAt`): it decides which save wins between devices,
 * and it tells a tab whether the slot still holds what the tab itself last wrote or read.
 */
export class SaveSlot<P extends BasePuzzle, S> {
	/** Storage key of the game being opened or played. */
	key = '';
	/** Key of the slot the game on the board belongs to; differs from `key` while another loads. */
	private boardKey = '';
	/**
	 * `updatedAt` of the save this tab last wrote to or read from the slot. When the slot holds
	 * another one, another tab has saved the game since.
	 */
	private storedAt: number | null = null;
	/** When the game last changed. */
	private changedAt = 0;
	/** The next save replaces a game the player gave up, also on the server (see `claim`). */
	private replacing = false;
	/**
	 * The save of the game on the board that this tab last wrote or read had progress: if the next
	 * one has none, every move was taken back (undone, or the game started over).
	 */
	private progress = false;
	/** The upload that waits for the pause after the last change, and how to send it at once. */
	private waiting: { timer: ReturnType<typeof setTimeout>; send: () => void } | null = null;

	constructor(private readonly game: GameLogic<P, S>) {}

	/** Switch to the slot of the game being opened. An upload of the last one that waits goes now. */
	select(key: string) {
		if (key !== this.key) this.sendWaiting();
		this.key = key;
	}

	/** Whether the game on the board is this slot's: only then may it be written. */
	get holdsBoard(): boolean {
		return !!this.key && this.boardKey === this.key;
	}

	/** The game on the board now belongs to the selected slot, or (`false`) to none. */
	attachBoard(attached = true) {
		this.boardKey = attached ? this.key : '';
	}

	/** The slot's save, if a game of `variant` can continue it. */
	playable(variant: Variant): PlayableSave<P, S> | null {
		return playableSave(this.game, variant, load<unknown>(this.key, null));
	}

	/** This tab shows `save` now, as read from the slot or from another device. */
	adopt(save: SavedGame<S>) {
		this.storedAt = save.updatedAt;
		this.changedAt = save.updatedAt;
		this.progress = hasProgress(this.game, save);
	}

	/**
	 * A new game takes the slot, whatever another tab saved in it meanwhile. If it takes the place
	 * of a game the player had started (`replaces`), the server must not give that game back: the
	 * new game's first save is uploaded at once, untouched or not, and is newer than the old one.
	 */
	claim(replaces = false) {
		// The last game's change that waits (its solve, say) goes now, before the new game's.
		this.sendWaiting();
		this.storedAt = this.storedUpdatedAt();
		this.replacing = replaces;
		this.progress = false;
		if (replaces && this.storedAt) this.changedAt = Math.max(this.changedAt, this.storedAt);
	}

	/** A playable save another tab wrote since this tab last wrote or read the slot. */
	changedElsewhere(variant: Variant): PlayableSave<P, S> | null {
		const stored = this.playable(variant);
		return stored && stored.updatedAt !== this.storedAt ? stored : null;
	}

	/** Store a save from another device, which this tab shows from now on (`adopt`). */
	store(data: SavedGame<S>) {
		this.adopt(data);
		// Storage full: the older save stays, and must not count as another tab's.
		if (!save(this.key, data)) this.storedAt = this.storedUpdatedAt();
	}

	/**
	 * Save the game locally and, after a short pause, to the server. `changed` is false for a
	 * plain flush (e.g. of the play time), which keeps the time of the last change and uploads at
	 * once: it comes when the page is hidden or left, and a timer may never fire after that.
	 */
	write(record: GameRecord<S>, changed: boolean) {
		// Each change gets a time of its own, which tells the tabs' saves apart (`storedAt`).
		if (changed || !this.changedAt) this.changedAt = Math.max(Date.now(), this.changedAt + 1);
		const data: SavedGame<S> = { version: SAVE_VERSION, ...record, updatedAt: this.changedAt };
		if (save(this.key, data)) this.storedAt = data.updatedAt;
		const waited = this.cancelPush();
		const replacing = this.replacing;
		this.replacing = false;
		const progress = hasProgress(this.game, data);
		// An untouched game that had progress goes up, or the other devices keep its moves: so does
		// a save in place of such a one that still waited to go up.
		const takesBack = !progress && (this.progress || waited);
		this.progress = progress;
		// An untouched new puzzle is not uploaded, so it cannot replace a game on another device,
		// unless it takes the place of one the player gave up here (`claim`).
		if (!progress && !replacing && !takesBack) return;
		const key = this.key;
		// The upload waits in the outbox as soon as it starts, so it also survives the page.
		const send = () => void pushSave(key, data, data.updatedAt);
		if (!changed || replacing) return send();
		const timer = setTimeout(() => {
			this.waiting = null;
			send();
		}, PUSH_DELAY_MS);
		this.waiting = { timer, send };
	}

	/**
	 * Drop the upload that waits, e.g. when another tab's or device's save takes over. Returns
	 * whether one waited.
	 */
	cancelPush(): boolean {
		if (!this.waiting) return false;
		clearTimeout(this.waiting.timer);
		this.waiting = null;
		return true;
	}

	/**
	 * Send the upload that waits at once: another game takes the board, and a save of that one
	 * must not drop it.
	 */
	private sendWaiting() {
		const send = this.waiting?.send;
		this.cancelPush();
		send?.();
	}

	/** `updatedAt` of the save in the slot, if any. */
	private storedUpdatedAt(): number | null {
		return load<{ updatedAt?: number } | null>(this.key, null)?.updatedAt ?? null;
	}
}
