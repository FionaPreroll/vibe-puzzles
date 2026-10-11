<script lang="ts">
	import { resolve } from '$app/paths';
	import { trapFocus } from '../../client/focus';
	import { load, save } from '../../client/storage';
	import { KEY } from '../../client/storageKeys';
	import type { Variant } from '../../core/variants';
	import type { AnyGame } from '../../games';
	import { t, tList } from '../../i18n/index.svelte';
	import VariantPicker from '../VariantPicker.svelte';

	/**
	 * The game's panel: its puzzle types, rules and controls, opening a puzzle by ID, and links to
	 * the scores and the tutorial. A column on wide screens (which can be collapsed), a drawer on
	 * phones (`open`), which keeps the keyboard focus while it is open.
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
	let rulesHidden = $state(load<boolean>(KEY.rulesHidden, false));
	let idInput = $state('');
	let aside: HTMLElement | undefined = $state();

	$effect(() => {
		if (open && !wide && aside) return trapFocus(aside, () => (open = false));
	});

	async function openById() {
		if (await onopenid(idInput)) idInput = '';
	}
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
		<nav class="mt-4" aria-label={t('game.puzzleType')}>
			<h2 class="section-title">{t('game.puzzleType')}</h2>
			<div class="mt-1">
				<VariantPicker {game} current={variant.key} {onpick} />
			</div>
		</nav>

		<section class="mt-5">
			<div class="flex items-center justify-between">
				<h2 class="section-title">{t('game.rules')}</h2>
				<button
					class="link text-sm"
					onclick={() => {
						rulesHidden = !rulesHidden;
						save(KEY.rulesHidden, rulesHidden);
					}}>{rulesHidden ? t('game.show') : t('game.hide')}</button
				>
			</div>
			{#if !rulesHidden}
				<ol class="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
					{#each tList(variant.mode ? `games.${game.id}.modes.${variant.mode}.rules` : `games.${game.id}.rules`) as rule, i (i)}<li
						>
							{rule}
						</li>{/each}
				</ol>
				{#each tList(`games.${game.id}.notes`) as note, i (i)}
					<p class="mt-2 text-xs text-stone-500 dark:text-stone-400">{note}</p>
				{/each}
				<h3 class="section-title mt-3">{t('game.controls')}</h3>
				<p class="mt-1 text-xs text-stone-500 dark:text-stone-400">
					{t(`games.${game.id}.${isTouch ? 'controlsTouch' : 'controlsMouse'}`)}
				</p>
				{#if !isTouch}
					<button class="link mt-1 text-xs" onclick={onshortcuts}>{t('shortcuts.open')}</button>
				{/if}
			{/if}
		</section>

		<form class="mt-5 flex gap-2" onsubmit={(e) => (e.preventDefault(), openById())}>
			<input
				class="input min-w-0 flex-1"
				inputmode="numeric"
				placeholder={t('game.puzzleId')}
				aria-label={t('game.openById')}
				bind:value={idInput}
			/>
			<button class="btn" type="submit">{t('game.open')}</button>
		</form>
		<p class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
			<a class="link" href="{resolve('/scores')}?game={game.id}&v={variant.key}"
				>{t('game.scoresLink')}</a
			>
			{#if variant.mode && game.modeTutorials?.[variant.mode]}
				<a
					class="link"
					href={resolve('/[game]/tutorial/[mode]', { game: game.id, mode: variant.mode })}
					>{t('game.tutorial')}</a
				>
			{:else if game.tutorial}
				<a class="link" href={resolve('/[game]/tutorial', { game: game.id })}
					>{t('game.tutorial')}</a
				>
			{/if}
		</p>
	{/if}
</aside>
