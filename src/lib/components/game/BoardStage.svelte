<script lang="ts">
	import type { AnySession } from '../../client/session.svelte';
	import type { BoardKeys, Settings, TouchMode } from '../../core/types';
	import type { AnyGame } from '../../games';
	import { t } from '../../i18n/index.svelte';
	import type { BoardFit } from './boardFit.svelte';
	import Celebration from './Celebration.svelte';
	import HangingSpider from './HangingSpider.svelte';
	import MessageToast from './MessageToast.svelte';
	import StageDecor from './StageDecor.svelte';
	import type { ToolState } from './tools.svelte';

	/**
	 * The board on its surface (the stage), with what goes over it: the celebration, the phones'
	 * message toast, and while there is no board to play, "Creating…", "Paused" or "Try again". The
	 * middle mouse button pans the board area.
	 */
	let {
		game,
		session,
		settings,
		fit,
		tools,
		cellSize,
		touchMode,
		celebrate,
		showTools,
		keys
	}: {
		game: AnyGame;
		session: AnySession;
		settings: Settings<string>;
		fit: BoardFit;
		tools: ToolState;
		cellSize: number;
		touchMode: TouchMode;
		/** The win animation is running. */
		celebrate: boolean;
		showTools: boolean;
		/** The page's key dispatcher, which hands the board its keys first. */
		keys: (board: BoardKeys) => () => void;
	} = $props();

	const Board = $derived(game.board);
	/** Halloween: room beside the board for decorations, which must not make the page scroll. */
	const decorBeside = $derived(fit.wide && fit.areaWidth - fit.stageWidth >= 2 * 96);
	// A hint's first look tints only where to look; the next press points at the step itself.
	const spotlight = $derived(
		session.hint && session.hintFull ? new Set(session.hint.spotlight) : undefined
	);
	const area = $derived(session.hint?.area ? new Set(session.hint.area) : undefined);
	/** What changed since a running trial began, drawn in the trial colour. */
	const trialMarks = $derived(
		session.trial && session.puzzle && session.state
			? new Set(game.changes(session.puzzle, session.trial, session.state))
			: undefined
	);

	let pan: { x: number; y: number } | null = null;

	function onpanstart(e: PointerEvent) {
		if (e.button !== 1) return;
		e.preventDefault();
		pan = { x: e.clientX, y: e.clientY };
	}

	function onpanmove(e: PointerEvent) {
		if (!pan || !fit.boardArea) return;
		fit.boardArea.scrollLeft -= e.clientX - pan.x;
		window.scrollBy(0, -(e.clientY - pan.y));
		pan = { x: e.clientX, y: e.clientY };
	}
</script>

<svelte:window onpointermove={onpanmove} onpointerup={() => (pan = null)} />

<!-- Room around the board on phones, so a quick swipe does not hit a button -->
<div class="relative mt-5 lg:mt-4" bind:clientWidth={fit.areaWidth} bind:this={fit.areaWrap}>
	{#if decorBeside && session.puzzle}
		<HangingSpider headerGap={fit.headerGap} stageWidth={fit.stageWidth} />
	{/if}
	<div
		bind:this={fit.boardArea}
		class="overflow-x-auto py-1"
		role="presentation"
		onpointerdown={onpanstart}
	>
		{#if session.puzzle && session.state}
			<div
				class="board-stage"
				bind:offsetWidth={fit.stageWidth}
				style:min-width={fit.wide && fit.barWidth ? `${fit.barWidth}px` : undefined}
			>
				<StageDecor beside={decorBeside} />
				<div
					class="relative z-10 mx-auto w-fit rounded-sm {session.paused
						? 'invisible'
						: ''} {celebrate ? 'solved-glow' : ''}"
				>
					<Board
						puzzle={session.puzzle}
						state={session.state}
						{settings}
						tool={tools.tool}
						toolOption={tools.option}
						{cellSize}
						readonly={session.readonly}
						lastChange={session.lastChange}
						{spotlight}
						mistake={session.hint?.kind === 'mistake'}
						{area}
						trial={trialMarks}
						{keys}
						ontool={showTools ? tools.set : undefined}
						{celebrate}
						{touchMode}
						onmove={(next, changed) => session.move(next, changed)}
					/>
					{#if celebrate}
						<Celebration />
					{/if}
				</div>
			</div>
		{:else if !session.loading}
			<!-- Creating the puzzle failed; the message says why -->
			<div class="grid min-h-48 place-items-center content-center gap-3 text-stone-500">
				<p>{t('game.notCreated')}</p>
				<button class="btn" onclick={() => session.retry()}>{t('game.retry')}</button>
			</div>
		{/if}
	</div>
	<MessageToast
		phone={!fit.wide}
		message={session.message}
		hint={!!session.hint}
		teaser={!!session.hint && !session.hintFull}
		onshowhint={() => session.showHint()}
		ondismisshint={() => session.dismissHint()}
	/>
	{#if session.loading}
		<div class="absolute inset-0 grid min-h-48 place-items-center text-stone-500">
			{t('game.creating')}
		</div>
	{:else if session.paused}
		<button
			class="absolute inset-0 grid place-items-center text-lg font-medium"
			onclick={() => session.setManualPause(false)}
		>
			{t('game.paused')}
		</button>
	{/if}
</div>
