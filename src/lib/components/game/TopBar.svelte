<script lang="ts">
	import type { AnySession } from '../../client/session.svelte';
	import type { Settings } from '../../core/types';
	import { formatDuration } from '../../core/time';
	import type { AnyGame } from '../../games';
	import { t } from '../../i18n/index.svelte';
	import { messageClass } from './messageStyle';
	import ZoomControl from './ZoomControl.svelte';

	/**
	 * The bar above the board: on phones the game and its type (opening the drawer), then the
	 * clock, the message on wide screens, and zoom, settings and shortcuts as icons. It is no wider
	 * than the board's stage.
	 */
	let {
		game,
		label,
		session,
		settings,
		clock,
		wide,
		isTouch,
		stageWidth,
		zoom,
		menuOpen,
		height = $bindable(0),
		zoomOpen = $bindable(false),
		onzoom,
		onmenu,
		onsettings,
		onshortcuts
	}: {
		game: AnyGame;
		/** The puzzle type's name. */
		label: string;
		session: AnySession;
		settings: Settings<string>;
		/** The time to show. */
		clock: number;
		wide: boolean;
		isTouch: boolean;
		stageWidth: number;
		zoom: number;
		menuOpen: boolean;
		height?: number;
		zoomOpen?: boolean;
		onzoom: (zoom: number) => void;
		onmenu: () => void;
		onsettings: () => void;
		onshortcuts: () => void;
	} = $props();

	/**
	 * The stage's width when the zoom popover opened. The bar keeps it while the popover is open:
	 * following the growing board would move the slider away under the pointer.
	 */
	let zoomStage = $state(0);
	/** A hint's text shows below the play bar (`HintNote`): the bar has the other messages. */
	const shown = $derived(session.message !== session.hintMessage ? session.message : null);
</script>

<div
	bind:offsetHeight={height}
	class="stage-column flex min-h-11 items-center gap-1 {settings.stickyToolbar
		? 'sticky top-0 z-10 bg-stone-50/95 py-1 backdrop-blur dark:bg-stone-950/95'
		: ''}"
	style:--stage="{zoomOpen ? zoomStage : stageWidth}px"
>
	<button
		class="-ml-1 flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-stone-100 lg:hidden dark:hover:bg-stone-800"
		onclick={onmenu}
		aria-label={t('game.openMenu')}
		aria-expanded={menuOpen}
	>
		<svg viewBox="0 0 24 24" class="size-5 shrink-0 text-stone-500" aria-hidden="true">
			<path
				d="M4 6h16M4 12h16M4 18h16"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			/>
		</svg>
		<span class="min-w-0 leading-tight">
			<span class="block truncate font-semibold"
				><span aria-hidden="true">{game.icon}</span> {game.name}</span
			>
			<span class="block truncate text-xs text-stone-500 dark:text-stone-400">{label}</span>
		</span>
	</button>
	<span class="flex-1 lg:hidden"></span>
	{#if !settings.hideTimer}
		<span
			class="shrink-0 px-1 font-mono text-lg text-stone-700 tabular-nums dark:text-stone-200"
			aria-label={t('game.timer')}
		>
			<!-- Milliseconds only once solved: a running clock should not make anyone nervous -->
			{formatDuration(clock, session.solved)}
		</span>
		{#if settings.personalTimer && !session.solved}
			<button class="btn-sm" onclick={() => session.setManualPause(!session.manualPause)}>
				{session.manualPause ? t('game.resume') : t('game.pause')}
			</button>
		{/if}
	{/if}
	<!-- In the top bar on wide screens, so a message never pushes the board down: centred in the
	     space between the clock and the icons, and out of the flow, so that a message on two or
	     three lines reaches into the room above and below rather than making the bar taller. Where
	     it reaches over the board, clicks go through to the cells. Hints show below the play bar -->
	{#if shown && wide}
		<div class="relative ml-2 min-w-0 flex-1 self-stretch">
			<p
				class="pointer-events-none absolute inset-x-0 top-1/2 z-20 mx-auto w-fit max-w-full -translate-y-1/2 rounded-xl px-3 py-1.5 text-center text-xs leading-4 {messageClass(
					shown.kind
				)}"
			>
				{shown.text}
			</p>
		</div>
	{:else}
		<span class="hidden flex-1 lg:block"></span>
	{/if}
	<!-- Always in the page: screen readers miss live regions added together with their text -->
	<p class="sr-only" role="status">{session.message?.text ?? ''}</p>
	<ZoomControl {zoom} {onzoom} bind:open={zoomOpen} onopen={() => (zoomStage = stageWidth)} />
	<button
		class="btn-icon size-11 lg:size-10"
		onclick={onsettings}
		aria-label={t('game.settings')}
		title={t('game.settings')}
	>
		<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
			<!-- A cog: teeth from a dashed ring, a ring and a hole -->
			<g fill="none" stroke="currentColor">
				<circle cx="12" cy="12" r="8.6" stroke-width="3.2" stroke-dasharray="3.38 3.38" />
				<circle cx="12" cy="12" r="6" stroke-width="2" />
				<circle cx="12" cy="12" r="2" stroke-width="2" />
			</g>
		</svg>
	</button>
	{#if !isTouch}
		<button
			class="btn-icon hidden size-10 lg:inline-flex"
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
</div>
