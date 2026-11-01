<script lang="ts">
	/** A candy cane, red and white, with a fine edge that keeps the white stripes visible by day. */
	let { class: className = '' }: { class?: string } = $props();
	const cane = 'M10 59 V20 A9 9 0 0 1 28 20 V24';
</script>

<svg viewBox="0 0 30 64" class={className} aria-hidden="true">
	<path
		d={cane}
		fill="none"
		class="stroke-[#c9b08e] dark:stroke-transparent"
		stroke-width="8.5"
		stroke-linecap="round"
	/>
	<path d={cane} fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" />
	<path d={cane} fill="none" stroke="#c81e1e" stroke-width="7" stroke-dasharray="4 5" />
</svg>
