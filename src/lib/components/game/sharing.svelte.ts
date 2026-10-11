import { resolve } from '$app/paths';
import type { AnySession } from '../../client/session.svelte';
import { message } from '../../client/session/messages';
import { t } from '../../i18n/index.svelte';
import type { AnyGame } from '../../games';
import { puzzleLink, screenshot, shareSolve, solveShare, type ShareTarget } from './share';

/**
 * What the game page shares, and what it shows for it: the share panel with a link to the board
 * and its picture, and a solve shared to a messenger (or copied, or shown to copy by hand).
 */
export class Sharing {
	/** The board shared as a link and a picture, while the share panel is open. */
	board = $state<{ link: string; image: string | null } | null>(null);
	/** The solve to share when it could not be copied; shown in a dialog while set. */
	manualText = $state<string | null>(null);
	/** The puzzle whose solve was shared. */
	private sharedId = $state<number | null>(null);

	constructor(
		private readonly game: Pick<AnyGame, 'id' | 'name' | 'encodeState'>,
		private readonly session: Pick<
			AnySession,
			'puzzle' | 'state' | 'puzzleId' | 'solved' | 'askedHints' | 'assisted' | 'message'
		>,
		private readonly target: () => ShareTarget = () => navigator
	) {}

	/** The solve was shared: then the next puzzle is the way on, not sharing again. */
	get solveShared(): boolean {
		return this.session.solved && this.sharedId !== null && this.sharedId === this.session.puzzleId;
	}

	/** Open the share panel with a link to the board as it is, and a picture of `svg`. */
	async shareBoard(svg: SVGSVGElement | null | undefined) {
		const { puzzle, state, puzzleId } = this.session;
		if (!puzzle || !state) return;
		this.board = {
			link: puzzleLink(this.gameUrl(), puzzleId, this.game.encodeState(state)),
			image: null
		};
		const image = svg ? await screenshot(svg) : null;
		if (this.board) this.board.image = image;
	}

	/** Share the solve, in `timeMs` of type `variant`, e.g. to a messenger. */
	async shareSolve(variant: string, timeMs: number) {
		const { puzzleId } = this.session;
		if (!puzzleId) return;
		this.sharedId = puzzleId;
		const data = solveShare({
			game: this.game.name,
			variant,
			puzzleId,
			timeMs,
			asked: this.session.askedHints,
			assisted: this.session.assisted,
			url: puzzleLink(this.gameUrl(), puzzleId)
		});
		const done = await shareSolve(data, this.target());
		if (done.how === 'copied') this.copied();
		if (done.how === 'manual') this.manualText = done.text;
	}

	/** The solve's text was copied. */
	copied() {
		this.session.message = message('info', () => t('game.bragCopied'));
	}

	private gameUrl(): string {
		return `${location.origin}${resolve('/[game]', { game: this.game.id })}`;
	}
}
