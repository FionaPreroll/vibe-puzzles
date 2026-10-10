<script lang="ts">
	/** A lit candle. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 14 20" class={className} aria-hidden="true">
	<path class="candle-flame" d="M7 1 C9.5 4.5 10.5 6 7 9 C3.5 6 4.5 4.5 7 1 Z" fill="#fdba74" />
	<rect x="4" y="10" width="6" height="10" rx="1" fill="#f4ecd8" />
</svg>
