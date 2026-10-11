<script lang="ts">
	import { trapFocus } from '../../client/focus';
	import { t } from '../../i18n/index.svelte';

	/**
	 * The zoom button and its slider popover. A press anywhere else closes the popover, and so does
	 * Escape (the page handles it while the focus is elsewhere).
	 */
	let {
		zoom,
		open = $bindable(false),
		onzoom,
		onopen = () => {}
	}: {
		/** Relative to the automatic size: 1 fits the screen. */
		zoom: number;
		open: boolean;
		onzoom: (zoom: number) => void;
		/** The button opens the popover (called before it shows). */
		onopen?: () => void;
	} = $props();

	let box: HTMLDivElement | undefined = $state();
</script>

<svelte:window
	onpointerdown={(e) => {
		if (open && !box?.contains(e.target as Node)) open = false;
	}}
/>

<div class="relative -mr-1.5" bind:this={box}>
	<button
		class="btn-icon size-11 lg:size-10"
		onclick={() => {
			if (!open) onopen();
			open = !open;
		}}
		aria-expanded={open}
		aria-label={t('game.zoom')}
		title={t('game.zoom')}
	>
		<!-- A magnifier with a plus: the "⌕" glyph alone was too small to recognise on phones -->
		<svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
			<circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2" />
			<path
				d="M12.5 12.5 17 17M6 8.5h5M8.5 6v5"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			/>
		</svg>
	</button>
	{#if open}
		<div
			class="popover absolute top-full right-0 z-20 mt-1 flex w-72 items-center gap-2"
			{@attach (node) => trapFocus(node, () => (open = false))}
		>
			<input
				type="range"
				min="30"
				max="300"
				value={Math.round(zoom * 100)}
				oninput={(e) => onzoom(Number(e.currentTarget.value) / 100)}
				class="flex-1 accent-indigo-600"
				aria-label={t('game.zoom')}
			/>
			<button class="btn-sm" onclick={() => onzoom(1)} title={t('game.resetZoom')}
				>{zoom === 1 ? t('game.fit') : `${Math.round(zoom * 100)}%`}</button
			>
		</div>
	{/if}
</div>
