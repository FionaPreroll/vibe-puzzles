import { formatDuration } from '../core/time';
import type { GameModule, Hint } from '../core/types';
import {
	decodePuzzleId,
	encodePuzzleId,
	periodKey,
	randomSeed,
	regularCounterpart,
	SPECIAL_RETENTION_DAYS,
	specialSeed,
	type Variant
} from '../core/variants';
import { currentPlayer, issuePuzzle, pullSave, pushSave, serverPuzzles, submitScore } from './api';
import { findInBank, loadPuzzleSource, pickFromBank } from './bank';
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
	/** A hint was shown: no best time, not ranked. */
	hinted?: boolean;
}

export interface Message {
	kind: 'success' | 'error' | 'info';
	text: string;
}

export const MAX_CHECKPOINTS = 10;

/** What to open: a puzzle by ID, optionally with a shared position (encoded state). */
export interface OpenOptions {
	puzzleId?: number;
	shared?: string;
}

/**
 * One game in progress: puzzle, player state, history, checkpoints, timers, persistence and
 * submission. Game specifics come from the GameModule.
 */
export class GameSession<P = unknown, S = unknown> {
	variantIndex = $state(0);
	/** 0 while the puzzle came from the server and is not solved yet (the ID reveals the seed). */
	puzzleId = $state(0);
	ticket = $state<string | null>(null);
	/** Where the current puzzle came from. */
	source = $state<'local' | 'bank' | 'server'>('local');
	puzzle = $state.raw<P | null>(null);
	state = $state.raw<S | null>(null);
	past = $state.raw<S[]>([]);
	future = $state.raw<S[]>([]);
	checkpoints = $state.raw<S[]>([]);
	currentCheckpoint = $state(-1);
	lastChange = $state.raw<ReadonlySet<string>>(new Set());
	/** The hint on the board, until the next change. */
	hint = $state.raw<Hint | null>(null);
	/** A hint was shown for this puzzle. */
	hinted = $state(false);
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
	/** Save key of the puzzle on the board; differs from `saveKey` while another one loads. */
	private puzzleKey = '';
	private lastOpen: [string, OpenOptions] = ['', {}];
	private pushTimer: ReturnType<typeof setTimeout> | null = null;
	private openToken = 0;
	private touched = false;

	constructor(
		readonly game: GameModule<P, S>,
		readonly settings: GameSettings
	) {}

	/** Storage key of the game on the board. */
	get slot(): string {
		return this.saveKey;
	}

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
	async open(variantKey: string, opts: OpenOptions = {}) {
		const token = ++this.openToken;
		this.lastOpen = [variantKey, opts];
		const target = this.target(variantKey, opts);
		this.pauseClock();
		this.variantIndex = target.index;
		this.loading = true;
		this.message = null;
		this.period = target.period;
		this.saveKey = target.saveKey;

		const local = load<SavedGame<S> | null>(this.saveKey, null);
		if (this.resumable(local, target.puzzleId, opts) && this.restore(local!)) {
			this.finishLoading(token);
			this.syncFromServer(token);
			return;
		}
		// A requested regular puzzle is played locally; new and current special ones may come
		// from the server.
		const fromServer = !opts.shared && (opts.puzzleId == null || !!this.period);
		await this.start(fromServer ? null : target.puzzleId!, token, opts.shared);
		this.syncFromServer(token);
	}

	/** The variant, puzzle, special period and save slot that `open` would use. */
	private target(variantKey: string, opts: OpenOptions) {
		let index = this.game.variants.findIndex((v) => v.key === variantKey);
		if (opts.puzzleId != null) {
			const decoded = decodePuzzleId(opts.puzzleId);
			if (this.game.variants[decoded.variantIndex]) index = decoded.variantIndex;
		}
		if (index < 0) index = 0;
		const v = this.game.variants[index];
		let puzzleId = opts.puzzleId;
		let period: string | undefined;
		if (v.special) {
			const current = encodePuzzleId(
				index,
				specialSeed(this.game.id, v.special, periodKey(v.special))
			);
			if (puzzleId == null || puzzleId === current) {
				puzzleId = current;
				period = periodKey(v.special);
			}
		}
		const slot = period ?? (v.special ? 'archive' : undefined);
		const saveKey = `save:${this.game.id}:${v.key}${slot ? `:${slot}` : ''}`;
		return { index, puzzleId, period, saveKey };
	}

	/** Whether `open` continues this saved game rather than starting the requested one. */
	private resumable(s: SavedGame<S> | null, puzzleId: number | undefined, opts: OpenOptions) {
		return !!s && !s.solved && (puzzleId == null || s.puzzleId === puzzleId) && !opts.shared;
	}

	/**
	 * Whether opening this (e.g. a link or a puzzle ID) would replace an unfinished game: every
	 * puzzle type keeps one game, and the requested puzzle would take its place.
	 */
	replacesGame(variantKey: string, opts: OpenOptions): boolean {
		const { index, puzzleId, saveKey } = this.target(variantKey, opts);
		const saved = load<SavedGame<S> | null>(saveKey, null);
		if (!saved || saved.solved || this.resumable(saved, puzzleId, opts)) return false;
		if (!this.game.isValidPuzzle(saved.puzzle, this.game.variants[index])) return false;
		return this.hasProgress(saved);
	}

	/** Whether "New puzzle" would throw away a started game (special types keep theirs). */
	get newPuzzleDiscards(): boolean {
		if (this.variant.special || this.solved || this.loading || !this.puzzle || !this.state) {
			return false;
		}
		const empty = this.game.emptyState(this.puzzle);
		return this.checkpoints.length > 0 || JSON.stringify(this.state) !== JSON.stringify(empty);
	}

	/** Start a fresh game of `puzzleId`, or of a new puzzle (from the server if it issues them). */
	private async start(puzzleId: number | null, token: number, shared?: string) {
		this.loading = true;
		let puzzle: P;
		let ticket: string | null = null;
		let startedAt = Date.now();
		let source: 'local' | 'bank' | 'server' = 'local';
		try {
			const issued = puzzleId == null ? await this.fromServer() : null;
			const banked = puzzleId == null && !issued ? await this.fromBank() : null;
			if (issued) {
				({ puzzle, ticket, issuedAt: startedAt } = issued);
				puzzleId = issued.puzzleId ?? 0;
				source = 'server';
			} else if (banked) {
				({ id: puzzleId, puzzle } = banked);
				source = 'bank';
			} else {
				puzzleId ??= this.localPuzzleId();
				const { variantIndex, seed } = decodePuzzleId(puzzleId);
				const v = this.game.variants[variantIndex];
				// A puzzle from the collection needs no generating (big ones take a while).
				const stored = v ? await findInBank<P>(this.game.id, v, puzzleId) : null;
				puzzle =
					stored && this.game.isValidPuzzle(stored, v)
						? stored
						: await generate<P>(this.game.id, variantIndex, seed);
			}
		} catch (e) {
			if (token !== this.openToken) return;
			this.message = { kind: 'error', text: t('session.createFailed', { error: String(e) }) };
			// The previous puzzle stays playable, unless it belongs to another slot (another type).
			if (this.puzzleKey !== this.saveKey) this.clearPuzzle();
			this.finishLoading(token);
			return;
		}
		if (token !== this.openToken) return;
		this.puzzleId = puzzleId;
		this.ticket = ticket;
		this.source = source;
		this.puzzle = puzzle;
		this.puzzleKey = this.saveKey;
		const sharedState = shared ? this.game.decodeState(puzzle, shared) : null;
		this.state = sharedState ?? this.game.emptyState(puzzle);
		this.past = [];
		this.future = [];
		this.checkpoints = [];
		this.currentCheckpoint = -1;
		this.lastChange = new Set();
		this.hint = null;
		this.hinted = false;
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

	/** A new puzzle from the collection, if the player's choice of source says so. */
	private async fromBank(): Promise<{ id: number; puzzle: P } | null> {
		const source = loadPuzzleSource();
		if (this.variant.special || source === 'local') return null;
		if (source === 'mixed' && Math.random() < 0.5) return null;
		const pick = await pickFromBank<P>(this.game.id, this.variant.key);
		return pick && this.game.isValidPuzzle(pick.puzzle, this.variant) ? pick : null;
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
		this.source = s.ticket ? 'server' : 'local';
		this.changedAt = s.updatedAt;
		this.puzzle = puzzle;
		this.puzzleKey = this.saveKey;
		this.state = s.state;
		this.past = [];
		this.future = [];
		this.checkpoints = (s.checkpoints ?? []).filter((c) => this.game.isValidState(puzzle, c));
		this.currentCheckpoint = Math.min(s.currentCheckpoint ?? -1, this.checkpoints.length - 1);
		this.lastChange = new Set();
		this.hint = null;
		this.hinted = !!s.hinted;
		this.solved = false;
		this.manualPause = false;
		this.startedAt = s.startedAt;
		this.playMs = s.playMs;
		this.touched = false;
		return true;
	}

	/** No puzzle on the board: loading one failed, see `retry`. */
	private clearPuzzle() {
		this.puzzle = null;
		this.state = null;
		this.puzzleKey = '';
		this.puzzleId = 0;
		this.ticket = null;
		this.past = [];
		this.future = [];
		this.checkpoints = [];
		this.currentCheckpoint = -1;
		this.lastChange = new Set();
		this.hint = null;
		this.hinted = false;
		this.solved = false;
	}

	/** Open again what the last `open` asked for (after it failed). */
	retry() {
		return this.open(...this.lastOpen);
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
		// A newer local game wins, unless nobody has played it yet: then the other device's game
		// continues here.
		if (local && remote.data.updatedAt <= local.updatedAt && this.hasProgress(local)) return;
		if (remote.data.solved || !this.hasProgress(remote.data)) return;
		// Server-issued puzzles keep their ID secret (0) until solved, so the ticket tells them apart.
		const same =
			local?.puzzleId === remote.data.puzzleId &&
			(local.ticket ?? null) === (remote.data.ticket ?? null);
		if (same && remote.data.updatedAt <= local!.updatedAt) return;
		this.pauseClock();
		if (this.pushTimer) clearTimeout(this.pushTimer);
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

	/**
	 * Start the next puzzle. A special type keeps its game: an older one leads back to the
	 * current period, the current one on to the regular type of the same size and difficulty.
	 */
	async newPuzzle() {
		if (this.loading) return;
		const v = this.variant;
		if (v.special) {
			await this.open(this.period ? regularCounterpart(this.game.variants, v).key : v.key);
			return;
		}
		if (!this.solved && this.past.length > 0) breakStreak(this.game.id, v.key);
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
		this.clearHint();
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
		this.clearHint();
		this.touched = true;
		this.persist();
	}

	redo() {
		if (this.readonly || this.future.length === 0 || !this.state) return;
		this.past = [...this.past, this.state];
		this.state = this.future[0];
		this.future = this.future.slice(1);
		this.lastChange = new Set();
		this.clearHint();
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
		this.clearHint();
		this.touched = true;
	}

	startOver() {
		if (!this.puzzle || this.loading) return;
		this.state = this.game.emptyState(this.puzzle);
		this.past = [];
		this.future = [];
		this.lastChange = new Set();
		this.clearHint();
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

	/** Whether the game has hints for the puzzle type being played. */
	get canHint(): boolean {
		return !!this.game.hint && (this.game.hintsFor?.(this.variant) ?? true);
	}

	/** Point at the next step, or at wrong marks. The game then counts as hinted. */
	showHint() {
		if (this.readonly || !this.puzzle || !this.state || !this.game.hint || !this.canHint) return;
		const hint = this.game.hint(this.puzzle, this.state);
		if (!hint) return;
		this.hint = hint;
		this.hinted = true;
		this.message = {
			kind: hint.kind === 'mistake' ? 'error' : 'info',
			text: hint.text.map((key) => t(key, hint.params)).join(' ')
		};
		this.persist();
	}

	/** The board changed: the hint and its message no longer apply. */
	private clearHint() {
		if (!this.hint) return;
		this.hint = null;
		this.message = null;
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
		if (this.runningSince != null || !this.puzzle || this.solved || this.loading || this.paused)
			return;
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
			this.variant.special,
			this.hinted
		);
		this.persist();
		this.message = {
			kind: 'success',
			text: t('session.solved', { time: formatDuration(shown, true) })
		};

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
				hinted: this.hinted,
				ticket: this.ticket ?? undefined
			});
			if (res?.puzzleId && !this.puzzleId) {
				this.puzzleId = res.puzzleId;
				this.persist();
			}
			if (res) {
				const kind = res.ok ? 'success' : res.code === 'expired' ? 'info' : 'error';
				this.message = { kind, text: this.scoreText(res, shown) };
			}
		} catch (e) {
			this.message = {
				kind: 'info',
				text: t('session.uploadFailed', {
					time: formatDuration(shown, true),
					error: (e as Error).message
				})
			};
		} finally {
			this.submitting = false;
		}
	}

	private scoreText(res: ScoreResult, shown: number): string {
		const time = formatDuration(res.timeMs ?? shown, true);
		switch (res.code) {
			case 'wrong':
				return t('session.wrong');
			case 'repeat':
				return t('session.repeat', { time });
			case 'personal':
				return t('session.unrankedPersonal', { time });
			case 'local':
				return t('session.unrankedLocal', { time });
			case 'hinted':
				return t('session.unrankedHinted', { time });
			case 'expired':
				return t('session.expired', { time });
			case 'ranked': {
				const text = t('session.ranked', {
					time,
					rank: res.rank ?? '–',
					total: res.total ?? '–',
					variant: variantLabel(this.variant)
				});
				const best = res.bestMs != null && res.bestMs < (res.timeMs ?? Infinity);
				return best
					? `${text} ${t('session.yourBest', { time: formatDuration(res.bestMs!, true) })}`
					: text;
			}
			default:
				return res.message;
		}
	}

	// ---- Persistence ------------------------------------------------------------------------

	/** Whether a saved game is worth keeping over another one: any move, checkpoint or solve. */
	private hasProgress(save: SavedGame<S>): boolean {
		if (save.solved || save.checkpoints?.length) return true;
		const empty = this.game.emptyState(save.puzzle as P);
		return JSON.stringify(save.state) !== JSON.stringify(empty);
	}

	/** When the game last changed; decides which save wins between devices. */
	private changedAt = 0;

	/** Save locally and, after a short pause, to the server. `changed` is false for a plain flush. */
	persist(changed = true) {
		// Never save the previous puzzle into the slot of one that is still loading.
		if (!this.puzzle || !this.state || !this.saveKey || this.puzzleKey !== this.saveKey) return;
		if (changed || !this.changedAt) this.changedAt = Date.now();
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
			updatedAt: this.changedAt,
			...(this.ticket ? { ticket: this.ticket } : {}),
			...(this.hinted ? { hinted: true } : {})
		};
		save(this.saveKey, data);
		if (this.pushTimer) clearTimeout(this.pushTimer);
		// An untouched new puzzle is not uploaded, so it cannot replace a game on another device.
		if (!this.hasProgress(data)) return;
		const key = this.saveKey;
		this.pushTimer = setTimeout(() => pushSave(key, data, data.updatedAt), 1500);
	}

	/** Flush the play time into the save (page hide / unload). */
	flush() {
		this.persist(false);
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

/**
 * Make room when storage is full, never touching `keep` (the game being played): first remove the
 * saves of solved games, which are never resumed; then, once `agree` says so, the unfinished game
 * that changed longest ago. Returns whether anything was removed.
 */
export function freeSaveSpace(keep: string, agree: () => boolean): boolean {
	const others = keys('save:')
		.filter((key) => key !== keep)
		.map((key) => ({ key, save: load<SavedGame | null>(key, null) }));
	const solved = others.filter((o) => !o.save || o.save.solved);
	if (solved.length) {
		for (const o of solved) remove(o.key);
		return true;
	}
	if (!others.length || !agree()) return false;
	const age = (o: (typeof others)[number]) => o.save?.updatedAt ?? 0;
	remove(others.reduce((oldest, o) => (age(o) < age(oldest) ? o : oldest)).key);
	return true;
}
