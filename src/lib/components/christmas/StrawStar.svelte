<script lang="ts">
	/** A straw star with eight points, tied with a red thread. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="-30 -30 60 60" class="xmas-glow-warm {className}" aria-hidden="true">
	<g class="fill-[#d9b56a] dark:fill-[#f0c27a]">
		{#each [0, 45, 90, 135] as a (a)}
			<path transform="rotate({a})" d="M0 -29 L2.4 0 L0 29 L-2.4 0 Z" />
		{/each}
		{#each [22.5, 67.5, 112.5, 157.5] as a (a)}
			<path transform="rotate({a})" d="M0 -18 L1.8 0 L0 18 L-1.8 0 Z" opacity=".85" />
		{/each}
	</g>
	<circle r="3.4" fill="none" stroke="#b23a3a" stroke-width="1.6" />
</svg>
