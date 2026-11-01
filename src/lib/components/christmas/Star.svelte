<script lang="ts">
	/** A five-pointed gold star; it glows at night. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 40 38" class="christmas-glow {className}" aria-hidden="true">
	<path
		d="M20 1 L25.3 13.3 L38.6 14.5 L28.5 23.3 L31.5 36.4 L20 29.5 L8.5 36.4 L11.5 23.3 L1.4 14.5 L14.7 13.3 Z"
		fill="#f5c451"
		stroke="#d99a1e"
		stroke-width="1.5"
		stroke-linejoin="round"
	/>
</svg>
