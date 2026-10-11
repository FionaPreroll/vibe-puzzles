<script lang="ts">
	import HalloweenBat from '../halloween/Bat.svelte';
	import HalloweenCandle from '../halloween/Candle.svelte';
	import HalloweenCandyCorn from '../halloween/CandyCorn.svelte';
	import HalloweenCobweb from '../halloween/Cobweb.svelte';
	import HalloweenPumpkin from '../halloween/Pumpkin.svelte';

	/**
	 * Halloween: cobwebs on the board's surface; beside it, where there is room (`beside`), a bat, a
	 * jack-o'-lantern and candles. None of it takes a click.
	 */
	let { beside }: { beside: boolean } = $props();
</script>

<div class="halloween-only pointer-events-none" aria-hidden="true">
	<HalloweenCobweb class="absolute top-0 right-0 w-14 lg:w-16" />
	<HalloweenCobweb class="absolute bottom-0 left-0 w-10 rotate-180 lg:w-12" />
	{#if beside}
		<HalloweenBat
			eyes
			class="halloween-bob absolute top-10 left-full ml-8 w-16 text-[#7c3aed] dark:text-[#8b5cf6]"
		/>
		<div class="absolute right-full bottom-0 mr-6 flex items-end gap-1">
			<HalloweenCandyCorn class="w-4" />
			<HalloweenPumpkin face="night" class="w-16" />
		</div>
		<div class="absolute bottom-0 left-full ml-8 flex items-end gap-2">
			<HalloweenCandle class="w-5" />
			<HalloweenCandle class="w-3.5" />
		</div>
	{/if}
</div>
