<script lang="ts">
	import FirTree from './FirTree.svelte';
	import Snowman from './Snowman.svelte';

	/** The home page's winter scene next to the title: a snowman and snowy firs on a hill. */
	const fir = 'fill-[#2e6a5e] dark:fill-[#1d4a52]';
	const snow = 'fill-white dark:fill-[#dbe7f5]';
	const hill = 'fill-white dark:fill-[#dbe7f5]';
</script>

<div class="winter-only pointer-events-none shrink-0 select-none" aria-hidden="true">
	<!-- Phones: a small one in the corner -->
	<div class="absolute -top-1 right-0 h-20 w-24 sm:hidden">
		<svg
			viewBox="0 0 96 20"
			class="absolute right-0 bottom-0 w-24 drop-shadow-[0_-1px_2px_rgb(23_72_122/0.18)] {hill}"
		>
			<path d="M0 20 Q30 4 60 10 Q80 2 96 8 V20 Z" />
		</svg>
		<FirTree snow class="absolute bottom-2 left-1 w-9 {fir}" snowClass={snow} />
		<Snowman class="absolute right-1 bottom-1 w-10" />
	</div>
	<div class="relative hidden h-36 w-72 sm:block">
		<svg
			viewBox="0 0 288 40"
			class="absolute inset-x-0 bottom-0 w-full drop-shadow-[0_-2px_3px_rgb(23_72_122/0.15)] {hill}"
		>
			<path d="M0 40 Q60 12 130 22 Q200 2 288 18 V40 Z" />
		</svg>
		<FirTree snow class="absolute right-24 bottom-5 w-14 {fir}" snowClass={snow} />
		<FirTree snow class="absolute right-4 bottom-4 w-20 {fir}" snowClass={snow} />
		<FirTree snow class="absolute right-0 bottom-3 w-9 {fir}" snowClass={snow} />
		<Snowman class="absolute bottom-2 left-12 w-16" />
	</div>
</div>
