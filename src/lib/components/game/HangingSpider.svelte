<script lang="ts">
	import HalloweenSpider from '../halloween/Spider.svelte';

	/**
	 * Halloween: a spider let down from the page's header, beside the board's stage. It sits outside
	 * the board's scroll container, which would cut off the thread.
	 */
	let {
		headerGap,
		stageWidth
	}: {
		/** How far below the header the board area starts. */
		headerGap: number;
		stageWidth: number;
	} = $props();
</script>

<div
	class="halloween-only halloween-sway pointer-events-none absolute flex w-8 flex-col items-center"
	style:top="{-headerGap}px"
	style:right="calc(50% + {stageWidth / 2}px + 2rem)"
	aria-hidden="true"
	data-spider
>
	<div class="w-px bg-[#b9a6c9] dark:bg-[#5a4c73]" style:height="{headerGap + 4}px"></div>
	<HalloweenSpider swing={false} class="w-8" />
</div>
