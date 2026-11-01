<script lang="ts">
	/** A present with a ribbon and a bow. */
	let {
		colour = '#b3261e',
		ribbon = '#f5c451',
		class: className = ''
	}: { colour?: string; ribbon?: string; class?: string } = $props();
</script>

<svg viewBox="0 0 40 40" class={className} aria-hidden="true">
	<path d="M20 12 C12 2 6 6 10 11 Z M20 12 C28 2 34 6 30 11 Z" fill={ribbon} />
	<rect x="4" y="16" width="32" height="24" rx="2" fill={colour} />
	<rect x="2" y="11" width="36" height="8" rx="2" fill={colour} />
	<rect x="2" y="17" width="36" height="2" fill="#000" opacity=".12" />
	<rect x="17" y="11" width="6" height="29" fill={ribbon} />
</svg>
