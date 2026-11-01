<script lang="ts">
	import Bauble from './Bauble.svelte';

	/**
	 * Christmas: a bauble let down from the page's header on a gold thread, right of the board's
	 * stage (the Halloween spider hangs on the left). It sits outside the board's scroll
	 * container, which would cut off the thread.
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
	class="christmas-only christmas-swing pointer-events-none absolute flex w-10 flex-col items-center select-none"
	style:top="{-headerGap}px"
	style:left="calc(50% + {stageWidth / 2}px + 2.5rem)"
	aria-hidden="true"
	data-bauble
>
	<div class="w-px bg-[#c9a24a]" style:height="{headerGap + 30}px"></div>
	<Bauble colour="#c81e1e" class="-mt-1 w-10" />
</div>
