<script lang="ts">
	/** A Christmas bauble on a short thread, with a band and a shine. */
	let {
		colour = '#b3261e',
		band = '#f5c451',
		thread = 0,
		class: className = ''
	}: { colour?: string; band?: string; thread?: number; class?: string } = $props();
</script>

<svg viewBox="0 {-thread} 30 {40 + thread}" class={className} aria-hidden="true">
	{#if thread}<path d="M15 {-thread} V5" stroke="#c9a24a" stroke-width="0.8" />{/if}
	<circle cx="15" cy="4" r="2.4" fill="none" stroke="#c9a24a" stroke-width="1.2" />
	<rect x="11" y="5.5" width="8" height="5" rx="1" fill="#d9a63a" />
	<circle cx="15" cy="24" r="14" fill={colour} />
	<path d="M1.6 21.5 Q15 27 28.4 21.5 L28.8 25 Q15 31 1.2 25 Z" fill={band} opacity=".9" />
	<ellipse
		cx="9.5"
		cy="17"
		rx="3.4"
		ry="5"
		fill="#fff"
		opacity=".35"
		transform="rotate(30 9.5 17)"
	/>
</svg>
