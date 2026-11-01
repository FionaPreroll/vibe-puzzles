<script lang="ts">
	import ChristmasTree from './ChristmasTree.svelte';
	import Gift from './Gift.svelte';

	/**
	 * Christmas: a fir garland with baubles along the top edge of the board's surface; beside it,
	 * where there is room (`beside`), a tree and presents. None of it takes a click.
	 */
	let { beside }: { beside: boolean } = $props();
	const swag = 'M0 4 Q36 18 72 4';
</script>

<div class="christmas-only pointer-events-none" aria-hidden="true">
	<!-- Swags of fir, a bauble in each, a red bow where they meet -->
	<svg class="absolute inset-x-5 -top-2.5 h-6 w-[calc(100%-2.5rem)]">
		<defs>
			<pattern id="christmas-garland" width="72" height="24" patternUnits="userSpaceOnUse">
				<path
					d={swag}
					fill="none"
					class="stroke-[#1f6f3f] dark:stroke-[#2f8a52]"
					stroke-width="6"
				/>
				<path
					d={swag}
					fill="none"
					class="stroke-[#2f8a52] dark:stroke-[#3f9f62]"
					stroke-width="2"
					stroke-dasharray="2 4"
				/>
				<path d={swag} fill="none" stroke="#e3b341" stroke-width="0.9" stroke-dasharray="1 5" />
				<circle cx="36" cy="16.5" r="4.5" fill="#c81e1e" />
				<circle cx="34.6" cy="15" r="1.3" fill="#fff" opacity=".5" />
				<path d="M0 4 l-5 -3 v6 Z M0 4 l5 -3 v6 Z M72 4 l-5 -3 v6 Z" fill="#c81e1e" />
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#christmas-garland)" />
	</svg>
	{#if beside}
		<ChristmasTree class="absolute right-full bottom-0 mr-8 w-28" />
		<div class="absolute bottom-0 left-full ml-8 flex items-end gap-1">
			<Gift class="w-12" />
			<Gift colour="#1f6f3f" ribbon="#c81e1e" class="w-8" />
		</div>
	{/if}
</div>
