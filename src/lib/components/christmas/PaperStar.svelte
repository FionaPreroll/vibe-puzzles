<script lang="ts">
	/**
	 * A Scandinavian paper star with punched holes, on a string. Red by day; by night it is lit
	 * from inside and glows.
	 */
	let { string = 10, class: className = '' }: { string?: number; class?: string } = $props();
	const holes = [0, 72, 144, 216, 288];
</script>

<svg viewBox="0 {-string} 60 {62 + string}" class="xmas-glow-warm {className}" aria-hidden="true">
	<path d="M30 {-string} V6" class="stroke-[#a33a32] dark:stroke-[#8b7f71]" stroke-width="1" />
	<path
		d="M30 6 L36.5 23.6 L55.2 24.2 L40.4 35.6 L45.6 53.6 L30 43 L14.4 53.6 L19.6 35.6 L4.8 24.2 L23.5 23.6 Z"
		class="fill-[#b23a3a] stroke-[#8f2b25] dark:fill-[#fde9c0] dark:stroke-[#f0b866]"
		stroke-width="1.2"
		stroke-linejoin="round"
	/>
	<g class="fill-[#f8f5f0] dark:fill-[#e49c3c]">
		<circle cx="30" cy="32" r="3" />
		{#each holes as a (a)}
			<g transform="rotate({a} 30 32)">
				<circle cx="30" cy="22" r="1.6" />
				<circle cx="30" cy="16" r="1.1" />
			</g>
		{/each}
	</g>
	<path
		d="M30 54 V60 M28 62 L30 58 L32 62"
		class="stroke-[#a33a32] dark:stroke-[#e49c3c]"
		stroke-width="1"
		fill="none"
	/>
</svg>
