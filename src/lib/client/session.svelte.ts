import { formatDuration } from '../core/time';
import type { BasePuzzle, GameModule, Hint } from '../core/types';
import {
	decodePuzzleId,
	encodePuzzleId,
	isPlayable,
	periodKey,
	regularCounterpart,
	specialSeed,
	type SpecialKind,
	type Variant
} from '../core/variants';
import { t } from '../i18n/index.svelte';
import { currentPlayer, pullSave, submitScore } from './api';
import { Clock } from './session/clock.svelte';
import { History, type HistoryStart } from './session/history.svelte';
import { message, scoreMessage, type Message } from './session/messages';
import { PuzzleSource, type FoundPuzzle, type PuzzleOrigin } from './session/puzzleSource';
import { SaveSlot } from './session/saveSlot';
import { hasProgress, playableSave, remoteWins, type PlayableSave } from './session/saves';
import type { GameSettings } from './settings.svelte';
import { syncPeriods } from './periodSync';
import { breakStreak, notePeriodSolved, recordSolve } from './stats';
import { load } from './storage';
import { saveKey } from './storageKeys';

/** What to open: a puzzle by ID, optionally with a shared position (encoded state). */
export interface OpenOptions {
	puzzleId?: number;
	shared?: string;
}

/** The session of any game: the game page passes its puzzle and state only back to the same game. */
export type AnySession = GameSession<BasePuzzle, unknown, string>;

/** A game to put on the board: a new puzzle or a saved game, with everything that belongs to it. */
interface ShownGame<P, S> extends Omit<FoundPuzzle<P>, 'startedAt'> {
	history: HistoryStart<S>;
	hints: number;
	assisted: boolean;
	startedAt: number;
	playMs: number;
}

/**
 * One game in progress, the single object the game page talks to. It composes the parts in
 * `session/`: where puzzles come from (`PuzzleSource`), the position and its history
 * (`History`), the clocks (`Clock`) and the save slot (`SaveSlot`), and adds what joins them:
 * opening and resuming games, hints, following other tabs and devices, and submitting a solve.
 * Game specifics come from the GameModule.
 */
export class GameSession<P extends BasePuzzle = BasePuzzle, S = unknown, K extends string = never> {
	variantIndex = $state(0);
	/** 0 while the puzzle came from the server and is not solved yet (the ID reveals the seed). */
	puzzleId = $state(0);
	ticket = $state<string | null>(null);
	/** Where the current puzzle came from. */
	source = $state<PuzzleOrigin>('local');
	puzzle = $state.raw<P | null>(null);
	lastChange = $state.raw<ReadonlySet<string>>(new Set());
	/**
	 * The hint on the board: a step until the next change, wrong marks until the player has changed
	 * them all or closes it.
	 */
	hint = $state.raw<Hint | null>(null);
	/** Whether the hint shows its result, or only its first look (`Hint.teaser`). */
	hintFull = $state(false);
	/** How many hints were shown for this puzzle. */
	hints = $state(0);
	/** A setting that counts as a hint was on during this game (counted once in `hints`). */
	assisted = $state(false);
	loading = $state(true);
	/** Raw state: a proxy would keep the text of the first read and not follow the language. */
	message = $state.raw<Message | null>(null);
	solved = $state(false);
	submitting = $state(false);

	/** The hint as it was found, and the position it was found in. */
	private hintFound = $state.raw<{ hint: Hint; at: S; message: Message } | null>(null);
	private readonly history = new History<S>();
	private readonly clock = new Clock(() => this.clockMayRun);
	private readonly saves: SaveSlot<P, S>;
	private readonly puzzles: PuzzleSource<P>;
	private period: string | undefined;
	private lastOpen: [string, OpenOptions] = ['', {}];
	/** Counts `open` and `newPuzzle` calls: a load that finishes after a newer one started is dropped. */
	private openToken = 0;
	/** The player changed the game since it was shown: a save from another device no longer replaces it. */
	private touched = false;
	/** When the game on the board was solved (epoch ms), 0 while it is not. */
	private solvedAt = 0;

	constructor(
		readonly game: GameModule<P, S, K>,
		readonly settings: GameSettings<K>
	) {
		this.saves = new SaveSlot(game);
		this.puzzles = new PuzzleSource(game);
	}

	/** Storage key of the game on the board. */
	get slot(): string {
		return this.saves.key;
	}

	get variant(): Variant {
		return this.game.variants[this.variantIndex];
	}

	get readonly(): boolean {
		return this.solved || this.loading || this.paused;
	}

	get paused(): boolean {
		return this.clock.manualPause && !!this.settings.values.personalTimer && !this.solved;
	}

	// The position and its history (`History`), as the page reads them.

	get state(): S | null {
		return this.history.state;
	}
	get past(): S[] {
		return this.history.past;
	}
	get future(): S[] {
		return this.history.future;
	}
	get checkpoints(): S[] {
		return this.history.checkpoints;
	}
	get currentCheckpoint(): number {
		return this.history.currentCheckpoint;
	}
	/**
	 * The position a trial began from, while one runs: the board draws what changed since in the
	 * trial colour, until the player keeps the trial or goes back to this position.
	 */
	get trial(): S | null {
		return this.history.trial;
	}

	// The clocks (`Clock`), as the page reads them.

	/** Competitive clock start (epoch ms). */
	get startedAt(): number {
		return this.clock.startedAt;
	}
	/** Personal play time accumulated before `runningSince`. */
	get playMs(): number {
		return this.clock.playMs;
	}
	get runningSince(): number | null {
		return this.clock.runningSince;
	}
	/** Paused with the Pause button (personal timer mode). */
	get manualPause(): boolean {
		return this.clock.manualPause;
	}
	/** Final times once solved. */
	get finalMs(): number {
		return this.clock.finalMs;
	}
	get finalPlayMs(): number {
		return this.clock.finalPlayMs;
	}

	// ---- Loading ----------------------------------------------------------------------------

	/** Open a variant: resume its saved game, or start the requested / a new puzzle. */
	async open(variantKey: string, opts: OpenOptions = {}) {
		const token = ++this.openToken;
		this.lastOpen = [variantKey, opts];
		const target = this.target(variantKey, opts);
		this.clock.pause();
		this.variantIndex = target.index;
		this.loading = true;
		this.message = null;
		this.period = target.period;
		this.saves.select(target.saveKey);

		const local = this.saves.playable(this.variant);
		// The current special puzzle is played once: solved, it stays solved.
		if (local?.solved && this.period && !opts.shared) {
			this.showSolved(local);
			this.finishLoading(token);
			return;
		}
		if (local && this.resumable(local, target.puzzleId, opts)) {
			this.restore(local);
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
		const variants = this.game.variants;
		let index = variants.findIndex((v) => v.key === variantKey);
		let puzzleId = opts.puzzleId;
		if (puzzleId != null) {
			const decoded = decodePuzzleId(puzzleId);
			if (isPlayable(variants[decoded.variantIndex])) index = decoded.variantIndex;
			else puzzleId = undefined;
		}
		// A type that is only announced opens the first playable one.
		if (!isPlayable(variants[index])) index = variants.findIndex((v) => isPlayable(v));
		const v = variants[index];
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
		const key = saveKey({ game: this.game.id, variant: v.key, period, archive: !!v.special });
		return { index, puzzleId, period, saveKey: key };
	}

	/** Whether `open` continues this saved game rather than starting the requested one. */
	private resumable(s: PlayableSave<P, S>, puzzleId: number | undefined, opts: OpenOptions) {
		return !s.solved && (puzzleId == null || s.puzzleId === puzzleId) && !opts.shared;
	}

	/**
	 * Whether opening this (e.g. a link or a puzzle ID) would replace an unfinished game: every
	 * puzzle type keeps one game, and the requested puzzle would take its place.
	 */
	replacesGame(variantKey: string, opts: OpenOptions): boolean {
		const { index, puzzleId, saveKey: key } = this.target(variantKey, opts);
		const saved = playableSave(this.game, this.game.variants[index], load<unknown>(key, null));
		if (!saved || saved.solved || this.resumable(saved, puzzleId, opts)) return false;
		return hasProgress(this.game, saved);
	}

	/** Whether "New puzzle" would throw away a started game (special types keep theirs). */
	get newPuzzleDiscards(): boolean {
		const { puzzle, state } = this;
		if (this.variant.special || this.solved || this.loading || !puzzle || !state) return false;
		return hasProgress(this.game, { puzzle, state, checkpoints: this.checkpoints, solved: false });
	}

	/** Start a fresh game of `puzzleId`, or of a new puzzle (from the server if it issues them). */
	private async start(puzzleId: number | null, token: number, shared?: string) {
		this.loading = true;
		let found: FoundPuzzle<P>;
		try {
			found = await this.puzzles.find(this.variantIndex, puzzleId, () => {
				this.message = message('info', () => t('session.serverFailed'));
			});
		} catch (e) {
			if (token !== this.openToken) return;
			this.message = message('error', () => t('session.createFailed', { error: String(e) }));
			// The previous puzzle stays playable, unless it belongs to another slot (another type).
			if (!this.saves.holdsBoard) this.show(null);
			this.finishLoading(token);
			return;
		}
		if (token !== this.openToken) return;
		const sharedState = shared ? this.game.decodeState(found.puzzle, shared) : null;
		this.show({
			...found,
			history: { state: sharedState ?? this.game.emptyState(found.puzzle) },
			hints: 0,
			assisted: false,
			playMs: 0
		});
		this.finishLoading(token);
		// The new game takes the slot, whatever another tab saved in it meanwhile.
		this.saves.claim();
		this.persist();
		if (!found.ticket) this.puzzles.prefetch(this.variantIndex);
	}

	/** Continue a saved game, from storage, another tab or another device. */
	private restore(s: PlayableSave<P, S>) {
		this.saves.adopt(s);
		this.show({
			puzzle: s.puzzle,
			puzzleId: s.puzzleId,
			ticket: s.ticket ?? null,
			source: s.ticket ? 'server' : 'local',
			history: {
				state: s.state,
				checkpoints: s.checkpoints,
				currentCheckpoint: s.currentCheckpoint,
				trial: s.trial ?? null
			},
			hints: s.hints ?? 0,
			assisted: !!s.assisted,
			startedAt: s.startedAt,
			playMs: s.playMs
		});
	}

	/** Show a solved game as it ended, with its time. */
	private showSolved(s: PlayableSave<P, S>) {
		this.restore(s);
		this.markSolved(s);
		const shown = this.settings.values.personalTimer ? this.finalPlayMs : this.finalMs;
		this.message = message('success', () =>
			t('session.solved', { time: formatDuration(shown, true) })
		);
	}

	/**
	 * Put a game on the board, or (null) none, after loading one failed (see `retry`). Every field
	 * that belongs to a game is set here, so nothing of the previous game stays behind.
	 */
	private show(g: ShownGame<P, S> | null) {
		this.puzzle = g?.puzzle ?? null;
		this.puzzleId = g?.puzzleId ?? 0;
		this.ticket = g?.ticket ?? null;
		this.source = g?.source ?? 'local';
		this.history.reset(g?.history ?? null);
		this.saves.attachBoard(!!g);
		this.lastChange = new Set();
		this.hint = null;
		this.hintFound = null;
		this.hintFull = false;
		this.hints = g?.hints ?? 0;
		this.assisted = g?.assisted ?? false;
		this.solved = false;
		this.solvedAt = 0;
		this.clock.reset(g?.startedAt ?? 0, g?.playMs ?? 0);
		this.touched = false;
	}

	/** The restored game `s` was solved: when, and in what time (older saves: their last change). */
	private markSolved(s: PlayableSave<P, S>) {
		this.solved = true;
		this.solvedAt = s.solvedAt ?? s.updatedAt;
		this.clock.finished(this.solvedAt);
	}

	/** Open again what the last `open` asked for (after it failed). */
	retry() {
		return this.open(...this.lastOpen);
	}

	private finishLoading(token: number) {
		if (token !== this.openToken) return;
		this.loading = false;
		this.clock.resume();
	}

	/** Pick up a newer save of the same slot from another device. */
	private async syncFromServer(token: number) {
		const remote = await pullSave<unknown>(this.saves.key);
		if (!remote || token !== this.openToken || this.touched) return;
		const data = playableSave(this.game, this.variant, remote.data);
		if (!data) return;
		// The current special puzzle, solved on another device: solved here too, and its period
		// counts for this device's streak.
		if (data.solved && this.period && !this.solved) {
			this.clock.pause();
			this.saves.cancelPush();
			this.showSolved(data);
			this.saves.store(data);
			const v = this.variant;
			// A period has a special type.
			notePeriodSolved(this.game.id, v.key, data.puzzleId, this.period, v.special!);
			void syncPeriods(this.game.id, v);
			return;
		}
		const local = this.saves.playable(this.variant);
		if (!remoteWins(local, data, (s) => hasProgress(this.game, s))) return;
		this.clock.pause();
		this.saves.cancelPush();
		this.restore(data);
		this.saves.store(data);
		this.message = message('info', () => t('session.continued'));
		this.clock.resume();
	}

	/**
	 * Continue what another tab saved in this game's slot since this tab last saved or read it: the
	 * newest save wins, so a tab showing an older game never writes it back. True if it did.
	 */
	followStorage(): boolean {
		// Not while a puzzle loads, nor without one on the board (its slot is another).
		if (this.loading || !this.saves.holdsBoard) return false;
		const stored = this.saves.changedElsewhere(this.variant);
		if (!stored) return false;
		this.clock.pause();
		this.saves.cancelPush();
		this.restore(stored);
		if (stored.solved) this.markSolved(stored);
		this.message = message('info', () => t('session.otherTab'));
		this.clock.resume();
		return true;
	}

	/** Re-check the server when the page becomes visible again (device switch) or on "Sync now". */
	async refreshFromServer() {
		if (!this.loading && !this.solved && currentPlayer()) await this.syncFromServer(this.openToken);
	}

	/**
	 * The kind of special puzzle whose period has ended since it was opened (the daily puzzle
	 * after midnight UTC, …), so that a new one is out; null for any other game.
	 */
	periodOver(now = Date.now()): SpecialKind | null {
		const kind = this.variant.special;
		if (!kind || !this.period || this.loading) return null;
		return this.period === periodKey(kind, new Date(now)) ? null : kind;
	}

	/**
	 * Start the next puzzle. A special type keeps its game: an older one leads back to the
	 * current period (also once the period on the board is over), the current one on to the
	 * regular type of the same size and difficulty.
	 */
	async newPuzzle() {
		if (this.loading) return;
		const v = this.variant;
		if (v.special) {
			const current = this.period && !this.periodOver();
			await this.open(current ? regularCounterpart(this.game.variants, v).key : v.key);
			return;
		}
		if (!this.solved && this.past.length > 0) breakStreak(this.game.id, v.key);
		const token = ++this.openToken;
		this.clock.pause();
		this.message = null;
		await this.start(null, token);
	}

	// ---- Moves and history ------------------------------------------------------------------

	move(next: S, changed: string[]) {
		if (this.readonly || !this.puzzle || !this.state) return;
		const after = this.game.afterMove?.(this.puzzle, next, this.settings.values) ?? next;
		if (!this.history.push(after)) return;
		this.changed(changed);
		this.persist();
		this.checkSolved();
	}

	undo() {
		if (this.readonly || !this.history.undo()) return;
		this.changed();
		this.persist();
	}

	redo() {
		if (this.readonly || !this.history.redo()) return;
		this.changed();
		this.persist();
	}

	/** The position changed: mark what changed (`changed`), and follow it with the hint. */
	private changed(changed: string[] = []) {
		this.lastChange = new Set(changed);
		this.followHint();
		this.touched = true;
	}

	/**
	 * A step goes with the next change. Wrong marks stay pointed out until the player changes
	 * them: each mark that differs from the position they were found in leaves the highlight (and
	 * comes back with undo), and once none is left, the hint goes.
	 */
	private followHint() {
		const found = this.hintFound;
		if (!found || found.hint.kind !== 'mistake' || !this.puzzle || !this.state) {
			return this.dismissHint();
		}
		const changed = new Set(this.game.changes(this.puzzle, found.at, this.state));
		const spotlight = found.hint.spotlight.filter((key) => !changed.has(key));
		if (!spotlight.length) return this.dismissHint();
		this.hint = { ...found.hint, spotlight };
	}

	/** Whether the game can start over: not the current special puzzle once solved. */
	get canStartOver(): boolean {
		return !(this.solved && this.period);
	}

	startOver() {
		if (!this.puzzle || this.loading || !this.canStartOver) return;
		this.history.restart(this.game.emptyState(this.puzzle));
		this.lastChange = new Set();
		this.dismissHint();
		this.solved = false;
		this.solvedAt = 0;
		// The server measures ranked time from when it issued the puzzle.
		this.clock.reset(this.ticket ? this.clock.startedAt : Date.now());
		this.message = null;
		this.touched = true;
		this.clock.resume();
		this.persist();
	}

	/** Whether the game has hints and the player wants the button. */
	get canHint(): boolean {
		return !!this.game.hint && !this.settings.values.hideHint;
	}

	/** A hint was shown: the solve gets no best time and is not ranked. */
	get hinted(): boolean {
		return this.hints > 0;
	}

	/**
	 * Point at where to look and which rule applies, and on the next press at the step itself (at
	 * once for wrong marks). Each new hint counts; asking again before the next move goes on to the
	 * same hint's result and does not. Wrong marks still pointed out after moves are looked up
	 * again: a new hint.
	 */
	showHint() {
		if (this.readonly || !this.puzzle || !this.state || !this.game.hint || !this.canHint) return;
		// A hint found in this position only goes on to its result.
		const shown = this.hintFound?.at === this.state ? this.hintFound.hint : null;
		const hint = shown ?? this.game.hint(this.puzzle, this.state);
		if (!hint) return this.dismissHint();
		if (!shown) this.hints++;
		this.hint = hint;
		this.hintFull = !!shown || !hint.teaser;
		const keys = this.hintFull ? hint.text : hint.teaser!;
		this.message = message(hint.kind === 'mistake' ? 'error' : 'info', () =>
			keys.map((key) => t(key, hint.params)).join(' ')
		);
		this.hintFound = { hint, at: this.state, message: this.message };
		this.persist();
	}

	/**
	 * The text of the hint on the board, while there is one: wide screens show it next to the Hint
	 * button rather than in the top bar, also after another message has come since.
	 */
	get hintMessage(): Message | null {
		// Found and taken away together with the hint.
		return this.hintFound?.message ?? null;
	}

	/** Hints asked for with the Hint button: `hints` without the setting that counts as one. */
	get askedHints(): number {
		return Math.max(0, this.hints - (this.assisted ? 1 : 0));
	}

	/** Whether a setting that counts as a hint is on, such as painting wrong digits red. */
	get assistOn(): boolean {
		return this.settings.info.some((s) => s.countsAsHint && this.settings.values[s.key]);
	}

	/**
	 * Count a setting that counts as a hint, once per game: when the game starts with it on, or
	 * when it is turned on before the puzzle is solved. Called by the page whenever either changes.
	 */
	noteAssist() {
		if (this.assisted || !this.assistOn || this.loading || this.solved || !this.puzzle) return;
		this.assisted = true;
		this.hints++;
		this.persist();
	}

	/**
	 * Take the hint off the board, with its message (not another one shown since): after a move,
	 * when the player closes it, or when hints are turned off.
	 */
	dismissHint() {
		if (!this.hint) return;
		if (this.message === this.hintFound?.message) this.message = null;
		this.hint = null;
		this.hintFound = null;
	}

	// ---- Trials -----------------------------------------------------------------------------

	/** Try something out: what changes from here on shows in the trial colour. */
	startTrial() {
		if (this.readonly || !this.history.startTrial()) return;
		this.persist();
	}

	/** The trial worked out: its marks stay and look like any other. */
	keepTrial() {
		if (this.readonly || !this.history.keepTrial()) return;
		this.persist();
	}

	/** The trial went wrong: back to where it began (see `History.dropTrial`). */
	dropTrial() {
		if (this.readonly) return;
		const moved = this.history.dropTrial();
		if (moved === null) return;
		if (moved) this.changed();
		this.persist();
	}

	// ---- Checkpoints ------------------------------------------------------------------------

	saveCheckpoint() {
		if (this.loading || !this.history.saveCheckpoint()) return;
		this.persist();
	}

	addCheckpoint() {
		if (this.loading || !this.history.addCheckpoint()) return;
		this.persist();
	}

	loadCheckpoint(index: number) {
		if (this.readonly) return;
		const moved = this.history.loadCheckpoint(index);
		if (moved === null) return;
		if (moved) this.changed();
		this.persist();
	}

	deleteCheckpoint(index: number) {
		if (!this.history.deleteCheckpoint(index)) return;
		this.persist();
	}

	// ---- Timers -----------------------------------------------------------------------------

	/** Called by the page when visibility or focus changes. */
	setActive(active: boolean) {
		this.clock.active = active;
		if (active) this.clock.resume();
		else if (!this.settings.values.hideTimer) this.clock.pause();
	}

	setManualPause(paused: boolean) {
		this.clock.manualPause = paused;
		if (paused) this.clock.pause();
		else this.clock.resume();
	}

	/** Whether the clock may run: a game is on, and the page is active or the timer hidden. */
	private get clockMayRun(): boolean {
		if (!this.puzzle || this.solved || this.loading || this.paused) return false;
		return this.clock.active || !!this.settings.values.hideTimer;
	}

	elapsed(now: number): number {
		// Nothing has started while the first puzzle is still being created.
		if (!this.puzzle) return 0;
		return this.solved ? this.clock.finalMs : Math.max(0, now - this.clock.startedAt);
	}

	personal(now: number): number {
		return this.solved ? this.clock.finalPlayMs : this.clock.played(now);
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
				if (!auto) this.message = message('error', () => t('session.notSolved'));
				return;
			}
			this.history.step(alt);
			this.changed();
			state = alt;
		}
		this.solvedAt = Date.now();
		this.clock.finish(this.solvedAt);
		this.solved = true;
		// Nothing is left to point at.
		this.dismissHint();
		// A trial that solves the puzzle was right.
		this.history.keepTrial();
		const { finalMs, finalPlayMs } = this.clock;
		const competitive = !this.settings.values.personalTimer;
		const shown = competitive ? finalMs : finalPlayMs;
		const variant = this.variant;
		recordSolve(
			this.game.id,
			variant.key,
			this.puzzleId,
			shown,
			this.period,
			variant.special,
			this.hinted
		);
		// The period counts for the streak on the player's other devices too.
		if (this.period) void syncPeriods(this.game.id, variant);
		this.persist();
		this.message = message('success', () =>
			t('session.solved', { time: formatDuration(shown, true) })
		);

		this.submitting = true;
		try {
			const res = await submitScore({
				game: this.game.id,
				variant: variant.key,
				puzzleId: this.puzzleId,
				puzzle: this.puzzle,
				answer: this.game.answer(this.puzzle, state),
				timeMs: finalMs,
				playMs: finalPlayMs,
				competitive,
				hinted: this.hinted,
				ticket: this.ticket ?? undefined
			});
			if (res === 'queued') {
				this.message = message('info', () =>
					t('session.queued', { time: formatDuration(shown, true) })
				);
				return;
			}
			if (res?.puzzleId && !this.puzzleId) {
				this.puzzleId = res.puzzleId;
				this.persist();
			}
			if (res) this.message = scoreMessage(res, shown, variant);
		} catch (e) {
			const error = (e as Error).message;
			this.message = message('info', () =>
				t('session.uploadFailed', { time: formatDuration(shown, true), error })
			);
		} finally {
			this.submitting = false;
		}
	}

	// ---- Persistence ------------------------------------------------------------------------

	/** Save locally and, after a short pause, to the server. `changed` is false for a plain flush. */
	persist(changed = true) {
		const { puzzle, state } = this;
		// Never save the previous puzzle into the slot of one that is still loading.
		if (!puzzle || !state || !this.saves.holdsBoard) return;
		// Another tab saved the game since: this tab takes its save over instead of rolling it back.
		if (this.followStorage()) return;
		this.saves.write(
			{
				puzzleId: this.puzzleId,
				variant: this.variant.key,
				puzzle,
				state,
				checkpoints: this.checkpoints,
				currentCheckpoint: this.currentCheckpoint,
				solved: this.solved,
				startedAt: this.clock.startedAt,
				playMs: this.clock.played(),
				...(this.ticket ? { ticket: this.ticket } : {}),
				...(this.hints ? { hinted: true, hints: this.hints } : {}),
				...(this.assisted ? { assisted: true } : {}),
				...(this.trial ? { trial: this.trial } : {}),
				...(this.solved && this.solvedAt ? { solvedAt: this.solvedAt } : {})
			},
			changed
		);
	}

	/** Flush the play time into the save (page hide / unload). */
	flush() {
		this.persist(false);
	}
}
