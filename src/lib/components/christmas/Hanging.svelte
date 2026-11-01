<script lang="ts">
	import Bauble from './Bauble.svelte';
	import PaperStar from './PaperStar.svelte';

	/**
	 * Christmas drafts B and C: a bauble or a paper star let down from the page's header, right of
	 * the board's stage, like the Halloween spider on the left.
	 */
	let { headerGap, stageWidth }: { headerGap: number; stageWidth: number } = $props();
</script>

{#each ['market', 'nordic'] as look (look)}
	<div
		class="{look}-only xmas-swing pointer-events-none absolute flex w-10 flex-col items-center select-none [animation-duration:7s]"
		style:top="{-headerGap}px"
		style:left="calc(50% + {stageWidth / 2}px + 2.5rem)"
		aria-hidden="true"
	>
		<div
			class="w-px {look === 'market' ? 'bg-[#c9a24a]' : 'bg-[#a33a32] dark:bg-[#8b7f71]'}"
			style:height="{headerGap + 30}px"
		></div>
		{#if look === 'market'}
			<Bauble colour="#c81e1e" class="-mt-1 w-10" />
		{:else}
			<PaperStar string={0} class="-mt-0.5 w-12" />
		{/if}
	</div>
{/each}
