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
	private pushTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(private readonly game: GameLogic<P, S>) {}

	/** Switch to the slot of the game being opened. A pending upload of the last one still goes. */
	select(key: string) {
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
	}

	/** A new game takes the slot, whatever another tab saved in it meanwhile. */
	claim() {
		this.storedAt = this.storedUpdatedAt();
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
		this.cancelPush();
		// An untouched new puzzle is not uploaded, so it cannot replace a game on another device.
		if (!hasProgress(this.game, data)) return;
		const key = this.key;
		// The upload waits in the outbox as soon as it starts, so it also survives the page.
		if (!changed) void pushSave(key, data, data.updatedAt);
		else this.pushTimer = setTimeout(() => pushSave(key, data, data.updatedAt), PUSH_DELAY_MS);
	}

	/** Drop the upload that waits, e.g. when another tab's or device's save takes over. */
	cancelPush() {
		if (this.pushTimer) clearTimeout(this.pushTimer);
		this.pushTimer = null;
	}

	/** `updatedAt` of the save in the slot, if any. */
	private storedUpdatedAt(): number | null {
		return load<{ updatedAt?: number } | null>(this.key, null)?.updatedAt ?? null;
	}
}
