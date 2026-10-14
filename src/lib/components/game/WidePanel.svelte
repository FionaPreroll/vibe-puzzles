<script lang="ts">
	import type { AnySession } from '../../client/session.svelte';
	import { formatDuration } from '../../core/time';
	import type { Settings } from '../../core/types';
	import type { SpecialKind, Variant } from '../../core/variants';
	import type { AnyGame } from '../../games';
	import { t } from '../../i18n/index.svelte';
	import ActionRow from './ActionRow.svelte';
	import CheckpointBar from './CheckpointBar.svelte';
	import GameInfo from './GameInfo.svelte';
	import HintNote from './HintNote.svelte';
	import { SHORT_PANEL } from './boardFit';
	import { messageClass } from './messageStyle';
	import PlayBar from './PlayBar.svelte';
	import SharePanel from './SharePanel.svelte';
	import SwatchRow from './SwatchRow.svelte';
	import type { ToolState } from './tools.svelte';
	import TrialRow from './TrialRow.svelte';
	import ZoomControl from './ZoomControl.svelte';

	/**
	 * Widescreen: everything but the board in one column beside it, on the right or the left (`side`),
	 * so that the board can take the screen's height. From the top: the game, the clock and the
	 * icons, a message, the play bar with a hint's text, the checkpoints, the puzzle's ID with the
	 * actions, and what the side panel shows (`GameInfo`). It never makes the page longer than the
	 * screen (`maxHeight`): the part from the side panel scrolls inside it, and on short screens
	 * (a phone on its side) the whole panel does.
	 *
	 * Folded (`collapsed`), it is a narrow strip with the play bar in a column and the settings;
	 * messages and hints then show in a bubble beside it, over the room next to the board.
	 */
	let {
		game,
		variant,
		label,
		session,
		settings,
		clock,
		isTouch,
		side,
		maxHeight,
		zoom,
		tools,
		showTools,
		shared,
		newPeriod,
		newBusy,
		share,
		collapsed = $bindable(false),
		zoomOpen = $bindable(false),
		oncollapse,
		onzoom,
		onsettings,
		onshortcuts,
		onpick,
		onopenid,
		onnew,
		onsharesolve,
		onshare,
		onstartover,
		oncloseshare
	}: {
		game: AnyGame;
		variant: Variant;
		/** The puzzle type's name. */
		label: string;
		session: AnySession;
		settings: Settings<string>;
		/** The time to show. */
		clock: number;
		isTouch: boolean;
		side: 'left' | 'right';
		/** Height in pixels the panel may take. */
		maxHeight: number;
		zoom: number;
		tools: ToolState;
		showTools: boolean;
		/** The solve was shared: the next puzzle is the way on. */
		shared: boolean;
		/** The special puzzle's period is over: "New puzzle" opens the current one. */
		newPeriod: SpecialKind | null;
		newBusy: boolean;
		/** The board shared as a link and a picture, while the panel is open. */
		share: { link: string; image: string | null } | null;
		collapsed: boolean;
		zoomOpen?: boolean;
		/** The panel was folded or unfolded (`collapsed` holds the new state). */
		oncollapse: () => void;
		onzoom: (zoom: number) => void;
		onsettings: () => void;
		onshortcuts: () => void;
		onpick: (variantKey: string) => void;
		onopenid: (text: string) => Promise<boolean>;
		onnew: () => void;
		onsharesolve: () => void;
		onshare: () => void;
		onstartover: () => void;
		oncloseshare: () => void;
	} = $props();

	/** A hint's text shows with the play bar; the other messages above it. */
	const shown = $derived(session.message !== session.hintMessage ? session.message : null);
	/**
	 * Too short for the controls and a part of the side panel: all of it scrolls. (The menus
	 * that open from the controls then stay within the panel.)
	 */
	const short = $derived(maxHeight < SHORT_PANEL);
	/** The arrow points where the panel goes: towards the screen's edge to fold it. */
	const arrow = $derived((side === 'right') === collapsed ? '«' : '»');

	function toggle() {
		collapsed = !collapsed;
		oncollapse();
	}
</script>

{#snippet clockTime(size: string)}
	{#if !settings.hideTimer}
		<span
			class="shrink-0 font-mono {size} text-stone-700 tabular-nums dark:text-stone-200"
			aria-label={t('game.timer')}
		>
			<!-- Milliseconds only once solved: a running clock should not make anyone nervous -->
			{formatDuration(clock, session.solved)}
		</span>
	{/if}
{/snippet}

{#snippet settingsButton()}
	<button
		class="btn-icon size-10 shrink-0"
		onclick={onsettings}
		aria-label={t('game.settings')}
		title={t('game.settings')}
	>
		<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
			<g fill="none" stroke="currentColor">
				<circle cx="12" cy="12" r="8.6" stroke-width="3.2" stroke-dasharray="3.38 3.38" />
				<circle cx="12" cy="12" r="6" stroke-width="2" />
				<circle cx="12" cy="12" r="2" stroke-width="2" />
			</g>
		</svg>
	</button>
{/snippet}

<div class="sticky top-4 shrink-0">
	<aside
		class="panel {collapsed
			? 'w-20 overflow-y-auto px-2'
			: short
				? 'w-88 overflow-y-auto'
				: 'flex w-88 flex-col'}"
		style:max-height="{maxHeight}px"
		aria-label={t('game.menu', { game: game.name })}
	>
		<!-- Always in the page: screen readers miss live regions added together with their text -->
		<p class="sr-only" role="status">{session.message?.text ?? ''}</p>
		{#if collapsed}
			<div class="flex flex-col items-center gap-2">
				<button
					class="btn-icon"
					aria-label={t('game.expandControls')}
					title={t('game.expandControls')}
					onclick={toggle}>{arrow}</button
				>
				{@render clockTime('text-sm')}
				<div class="play-bar play-bar-vertical flex w-full flex-col">
					<PlayBar {game} {session} {tools} {showTools} wide vertical />
				</div>
				{@render settingsButton()}
			</div>
		{:else}
			<!-- Outside the part that scrolls, so that the zoom slider and the "More" menu may reach
			     beyond the panel -->
			<div class="shrink-0">
				<div class="flex items-start justify-between gap-2">
					<h1 class="font-display text-2xl font-bold tracking-tight">
						<span aria-hidden="true">{game.icon}</span>
						{game.name}
						{#if game.earlyAccess}<span class="early-access align-middle"
								>{t('game.earlyAccess')}</span
							>{/if}
					</h1>
					<button
						class="btn-icon shrink-0"
						aria-label={t('game.collapseControls')}
						title={t('game.collapseControls')}
						onclick={toggle}>{arrow}</button
					>
				</div>
				<p class="text-sm text-stone-500 dark:text-stone-400">{label}</p>

				<div class="mt-3 flex min-h-10 items-center gap-1">
					{@render clockTime('text-lg')}
					{#if !settings.hideTimer && settings.personalTimer && !session.solved}
						<button
							class="btn-sm ml-1"
							onclick={() => session.setManualPause(!session.manualPause)}
						>
							{session.manualPause ? t('game.resume') : t('game.pause')}
						</button>
					{/if}
					<span class="flex-1"></span>
					{#if !isTouch}
						<button
							class="btn-icon size-10"
							onclick={onshortcuts}
							aria-label={t('shortcuts.title')}
							title={t('shortcuts.open')}
						>
							<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
								<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
									<rect x="2.5" y="6" width="19" height="12" rx="2" />
									<path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9" />
								</g>
							</svg>
						</button>
					{/if}
					{@render settingsButton()}
					<!-- Last in the row: its slider opens below it, towards the panel's other edge -->
					<ZoomControl {zoom} {onzoom} bind:open={zoomOpen} />
				</div>

				{#if shown}
					<p class="mt-2 rounded-xl px-3 py-1.5 text-xs leading-4 {messageClass(shown.kind)}">
						{shown.text}
					</p>
				{/if}

				<div class="mt-3 flex flex-col items-stretch gap-2">
					<!-- Wraps where the tools do not fit on one line: no separators then -->
					<div class="play-bar play-bar-wrap flex flex-wrap">
						<PlayBar {game} {session} {tools} {showTools} wide />
					</div>
					<SwatchRow {game} {tools} />
					<TrialRow {session} />
					{#if session.hintMessage}
						<HintNote
							message={session.hintMessage}
							teaser={!session.hintFull}
							floating={false}
							onshowhint={() => session.showHint()}
							ondismisshint={() => session.dismissHint()}
						/>
					{/if}
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
					menuStart={side === 'left'}
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

				<hr class="mt-5 border-stone-200 dark:border-stone-800" />
			</div>
			<div class={short ? '' : '-mx-4 min-h-0 overflow-y-auto px-4'}>
				<GameInfo {game} {variant} {isTouch} {onpick} {onopenid} {onshortcuts} />
			</div>
		{/if}
	</aside>

	<!-- Folded: messages and hints beside the strip, over the room next to the board -->
	{#if collapsed && (shown || session.hintMessage)}
		<div
			class="pointer-events-none absolute top-0 z-20 flex w-72 flex-col gap-2 *:pointer-events-auto *:shadow-lg {side ===
			'right'
				? 'right-full mr-3 items-end'
				: 'left-full ml-3 items-start'}"
		>
			{#if shown}
				<p class="rounded-xl px-3 py-1.5 text-xs leading-4 {messageClass(shown.kind)}">
					{shown.text}
				</p>
			{/if}
			{#if session.hintMessage}
				<HintNote
					message={session.hintMessage}
					teaser={!session.hintFull}
					floating={false}
					onshowhint={() => session.showHint()}
					ondismisshint={() => session.dismissHint()}
				/>
			{/if}
		</div>
	{/if}
</div>
