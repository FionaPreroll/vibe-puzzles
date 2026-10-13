<script lang="ts">
	import { resolve } from '$app/paths';
	import { load, save } from '../../client/storage';
	import { KEY } from '../../client/storageKeys';
	import type { Variant } from '../../core/variants';
	import type { AnyGame } from '../../games';
	import { t, tList } from '../../i18n/index.svelte';
	import VariantPicker from '../VariantPicker.svelte';

	/**
	 * What the game's panels show about it: its puzzle types, rules and controls, opening a puzzle
	 * by ID, and links to the scores and the tutorial. In the side panel (`SidePanel`) and in the
	 * widescreen panel (`WidePanel`).
	 */
	let {
		game,
		variant,
		isTouch,
		onpick,
		onopenid,
		onshortcuts
	}: {
		game: AnyGame;
		variant: Variant;
		isTouch: boolean;
		onpick: (variantKey: string) => void;
		/** Open the puzzle with the ID typed in; resolves to whether the field is done with it. */
		onopenid: (text: string) => Promise<boolean>;
		onshortcuts: () => void;
	} = $props();

	let rulesHidden = $state(load<boolean>(KEY.rulesHidden, false));
	let idInput = $state('');

	async function openById() {
		if (await onopenid(idInput)) idInput = '';
	}
</script>

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
		<a class="link" href={resolve('/[game]/tutorial/[mode]', { game: game.id, mode: variant.mode })}
			>{t('game.tutorial')}</a
		>
	{:else if game.tutorial}
		<a class="link" href={resolve('/[game]/tutorial', { game: game.id })}>{t('game.tutorial')}</a>
	{/if}
</p>
