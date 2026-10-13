<script lang="ts">
	import { trapFocus } from '../../client/focus';
	import type { Variant } from '../../core/variants';
	import type { AnyGame } from '../../games';
	import { t } from '../../i18n/index.svelte';
	import GameInfo from './GameInfo.svelte';

	/**
	 * The game's panel (`GameInfo`: its puzzle types, rules and controls, opening a puzzle by ID,
	 * and links to the scores and the tutorial). A column on wide screens (which can be
	 * collapsed), a drawer on phones (`open`), which keeps the keyboard focus while it is open.
	 */
	let {
		game,
		variant,
		isTouch,
		wide,
		open = $bindable(false),
		onpick,
		onopenid,
		onshortcuts
	}: {
		game: AnyGame;
		variant: Variant;
		isTouch: boolean;
		wide: boolean;
		open: boolean;
		onpick: (variantKey: string) => void;
		/** Open the puzzle with the ID typed in; resolves to whether the field is done with it. */
		onopenid: (text: string) => Promise<boolean>;
		onshortcuts: () => void;
	} = $props();

	let collapsed = $state(false);
	let aside: HTMLElement | undefined = $state();

	$effect(() => {
		if (open && !wide && aside) return trapFocus(aside, () => (open = false));
	});
</script>

{#if open}
	<button
		class="fixed inset-0 z-30 bg-black/40 lg:hidden"
		aria-label={t('game.closeMenu')}
		onclick={() => (open = false)}
	></button>
{/if}
<aside
	bind:this={aside}
	class="panel shrink-0 lg:sticky lg:top-4 lg:block {collapsed
		? 'lg:w-14'
		: 'lg:w-72'} lg:rounded-xl {open
		? 'fixed inset-y-0 left-0 z-40 block w-[min(22rem,88vw)] overflow-y-auto rounded-none'
		: 'hidden'}"
	aria-label={t('game.menu', { game: game.name })}
>
	<div class="flex items-center justify-between gap-2">
		{#if !collapsed}
			<h1 class="font-display text-2xl font-bold tracking-tight">
				<span aria-hidden="true">{game.icon}</span>
				{game.name}
				{#if game.earlyAccess}<span class="early-access align-middle">{t('game.earlyAccess')}</span
					>{/if}
			</h1>
		{/if}
		<button
			class="btn-icon hidden lg:inline-flex"
			aria-label={collapsed ? t('game.expandPanel') : t('game.collapsePanel')}
			onclick={() => (collapsed = !collapsed)}>{collapsed ? '»' : '«'}</button
		>
		<button
			class="btn-icon lg:hidden"
			aria-label={t('game.closeMenu')}
			onclick={() => (open = false)}>✕</button
		>
	</div>
	{#if !collapsed}
		<GameInfo {game} {variant} {isTouch} {onpick} {onopenid} {onshortcuts} />
	{/if}
</aside>
