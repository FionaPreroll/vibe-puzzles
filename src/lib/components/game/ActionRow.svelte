<script lang="ts">
	import { resolve } from '$app/paths';
	import { trapFocus } from '../../client/focus';
	import { insideQuery } from '../../core/filmLink';
	import type { AnySession } from '../../client/session.svelte';
	import type { SpecialKind } from '../../core/variants';
	import { t } from '../../i18n/index.svelte';
	import HalloweenCandle from '../halloween/Candle.svelte';
	import HalloweenPumpkin from '../halloween/Pumpkin.svelte';

	/**
	 * The puzzle's ID on a line of its own, then at most three buttons: one stands out only when it
	 * is the way on ("Done" without automatic submitting, "Share success" once solved, then "New
	 * puzzle" once the solve is shared, or as "Today's puzzle" once the daily puzzle on the board is
	 * yesterday's). On one line, the buttons that come with solving would wrap
	 * them and shrink the board. "More" holds sharing the board, printing and starting over, and
	 * once the puzzle is solved (a film shows the solution) how it was made, on the Inside page.
	 */
	let {
		session,
		autoSubmit,
		shared,
		newPeriod,
		newBusy,
		menuStart = false,
		onnew,
		onsharesolve,
		onshare,
		onstartover
	}: {
		session: AnySession;
		autoSubmit: boolean;
		/** The solve was shared: the next puzzle is the way on. */
		shared: boolean;
		/** The special puzzle's period is over: "New puzzle" opens the current one. */
		newPeriod: SpecialKind | null;
		/** "New puzzle" is busy (asking or loading). */
		newBusy: boolean;
		/** "More" opens its menu from the button's start rather than its end (near the left edge). */
		menuStart?: boolean;
		onnew: () => void;
		onsharesolve: () => void;
		onshare: () => void;
		onstartover: () => void;
	} = $props();

	let moreOpen = $state(false);

	/** "New puzzle" is the way on: after sharing the solve, or once a newer special is out. */
	const nextUp = $derived(shared || !!newPeriod);

	/** The Inside page's film of the puzzle, once solved, where its game has one. */
	const howMade = $derived.by(() => {
		const { game, variant, puzzleId, puzzle, solved } = session;
		const query = solved && puzzleId ? insideQuery(game.id, variant, puzzleId, puzzle) : null;
		return query && `${resolve('/inside')}?${query}`;
	});

	/** Close the menu, then do what was picked. */
	const pick = (action: () => void) => () => ((moreOpen = false), action());
</script>

<div
	class="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-3 lg:mt-4 lg:justify-start"
>
	<p class="w-full text-center text-xs text-stone-500 lg:text-left lg:text-sm dark:text-stone-400">
		{t('game.puzzleId')}:
		{#if session.puzzleId}
			<span class="font-mono select-all">{session.puzzleId.toLocaleString('en-US')}</span>
			{#if session.source === 'bank'}
				<span class="hidden text-stone-500 sm:inline dark:text-stone-400"
					>({t('game.fromBank')})</span
				>
			{/if}
		{:else}
			<span title={t('game.idHiddenTitle')}>{t('game.idHidden')}</span>
		{/if}
	</p>
	<div class="flex flex-wrap items-end justify-center gap-2">
		<!-- Halloween on phones: a jack-o'-lantern and candles beside the buttons -->
		<HalloweenPumpkin face="night" class="halloween-only mr-2 w-10 lg:hidden" />
		{#if !session.solved && !autoSubmit}
			<button
				class="btn btn-primary max-lg:min-h-11"
				onclick={() => session.submit()}
				disabled={session.loading}>{t('game.done')}</button
			>
		{/if}
		{#if session.solved && session.puzzleId}
			<button
				class="btn max-lg:min-h-11 {nextUp ? '' : 'btn-primary next-up'}"
				onclick={onsharesolve}>{t('game.shareSolve')}</button
			>
		{/if}
		<button
			class="btn max-lg:min-h-11 {nextUp ? 'btn-primary next-up' : ''}"
			onclick={onnew}
			disabled={newBusy || session.loading}
			>{newPeriod ? t(`game.currentPeriod.${newPeriod}`) : t('game.newPuzzle')}</button
		>
		<div class="relative">
			<button
				class="btn max-lg:min-h-11"
				onclick={() => (moreOpen = !moreOpen)}
				aria-expanded={moreOpen}
				aria-label={t('game.more')}
				title={t('game.more')}
			>
				<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
					<circle cx="5" cy="12" r="1.8" />
					<circle cx="12" cy="12" r="1.8" />
					<circle cx="19" cy="12" r="1.8" />
				</svg>
			</button>
			{#if moreOpen}
				<button
					class="fixed inset-0 z-20 cursor-default"
					tabindex="-1"
					aria-hidden="true"
					onclick={() => (moreOpen = false)}
				></button>
				<div
					class="popover absolute {menuStart
						? 'left-0'
						: 'right-0'} bottom-full z-30 mb-1 flex w-56 flex-col p-1"
					role="group"
					aria-label={t('game.more')}
					{@attach (node) => trapFocus(node, () => (moreOpen = false))}
				>
					<button
						class="menu-item"
						onclick={pick(onshare)}
						disabled={session.loading || !session.puzzleId}>{t('game.share')}</button
					>
					<button class="menu-item" onclick={pick(() => window.print())}>{t('game.print')}</button>
					{#if howMade}
						<a class="menu-item" href={howMade}>{t('game.howMade')}</a>
					{/if}
					<!-- Not for the current special puzzle once solved: it is played once -->
					{#if session.canStartOver}
						<hr class="mx-2 my-1 border-stone-200 dark:border-stone-700" />
						<button
							class="menu-item text-rose-700 dark:text-rose-400"
							onclick={pick(onstartover)}
							disabled={session.loading}>{t('game.startOver')}</button
						>
					{/if}
				</div>
			{/if}
		</div>
		<span class="halloween-only ml-2 flex items-end gap-1.5 lg:hidden" aria-hidden="true">
			<HalloweenCandle class="w-4" />
			<HalloweenCandle class="w-3" />
		</span>
	</div>
</div>
