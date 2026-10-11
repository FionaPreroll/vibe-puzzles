import { sameData } from '../../core/equal';

export const MAX_CHECKPOINTS = 10;

/** How many positions undo can go back. */
export const MAX_UNDO = 500;

/** What a game's history starts from: a position, and what a save keeps of the rest. */
export interface HistoryStart<S> {
	state: S;
	checkpoints?: S[];
	currentCheckpoint?: number;
	trial?: S | null;
}

/**
 * The player's position on the board and how it got there: undo and redo, checkpoints the player
 * saved, and the start of a running trial. Each change returns whether the position or the
 * history changed; the session decides what follows (saving, taking a hint away).
 *
 * Positions are compared by their data (`sameData`), never by identity: a move that changes
 * nothing is no step.
 */
export class History<S> {
	/** The position on the board; null while there is no puzzle. */
	state = $state.raw<S | null>(null);
	past = $state.raw<S[]>([]);
	future = $state.raw<S[]>([]);
	checkpoints = $state.raw<S[]>([]);
	currentCheckpoint = $state(-1);
	/**
	 * The position a trial began from, while one runs: the board draws what changed since in the
	 * trial colour, until the player keeps the trial or goes back to this position.
	 */
	trial = $state.raw<S | null>(null);

	/** Start over from `start`, or (null) with no position at all. */
	reset(start: HistoryStart<S> | null) {
		this.state = start?.state ?? null;
		this.past = [];
		this.future = [];
		this.checkpoints = start?.checkpoints ?? [];
		this.currentCheckpoint = start?.currentCheckpoint ?? -1;
		this.trial = start?.trial ?? null;
	}

	/** Start the same puzzle over from `state`: no undo, no trial, the checkpoints stay. */
	restart(state: S) {
		this.state = state;
		this.past = [];
		this.future = [];
		this.trial = null;
	}

	/** Move on to `next` as a new step, which ends redo. False if it is the same position. */
	push(next: S): boolean {
		if (this.state === null || sameData(next, this.state)) return false;
		this.past = [...this.past, this.state].slice(-MAX_UNDO);
		this.future = [];
		this.state = next;
		return true;
	}

	/** Go to `next` as an undoable step, even if it looks the same (e.g. a completed solution). */
	step(next: S): boolean {
		if (this.state === null) return false;
		this.past = [...this.past, this.state].slice(-MAX_UNDO);
		this.future = [];
		this.state = next;
		return true;
	}

	undo(): boolean {
		if (this.state === null || this.past.length === 0) return false;
		this.future = [this.state, ...this.future];
		this.state = this.past[this.past.length - 1];
		this.past = this.past.slice(0, -1);
		return true;
	}

	redo(): boolean {
		if (this.state === null || this.future.length === 0) return false;
		this.past = [...this.past, this.state];
		this.state = this.future[0];
		this.future = this.future.slice(1);
		return true;
	}

	// ---- Checkpoints ------------------------------------------------------------------------

	/** Overwrite the current checkpoint with the position, or add one if there is none yet. */
	saveCheckpoint(): boolean {
		if (this.state === null) return false;
		if (this.currentCheckpoint < 0) return this.addCheckpoint();
		const list = this.checkpoints.slice();
		list[this.currentCheckpoint] = this.state;
		this.checkpoints = list;
		return true;
	}

	addCheckpoint(): boolean {
		if (this.state === null || this.checkpoints.length >= MAX_CHECKPOINTS) return false;
		this.checkpoints = [...this.checkpoints, this.state];
		this.currentCheckpoint = this.checkpoints.length - 1;
		return true;
	}

	/**
	 * Go back to checkpoint `index`, as an undoable step unless the board shows it already. Returns
	 * whether the position changed (null if there is no such checkpoint).
	 */
	loadCheckpoint(index: number): boolean | null {
		const cp = this.checkpoints[index];
		if (!cp) return null;
		this.currentCheckpoint = index;
		return !sameData(cp, this.state) && this.step(cp);
	}

	deleteCheckpoint(index: number): boolean {
		if (!this.checkpoints[index]) return false;
		this.checkpoints = this.checkpoints.filter((_, i) => i !== index);
		if (this.currentCheckpoint >= index) this.currentCheckpoint--;
		if (this.currentCheckpoint < 0 && this.checkpoints.length) this.currentCheckpoint = 0;
		return true;
	}

	// ---- Trials -----------------------------------------------------------------------------

	/** Try something out: what changes from here on shows in the trial colour. */
	startTrial(): boolean {
		if (this.state === null || this.trial) return false;
		this.trial = this.state;
		return true;
	}

	/** The trial worked out: its marks stay and look like any other. */
	keepTrial(): boolean {
		if (!this.trial) return false;
		this.trial = null;
		return true;
	}

	/**
	 * The trial went wrong: back to where it began. Its moves leave the history, so that undo does
	 * not bring them back without their colour; a position no longer in it is an undoable step.
	 * Returns whether the position changed (null if no trial runs).
	 */
	dropTrial(): boolean | null {
		const base = this.trial;
		if (!base) return null;
		this.trial = null;
		if (sameData(this.state, base)) return false;
		const at = this.past.findLastIndex((s) => sameData(s, base));
		if (at < 0) return this.step(base);
		this.past = this.past.slice(0, at);
		this.future = [];
		this.state = base;
		return true;
	}
}
