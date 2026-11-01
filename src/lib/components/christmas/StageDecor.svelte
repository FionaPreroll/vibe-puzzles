<script lang="ts">
	import { adventCandles } from '../../core/theme';
	import AdventWreath from './AdventWreath.svelte';
	import ChristmasTree from './ChristmasTree.svelte';
	import FirTree from './FirTree.svelte';
	import Gift from './Gift.svelte';
	import Snowman from './Snowman.svelte';
	import StrawStar from './StrawStar.svelte';

	/**
	 * The Christmas drafts around the board's surface: snow on its top edge and a snowman (A), a
	 * fir garland with baubles and a tree with presents (B), an Advent wreath and a straw star (C).
	 * Beside it only where there is room (`beside`); none of it takes a click.
	 */
	let { beside }: { beside: boolean } = $props();
	const lit = adventCandles(new Date());
	const fir = 'fill-[#2e6a5e] dark:fill-[#1d4a52]';
	const snow = 'fill-white dark:fill-[#dbe7f5]';
	/** Snow lying on the board's top edge, in px, as wide as any board gets. */
	const lumps = Array.from({ length: 90 }, (_, i) => ({
		x: i * 16 + ((i * 7) % 5),
		r: 7 + ((i * 5) % 4) * 1.4
	}));
</script>

<div class="pointer-events-none" aria-hidden="true">
	<div class="snow-only">
		<svg
			class="absolute inset-x-4 -top-[9px] h-[18px] w-[calc(100%-2rem)] fill-white drop-shadow-[0_-1px_3px_rgb(23_72_122/0.4)] dark:fill-[#dbe7f5]"
		>
			<rect x="0" y="9" width="100%" height="9" rx="4" />
			{#each lumps as l, i (i)}<ellipse cx={l.x + 8} cy="13" rx={l.r} ry={l.r * 0.75} />{/each}
		</svg>
		{#if beside}
			<Snowman class="absolute right-full bottom-0 mr-8 w-20" />
			<div class="absolute bottom-0 left-full ml-8 flex items-end gap-1">
				<FirTree snow class="w-16 {fir}" snowClass={snow} />
				<FirTree snow class="w-10 {fir}" snowClass={snow} />
			</div>
		{/if}
	</div>

	<div class="market-only">
		<!-- A fir garland in swags along the top edge, a bauble in each, a bow where they meet -->
		<svg class="absolute inset-x-5 -top-2.5 h-6 w-[calc(100%-2.5rem)]">
			<defs>
				<pattern id="xmas-garland" width="72" height="24" patternUnits="userSpaceOnUse">
					<path
						d="M0 4 Q36 18 72 4"
						fill="none"
						class="stroke-[#1f6f3f] dark:stroke-[#2f8a52]"
						stroke-width="6"
					/>
					<path
						d="M0 4 Q36 18 72 4"
						fill="none"
						class="stroke-[#2f8a52] dark:stroke-[#3f9f62]"
						stroke-width="2"
						stroke-dasharray="2 4"
					/>
					<path
						d="M0 4 Q36 18 72 4"
						fill="none"
						stroke="#e3b341"
						stroke-width="0.9"
						stroke-dasharray="1 5"
					/>
					<circle cx="36" cy="16.5" r="4.5" fill="#c81e1e" />
					<circle cx="34.6" cy="15" r="1.3" fill="#fff" opacity=".5" />
					<path d="M0 4 l-5 -3 v6 Z M0 4 l5 -3 v6 Z M72 4 l-5 -3 v6 Z" fill="#c81e1e" />
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#xmas-garland)" />
		</svg>
		{#if beside}
			<ChristmasTree class="absolute right-full bottom-0 mr-8 w-28" />
			<div class="absolute bottom-0 left-full ml-8 flex items-end gap-1">
				<Gift class="w-12" />
				<Gift colour="#1f6f3f" ribbon="#c81e1e" class="w-8" />
			</div>
		{/if}
	</div>

	<div class="nordic-only">
		<StrawStar class="absolute top-2 right-2 w-8 opacity-80 lg:w-10" />
		{#if beside}
			<AdventWreath {lit} class="absolute right-full bottom-0 mr-6 w-40" />
		{/if}
	</div>
</div>
