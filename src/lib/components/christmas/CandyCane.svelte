<script lang="ts">
	/** A candy cane, red and white. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 30 64" class={className} aria-hidden="true">
	<path
		d="M10 60 V20 A9 9 0 0 1 28 20 V24"
		fill="none"
		stroke="#fff"
		stroke-width="7"
		stroke-linecap="round"
	/>
	<path
		d="M10 60 V20 A9 9 0 0 1 28 20 V24"
		fill="none"
		stroke="#c81e1e"
		stroke-width="7"
		stroke-dasharray="4 5"
	/>
	<path
		d="M10 60 V20 A9 9 0 0 1 28 20 V24"
		fill="none"
		stroke="#000"
		stroke-opacity=".12"
		stroke-width="7.6"
		stroke-linecap="round"
		class="hidden"
	/>
</svg>
