<script lang="ts">
	import FirTree from './FirTree.svelte';
	import Snowman from './Snowman.svelte';

	/**
	 * Winter: snow lying on the top edge of the board's surface; beside it, where there is room
	 * (`beside`), a snowman and snowy firs. None of it takes a click.
	 */
	let { beside }: { beside: boolean } = $props();
	const fir = 'fill-[#2e6a5e] dark:fill-[#1d4a52]';
	const snow = 'fill-white dark:fill-[#dbe7f5]';
	/** Lumps of snow in px, enough for the widest board. */
	const lumps = Array.from({ length: 90 }, (_, i) => ({
		x: i * 16 + ((i * 7) % 5) + 8,
		r: 7 + ((i * 5) % 4) * 1.4
	}));
</script>

<div class="winter-only pointer-events-none" aria-hidden="true">
	<svg
		class="absolute inset-x-4 -top-[9px] h-[18px] w-[calc(100%-2rem)] fill-white drop-shadow-[0_-1px_3px_rgb(23_72_122/0.4)] dark:fill-[#dbe7f5]"
	>
		<rect x="0" y="9" width="100%" height="9" rx="4" />
		{#each lumps as l, i (i)}<ellipse cx={l.x} cy="13" rx={l.r} ry={l.r * 0.75} />{/each}
	</svg>
	{#if beside}
		<Snowman class="absolute right-full bottom-0 mr-8 w-20" />
		<div class="absolute bottom-0 left-full ml-8 flex items-end gap-1">
			<FirTree snow class="w-16 {fir}" snowClass={snow} />
			<FirTree snow class="w-10 {fir}" snowClass={snow} />
		</div>
	{/if}
</div>
