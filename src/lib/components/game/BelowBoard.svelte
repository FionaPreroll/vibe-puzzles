<script lang="ts">
	import type { AnySession } from '../../client/session.svelte';
	import type { Settings } from '../../core/types';
	import type { SpecialKind } from '../../core/variants';
	import type { AnyGame } from '../../games';
	import ActionRow from './ActionRow.svelte';
	import type { BoardFit } from './boardFit.svelte';
	import CheckpointBar from './CheckpointBar.svelte';
	import HintNote from './HintNote.svelte';
	import PlayBar from './PlayBar.svelte';
	import SharePanel from './SharePanel.svelte';
	import SwatchRow from './SwatchRow.svelte';
	import type { ToolState } from './tools.svelte';
	import TrialRow from './TrialRow.svelte';

	/**
	 * Everything below the board, no wider than its stage: the play bar (on phones fixed at the
	 * bottom instead) with a hint's text below it on wide screens, the checkpoints, the puzzle's ID
	 * with the actions, and the share panel.
	 */
	let {
		game,
		session,
		settings,
		fit,
		tools,
		showTools,
		shared,
		newPeriod,
		newBusy,
		share,
		onnew,
		onsharesolve,
		onshare,
		onstartover,
		oncloseshare
	}: {
		game: AnyGame;
		session: AnySession;
		settings: Settings<string>;
		fit: BoardFit;
		tools: ToolState;
		showTools: boolean;
		/** The solve was shared: the next puzzle is the way on. */
		shared: boolean;
		/** The special puzzle's period is over: "New puzzle" opens the current one. */
		newPeriod: SpecialKind | null;
		newBusy: boolean;
		/** The board shared as a link and a picture, while the panel is open. */
		share: { link: string; image: string | null } | null;
		onnew: () => void;
		onsharesolve: () => void;
		onshare: () => void;
		onstartover: () => void;
		oncloseshare: () => void;
	} = $props();

	// The page ends below the phones' fixed tool bar, so that nothing stays hidden under it: not
	// the buttons below the board, nor the footer of the layout.
	$effect(() => {
		document.body.style.paddingBottom = fit.barHeight ? `${fit.barHeight}px` : '';
		return () => void (document.body.style.paddingBottom = '');
	});
</script>

<div bind:offsetHeight={fit.belowHeight} class="stage-column" style:--stage="{fit.stageWidth}px">
	<!-- Wide screens: the play bar right below the board, no wider than it needs -->
	<div class="relative mt-4 hidden flex-col items-center gap-2 lg:flex">
		<div class="play-bar flex w-max" bind:offsetWidth={fit.barWidth}>
			<PlayBar {game} {session} {tools} {showTools} wide={fit.wide} />
		</div>
		<SwatchRow {game} {tools} />
		<TrialRow {session} />
		{#if fit.wide && session.hintMessage}
			<HintNote
				message={session.hintMessage}
				teaser={!session.hintFull}
				onshowhint={() => session.showHint()}
				ondismisshint={() => session.dismissHint()}
			/>
		{/if}
	</div>
	<!-- Phones: the play bar fixed at the bottom, in reach of the thumb -->
	<div
		bind:offsetHeight={fit.barHeight}
		class="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden dark:border-stone-800 dark:bg-stone-900/95"
	>
		{#if game.toolOptions && tools.swatches}
			<div class="mb-1.5 flex justify-center"><SwatchRow {game} {tools} /></div>
		{/if}
		{#if session.trial && !session.solved}
			<div class="mb-1.5 flex justify-center"><TrialRow {session} /></div>
		{/if}
		<div class="mx-auto flex max-w-md items-center">
			<PlayBar {game} {session} {tools} {showTools} wide={fit.wide} />
		</div>
	</div>

	{#if settings.showCheckpoints}
		<CheckpointBar {session} />
	{/if}

	<ActionRow
		{session}
		autoSubmit={settings.autoSubmit}
		{shared}
		{newPeriod}
		{newBusy}
		{onnew}
		{onsharesolve}
		{onshare}
		{onstartover}
	/>

	{#if share}
		<SharePanel
			link={share.link}
			image={share.image}
			filename="{game.id}-{session.puzzleId}.png"
			onclose={oncloseshare}
		/>
	{/if}
</div>
