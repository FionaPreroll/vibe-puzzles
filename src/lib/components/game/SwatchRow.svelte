<script lang="ts">
	import type { AnyGame } from '../../games';
	import { t, tList } from '../../i18n/index.svelte';
	import type { ToolState } from './tools.svelte';

	/** The colours of a game's colour tool, while its swatches are shown. */
	let { game, tools }: { game: AnyGame; tools: ToolState } = $props();

	const swatchNames = $derived(tList('swatch'));
</script>

{#if game.toolOptions && tools.swatches}
	<div class="flex flex-wrap items-center gap-2">
		{#each game.toolOptions.values as o (o.value)}
			<button
				class="size-8 rounded-full border-2 {tools.option === o.value
					? 'border-stone-900 dark:border-white'
					: 'border-transparent'}"
				style:background={o.color}
				title="{swatchNames[o.value] ?? o.label} ({o.key})"
				aria-label={t('game.colour', { name: swatchNames[o.value] ?? o.label })}
				onclick={() => tools.pick(o.value)}
			></button>
		{/each}
	</div>
{/if}
