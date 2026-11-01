<script lang="ts">
	import { adventCandles } from '../../core/theme';
	import AdventWreath from './AdventWreath.svelte';
	import ChristmasTree from './ChristmasTree.svelte';
	import FirTree from './FirTree.svelte';
	import Gift from './Gift.svelte';
	import CandyCane from './CandyCane.svelte';
	import PaperStar from './PaperStar.svelte';
	import Snowman from './Snowman.svelte';
	import StrawStar from './StrawStar.svelte';

	/** The home page's scene next to the title in each Christmas draft; phones get a small one. */
	const lit = adventCandles(new Date());
	const fir = 'fill-[#2e6a5e] dark:fill-[#1d4a52]';
	const snow = 'fill-white dark:fill-[#dbe7f5]';
</script>

<div class="pointer-events-none shrink-0 select-none" aria-hidden="true">
	<!-- A: a snowman and snowy firs on a hill -->
	<div class="snow-only">
		<div class="absolute -top-1 right-0 h-20 w-24 sm:hidden">
			<svg
				viewBox="0 0 96 20"
				class="absolute right-0 bottom-0 w-24 fill-white drop-shadow-[0_-1px_2px_rgb(23_72_122/0.18)] dark:fill-[#dbe7f5]"
			>
				<path d="M0 20 Q30 4 60 10 Q80 2 96 8 V20 Z" />
			</svg>
			<FirTree snow class="absolute bottom-2 left-1 w-9 {fir}" snowClass={snow} />
			<Snowman class="absolute right-1 bottom-1 w-10" />
		</div>
		<div class="relative hidden h-36 w-72 sm:block">
			<svg
				viewBox="0 0 288 40"
				class="absolute inset-x-0 bottom-0 w-full fill-white drop-shadow-[0_-2px_3px_rgb(23_72_122/0.15)] dark:fill-[#dbe7f5]"
			>
				<path d="M0 40 Q60 12 130 22 Q200 2 288 18 V40 Z" />
			</svg>
			<FirTree snow class="absolute right-24 bottom-5 w-14 {fir}" snowClass={snow} />
			<FirTree snow class="absolute right-4 bottom-4 w-20 {fir}" snowClass={snow} />
			<FirTree snow class="absolute right-0 bottom-3 w-9 {fir}" snowClass={snow} />
			<Snowman class="absolute bottom-2 left-12 w-16" />
		</div>
	</div>

	<!-- B: a decorated tree with presents -->
	<div class="market-only">
		<div class="absolute -top-1 right-0 h-20 w-24 sm:hidden">
			<ChristmasTree class="absolute right-3 bottom-0 w-12" />
			<Gift colour="#1f6f3f" ribbon="#c81e1e" class="absolute right-0 bottom-0 w-6" />
			<Gift class="absolute bottom-0 left-4 w-7" />
		</div>
		<div class="relative hidden h-36 w-72 sm:block">
			<ChristmasTree class="absolute right-20 bottom-0 w-24" />
			<Gift class="absolute right-[10.5rem] bottom-0 w-12" />
			<Gift colour="#1f6f3f" ribbon="#c81e1e" class="absolute right-[13.5rem] bottom-0 w-8" />
			<Gift colour="#2563eb" ribbon="#e5e7eb" class="absolute right-10 bottom-0 w-10" />
			<Gift colour="#d9a63a" ribbon="#b3261e" class="absolute right-3 bottom-0 w-7" />
			<CandyCane class="absolute right-0 bottom-0 w-4 rotate-12" />
		</div>
	</div>

	<!-- C: an Advent wreath under paper stars -->
	<div class="nordic-only">
		<div class="absolute -top-1 right-0 h-20 w-24 sm:hidden">
			<PaperStar string={4} class="xmas-swing absolute top-0 right-1 w-8" />
			<AdventWreath {lit} class="absolute bottom-0 left-0 w-20" />
		</div>
		<div class="relative hidden h-36 w-72 sm:block">
			<PaperStar string={24} class="xmas-swing absolute -top-8 right-4 w-14" />
			<PaperStar string={8} class="xmas-swing absolute -top-6 right-24 w-9 [animation-delay:-2s]" />
			<StrawStar class="absolute top-6 right-40 w-8 opacity-90" />
			<AdventWreath {lit} class="absolute right-6 bottom-0 w-44" />
		</div>
	</div>
</div>
