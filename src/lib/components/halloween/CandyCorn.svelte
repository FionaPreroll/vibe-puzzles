<script lang="ts">
	/** A piece of candy corn. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 20 24" class={className} aria-hidden="true">
	<path d="M0 24 H20 L16.7 16 H3.3 Z" fill="#facc15" />
	<path d="M3.3 16 H16.7 L13.3 8 H6.7 Z" fill="#f97316" />
	<path d="M6.7 8 H13.3 L10 0 Z" fill="#ffffff" stroke="#e9d5ff" stroke-width="1" />
</svg>
