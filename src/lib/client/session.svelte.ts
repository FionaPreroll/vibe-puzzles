import { formatDuration } from '../core/time';
import type { GameModule } from '../core/types';
import {
	decodePuzzleId,
	encodePuzzleId,
	periodKey,
	randomSeed,
	SPECIAL_RETENTION_DAYS,
	specialSeed,
	type Variant
} from '../core/variants';
import { currentPlayer, issuePuzzle, pullSave, pushSave, serverPuzzles, submitScore } from './api';
import { generate } from './generate';
import type { GameSettings } from './settings.svelte';
import { breakStreak, recordSolve } from './stats';
import { t, variantLabel } from '../i18n/index.svelte';
import type { ScoreResult } from './api';
import { keys, load, remove, save } from './storage';

export interface SavedGame<S = unknown> {
	version: 1;
	puzzleId: number;
	variant: string;
	puzzle: unknown;
	state: S;
	checkpoints: S[];
	currentCheckpoint: number;
	solved: boolean;
	startedAt: number;
	playMs: number;
	updatedAt: number;
	/** Puzzle issued by the server (ranked); its ID is 0 until solved. */
	ticket?: string;
}

export interface Message {
	kind: 'success' | 'error' | 'info';
	text: string;
}

export const MAX_CHECKPOINTS = 10;

/**
 * One game in progress: puzzle, player state, history, checkpoints, timers, persistence and
 * submission. Game specifics come from the GameModule.
 */
export class GameSession<P = unknown, S = unknown> {
	variantIndex = $state(0);
	/** 0 while the puzzle came from the server and is not solved yet (the ID reveals the seed). */
	puzzleId = $state(0);
	ticket = $state<string | null>(null);
	puzzle = $state.raw<P | null>(null);
	state = $state.raw<S | null>(null);
	past = $state.raw<S[]>([]);
	future = $state.raw<S[]>([]);
	checkpoints = $state.raw<S[]>([]);
	currentCheckpoint = $state(-1);
	lastChange = $state.raw<ReadonlySet<string>>(new Set());
	loading = $state(true);
	message = $state<Message | null>(null);

	/** Competitive clock start (epoch ms). */
	startedAt = $state(0);
	/** Personal play time accumulated before `runningSince`. */
	playMs = $state(0);
	runningSince = $state<number | null>(null);
	/** Paused with the Pause button (personal timer mode). */
	manualPause = $state(false);
	solved = $state(false);
	/** Final times once solved. */
	finalMs = $state(0);
	finalPlayMs = $state(0);
	submitting = $state(false);

	private active = true;
	private period: string | undefined;
	private saveKey = '';
	private pushTimer: ReturnType<typeof setTimeout> | null = null;
	private openToken = 0;
	private touched = false;

	constructor(
		readonly game: GameModule<P, S>,
		readonly settings: GameSettings
	) {}

	get variant(): Variant {
		return this.game.variants[this.variantIndex];
	}

	get readonly(): boolean {
		return this.solved || this.loading || this.paused;
	}

	get paused(): boolean {
		return this.manualPause && !!this.settings.values.personalTimer && !this.solved;
	}

	// ---- Loading ----------------------------------------------------------------------------

	/** Open a variant: resume its saved game, or start the requested / a new puzzle. */
	async open(variantKey: string, opts: { puzzleId?: number; shared?: string } = {}) {
		const token = ++this.openToken;
		let index = this.game.variants.findIndex((v) => v.key === variantKey);
		if (opts.puzzleId != null) {
			const decoded = decodePuzzleId(opts.puzzleId);
			if (this.game.variants[decoded.variantIndex]) index = decoded.variantIndex;
		}
		if (index < 0) index = 0;
		this.pauseClock();
		this.variantIndex = index;
		const v = this.variant;
		this.loading = true;
		this.message = null;

		let puzzleId = opts.puzzleId;
		this.period = undefined;
		if (v.special) {
			const current = encodePuzzleId(
				index,
				specialSeed(this.game.id, v.special, periodKey(v.special))
			);
			if (puzzleId == null || puzzleId === current) {
				puzzleId = current;
				this.period = periodKey(v.special);
			}
		}
		this.saveKey = `save:${this.game.id}:${v.key}${this.period ? `:${this.period}` : ''}`;
		if (v.special && !this.period) this.saveKey = `save:${this.game.id}:${v.key}:archive`;

		const local = load<SavedGame<S> | null>(this.saveKey, null);
		const resumable = (s: SavedGame<S> | null) =>
			!!s && !s.solved && (puzzleId == null || s.puzzleId === puzzleId) && !opts.shared;
		if (resumable(local) && this.restore(local!)) {
			this.finishLoading(token);
			this.syncFromServer(token);
			return;
		}
		// A requested regular puzzle is played locally; new and current special ones may come
		// from the server.
		const fromServer = !opts.shared && (opts.puzzleId == null || !!this.period);
		await this.start(fromServer ? null : puzzleId!, token, opts.shared);
		this.syncFromServer(token);
	}

	/** Start a fresh game of `puzzleId`, or of a new puzzle (from the server if it issues them). */
	private async start(puzzleId: number | null, token: number, shared?: string) {
		this.loading = true;
		let puzzle: P;
		let ticket: string | null = null;
		let startedAt = Date.now();
		try {
			const issued = puzzleId == null ? await this.fromServer() : null;
			if (issued) {
				({ puzzle, ticket, issuedAt: startedAt } = issued);
				puzzleId = issued.puzzleId ?? 0;
			} else {
				puzzleId ??= this.localPuzzleId();
				const { variantIndex, seed } = decodePuzzleId(puzzleId);
				puzzle = await generate<P>(this.game.id, variantIndex, seed);
			}
		} catch (e) {
			if (token === this.openToken)
				this.message = { kind: 'error', text: t('session.createFailed', { error: String(e) }) };
			return;
		}
		if (token !== this.openToken) return;
		this.puzzleId = puzzleId;
		this.ticket = ticket;
		this.puzzle = puzzle;
		const sharedState = shared ? this.game.decodeState(puzzle, shared) : null;
		this.state = sharedState ?? this.game.emptyState(puzzle);
		this.past = [];
		this.future = [];
		this.checkpoints = [];
		this.currentCheckpoint = -1;
		this.lastChange = new Set();
		this.solved = false;
		this.manualPause = false;
		this.startedAt = startedAt;
		this.playMs = 0;
		this.touched = false;
		this.finishLoading(token);
		this.persist();
		if (!ticket) this.prefetch();
	}

	/** The next local puzzle: prefetched, the current special or a random one. */
	private localPuzzleId(): number {
		const v = this.variant;
		if (v.special) {
			return encodePuzzleId(
				this.variantIndex,
				specialSeed(this.game.id, v.special, periodKey(v.special))
			);
		}
		const seed = this.nextSeed ?? randomSeed();
		this.nextSeed = null;
		return encodePuzzleId(this.variantIndex, seed);
	}

	/** Ask the server for a puzzle; null (play locally, unranked) if it does not issue them. */
	private async fromServer(): Promise<{
		puzzle: P;
		ticket: string;
		issuedAt: number;
		puzzleId: number | null;
	} | null> {
		if (!(await serverPuzzles())) return null;
		try {
			const issued = await issuePuzzle<P>(this.game.id, this.variant.key);
			if (this.game.isValidPuzzle(issued.puzzle, this.variant)) return issued;
		} catch {
			/* fall back to a local puzzle */
		}
		this.message = { kind: 'info', text: t('session.serverFailed') };
		return null;
	}

	private restore(s: SavedGame<S>): boolean {
		if (!this.game.isValidPuzzle(s.puzzle, this.variant)) return false;
		const puzzle = s.puzzle as P;
		if (!this.game.isValidState(puzzle, s.state)) return false;
		this.puzzleId = s.puzzleId;
		this.ticket = s.ticket ?? null;
		this.puzzle = puzzle;
		this.state = s.state;
		this.past = [];
		this.future = [];
		this.checkpoints = (s.checkpoints ?? []).filter((c) => this.game.isValidState(puzzle, c));
		this.currentCheckpoint = Math.min(s.currentCheckpoint ?? -1, this.checkpoints.length - 1);
		this.lastChange = new Set();
		this.solved = false;
		this.manualPause = false;
		this.startedAt = s.startedAt;
		this.playMs = s.playMs;
		this.touched = false;
		return true;
	}

	private finishLoading(token: number) {
		if (token !== this.openToken) return;
		this.loading = false;
		this.resumeClock();
	}

	/** Pick up a newer save of the same slot from another device. */
	private async syncFromServer(token: number) {
		const remote = await pullSave<SavedGame<S>>(this.saveKey);
		if (!remote || token !== this.openToken || this.touched) return;
		const local = load<SavedGame<S> | null>(this.saveKey, null);
		if (local && remote.data.updatedAt <= local.updatedAt) return;
		if (remote.data.solved) return;
		this.pauseClock();
		if (this.restore(remote.data)) {
			save(this.saveKey, remote.data);
			this.message = { kind: 'info', text: t('session.continued') };
		}
		this.resumeClock();
	}

	/** Re-check the server when the page becomes visible again (device switch). */
	refreshFromServer() {
		if (!this.loading && !this.solved && currentPlayer()) this.syncFromServer(this.openToken);
	}

	async newPuzzle() {
		if (this.loading) return;
		if (!this.solved && this.past.length > 0) breakStreak(this.game.id, this.variant.key);
		const v = this.variant;
		if (v.special) {
			await this.open(v.key);
			return;
		}
		const token = ++this.openToken;
		this.pauseClock();
		this.message = null;
		await this.start(null, token);
	}

	/** Generate the next puzzle of this variant in the background. */
	private nextSeed: number | null = null;
	private prefetch() {
		if (this.variant.special) return;
		this.nextSeed = randomSeed();
		generate(this.game.id, this.variantIndex, this.nextSeed).catch(() => undefined);
	}

	// ---- Moves and history ------------------------------------------------------------------

	move(next: S, changed: string[]) {
		if (this.readonly || !this.puzzle || !this.state) return;
		const after = this.game.afterMove?.(this.puzzle, next, this.settings.values) ?? next;
		if (JSON.stringify(after) === JSON.stringify(this.state)) return;
		this.past = [...this.past, this.state].slice(-500);
		this.future = [];
		this.state = after;
		this.lastChange = new Set(changed);
		this.touched = true;
		this.persist();
		this.checkSolved();
	}

	undo() {
		if (this.readonly || this.past.length === 0 || !this.state) return;
		this.future = [this.state, ...this.future];
		this.state = this.past[this.past.length - 1];
		this.past = this.past.slice(0, -1);
		this.lastChange = new Set();
		this.touched = true;
		this.persist();
	}

	redo() {
		if (this.readonly || this.future.length === 0 || !this.state) return;
		this.past = [...this.past, this.state];
		this.state = this.future[0];
		this.future = this.future.slice(1);
		this.lastChange = new Set();
		this.touched = true;
		this.persist();
	}

	/** Replace the state as an undoable step without running move hooks. */
	private replace(next: S) {
		if (!this.state) return;
		this.past = [...this.past, this.state];
		this.future = [];
		this.state = next;
		this.lastChange = new Set();
		this.touched = true;
	}

	startOver() {
		if (!this.puzzle || this.loading) return;
		this.state = this.game.emptyState(this.puzzle);
		this.past = [];
		this.future = [];
		this.lastChange = new Set();
		this.solved = false;
		this.manualPause = false;
		// The server measures ranked time from when it issued the puzzle.
		if (!this.ticket) this.startedAt = Date.now();
		this.playMs = 0;
		this.runningSince = null;
		this.message = null;
		this.touched = true;
		this.resumeClock();
		this.persist();
	}

	// ---- Checkpoints ------------------------------------------------------------------------

	saveCheckpoint() {
		if (!this.state || this.loading) return;
		if (this.currentCheckpoint < 0) return this.addCheckpoint();
		const list = this.checkpoints.slice();
		list[this.currentCheckpoint] = this.state;
		this.checkpoints = list;
		this.persist();
	}

	addCheckpoint() {
		if (!this.state || this.loading || this.checkpoints.length >= MAX_CHECKPOINTS) return;
		this.checkpoints = [...this.checkpoints, this.state];
		this.currentCheckpoint = this.checkpoints.length - 1;
		this.persist();
	}

	loadCheckpoint(index: number) {
		const cp = this.checkpoints[index];
		if (!cp || this.readonly) return;
		this.currentCheckpoint = index;
		if (JSON.stringify(cp) !== JSON.stringify(this.state)) this.replace(cp);
		this.persist();
	}

	deleteCheckpoint(index: number) {
		if (!this.checkpoints[index]) return;
		this.checkpoints = this.checkpoints.filter((_, i) => i !== index);
		if (this.currentCheckpoint >= index) this.currentCheckpoint--;
		if (this.currentCheckpoint < 0 && this.checkpoints.length) this.currentCheckpoint = 0;
		this.persist();
	}

	// ---- Timers -----------------------------------------------------------------------------

	/** Called by the page when visibility or focus changes. */
	setActive(active: boolean) {
		this.active = active;
		if (active) this.resumeClock();
		else if (!this.settings.values.hideTimer) this.pauseClock();
	}

	setManualPause(paused: boolean) {
		this.manualPause = paused;
		if (paused) this.pauseClock();
		else this.resumeClock();
	}

	private resumeClock() {
		if (this.runningSince != null || this.solved || this.loading || this.paused) return;
		if (!this.active && !this.settings.values.hideTimer) return;
		this.runningSince = Date.now();
	}

	private pauseClock() {
		if (this.runningSince == null) return;
		this.playMs += Date.now() - this.runningSince;
		this.runningSince = null;
	}

	elapsed(now: number): number {
		return this.solved ? this.finalMs : Math.max(0, now - this.startedAt);
	}

	personal(now: number): number {
		if (this.solved) return this.finalPlayMs;
		return this.playMs + (this.runningSince != null ? now - this.runningSince : 0);
	}

	// ---- Completion -------------------------------------------------------------------------

	private checkSolved() {
		if (!this.settings.values.autoSubmit || !this.puzzle || !this.state) return;
		if (this.game.isSolved(this.puzzle, this.state)) this.submit(true);
		else if (this.game.acceptAlternative?.(this.puzzle, this.state, this.settings.values)) {
			this.submit(true);
		}
	}

	/** Done: verify, stop the clock, record and submit the result. */
	async submit(auto = false) {
		if (!this.puzzle || !this.state || this.solved || this.loading) return;
		let state = this.state;
		if (!this.game.isSolved(this.puzzle, state)) {
			const alt = this.game.acceptAlternative?.(this.puzzle, state, this.settings.values);
			if (!alt) {
				if (!auto) this.message = { kind: 'error', text: t('session.notSolved') };
				return;
			}
			this.replace(alt);
			state = alt;
		}
		const now = Date.now();
		this.pauseClock();
		this.finalMs = now - this.startedAt;
		this.finalPlayMs = this.playMs;
		this.solved = true;
		const competitive = !this.settings.values.personalTimer;
		const shown = competitive ? this.finalMs : this.finalPlayMs;
		recordSolve(
			this.game.id,
			this.variant.key,
			this.puzzleId,
			shown,
			this.period,
			this.variant.special
		);
		this.persist();
		this.message = { kind: 'success', text: t('session.solved', { time: formatDuration(shown) }) };

		this.submitting = true;
		try {
			const res = await submitScore({
				game: this.game.id,
				variant: this.variant.key,
				puzzleId: this.puzzleId,
				puzzle: this.puzzle,
				answer: this.game.answer(this.puzzle, state),
				timeMs: this.finalMs,
				playMs: this.finalPlayMs,
				competitive,
				ticket: this.ticket ?? undefined
			});
			if (res?.puzzleId && !this.puzzleId) {
				this.puzzleId = res.puzzleId;
				this.persist();
			}
			if (res)
				this.message = { kind: res.ok ? 'success' : 'error', text: this.scoreText(res, shown) };
		} catch (e) {
			this.message = {
				kind: 'info',
				text: t('session.uploadFailed', {
					time: formatDuration(shown),
					error: (e as Error).message
				})
			};
		} finally {
			this.submitting = false;
		}
	}

	private scoreText(res: ScoreResult, shown: number): string {
		const time = formatDuration(res.timeMs ?? shown);
		switch (res.code) {
			case 'wrong':
				return t('session.wrong');
			case 'repeat':
				return t('session.repeat', { time });
			case 'personal':
				return t('session.unrankedPersonal', { time });
			case 'local':
				return t('session.unrankedLocal', { time });
			case 'ranked': {
				const text = t('session.ranked', {
					time,
					rank: res.rank ?? '–',
					total: res.total ?? '–',
					variant: variantLabel(this.variant)
				});
				const best = res.bestMs != null && res.bestMs < (res.timeMs ?? Infinity);
				return best
					? `${text} ${t('session.yourBest', { time: formatDuration(res.bestMs!) })}`
					: text;
			}
			default:
				return res.message;
		}
	}

	// ---- Persistence ------------------------------------------------------------------------

	persist() {
		if (!this.puzzle || !this.state || !this.saveKey) return;
		const running = this.runningSince != null ? Date.now() - this.runningSince : 0;
		const data: SavedGame<S> = {
			version: 1,
			puzzleId: this.puzzleId,
			variant: this.variant.key,
			puzzle: this.puzzle,
			state: this.state,
			checkpoints: this.checkpoints,
			currentCheckpoint: this.currentCheckpoint,
			solved: this.solved,
			startedAt: this.startedAt,
			playMs: this.playMs + running,
			updatedAt: Date.now(),
			...(this.ticket ? { ticket: this.ticket } : {})
		};
		save(this.saveKey, data);
		if (this.pushTimer) clearTimeout(this.pushTimer);
		const key = this.saveKey;
		this.pushTimer = setTimeout(() => pushSave(key, data, data.updatedAt), 1500);
	}

	/** Flush the play time into the save (page hide / unload). */
	flush() {
		this.persist();
	}
}

/** Remove saves of special periods that are over. */
export function cleanupSpecialSaves() {
	const now = Date.now();
	for (const key of keys('save:')) {
		const parts = key.split(':');
		if (parts.length !== 4 || parts[3] === 'archive') continue;
		const kind = parts[2] as keyof typeof SPECIAL_RETENTION_DAYS;
		const days = SPECIAL_RETENTION_DAYS[kind];
		if (!days) continue;
		const saved = load<SavedGame | null>(key, null);
		if (!saved || now - saved.updatedAt > days * 86400000) remove(key);
	}
}

/** Remove every saved game except the given keys (storage full). */
export function clearOldSaves(keep: string[] = []) {
	for (const key of keys('save:')) if (!keep.includes(key)) remove(key);
}
