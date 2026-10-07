<script lang="ts">
	import { getStats } from '../client/stats';
	import type { GameModule } from '../core/types';
	import { periodKey, type Variant } from '../core/variants';
	import { t, variantLabel } from '../i18n/index.svelte';

	/** Puzzle types as a size × difficulty table plus the specials with their status. */
	let {
		game,
		current,
		onpick
	}: { game: GameModule; current: string; onpick: (key: string) => void } = $props();

	const regular = $derived(game.variants.filter((v) => !v.special));
	const specials = $derived(game.variants.filter((v) => v.special));
	const sizes = $derived([...new Set(regular.map((v) => `${v.width}×${v.height}`))]);
	const difficulties = $derived([...new Set(regular.map((v) => v.difficulty))]);

	function find(size: string, difficulty: string) {
		return regular.find((v) => `${v.width}×${v.height}` === size && v.difficulty === difficulty);
	}

	function marker(v: Variant) {
		const stats = getStats(game.id, v.key);
		if (v.special) return stats.lastPeriod === periodKey(v.special) ? '✓' : '';
		return stats.streak >= 100 ? '★' : '';
	}

	const cell =
		'w-full rounded-md px-2 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-indigo-500';
	const active =
		'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300';
</script>

<table class="w-full table-fixed text-center">
	<tbody>
		{#each sizes as size (size)}
			<tr>
				<th class="py-0.5 text-left text-sm font-medium tabular-nums">{size}</th>
				{#each difficulties as d (d)}
					{@const v = find(size, d)}
					<td class="p-0.5">
						{#if v}
							<button
								class="{cell} {v.key === current ? active : ''}"
								aria-label={variantLabel(v)}
								aria-current={v.key === current ? 'true' : undefined}
								onclick={() => onpick(v.key)}
							>
								{t(`difficulty.${d}`)}<span class="ml-1 text-amber-500">{marker(v)}</span>
							</button>
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

{#if specials.length}
	<h3 class="section-title mt-3">{t('game.specials')}</h3>
	<ul class="mt-1 grid grid-cols-3 gap-1">
		{#each specials as v (v.key)}
			{@const done = marker(v)}
			<li>
				<button
					class="{cell} {v.key === current ? active : ''}"
					aria-current={v.key === current ? 'true' : undefined}
					onclick={() => onpick(v.key)}
				>
					{variantLabel(v)}
					<span class="block text-xs text-stone-500 dark:text-stone-400"
						>{v.width}×{v.height}
						{#if done}<span class="text-emerald-600 dark:text-emerald-400">{done}</span>{/if}</span
					>
				</button>
			</li>
		{/each}
	</ul>
{/if}
