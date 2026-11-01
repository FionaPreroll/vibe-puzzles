<script lang="ts">
	/** A six-armed snowflake in the text colour. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg
	viewBox="-12 -12 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	class={className}
	aria-hidden="true"
>
	{#each [0, 60, 120, 180, 240, 300] as a (a)}
		<path
			transform="rotate({a})"
			d="M0 0 V-10 M0 -6.2 L-2.8 -8.8 M0 -6.2 L2.8 -8.8 M0 -2.8 L-1.8 -4.6 M0 -2.8 L1.8 -4.6"
		/>
	{/each}
</svg>
