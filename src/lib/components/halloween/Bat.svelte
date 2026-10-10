<script lang="ts">
	/** A bat in the text colour, optionally with glowing eyes. */
	let { eyes = false, class: className = '' }: { eyes?: boolean; class?: string } = $props();
</script>

<svg viewBox="0 0 100 44" fill="currentColor" class={className} aria-hidden="true">
	<path
		d="M44 16 L46 8 L48 14 L52 14 L54 8 L56 16 C62 10 78 6 98 12 C90 16 86 22 86 30 C82 26 76 26 72 30 C68 26 62 27 60 32 C57 30 54 32 52 38 L50 42 L48 38 C46 32 43 30 40 32 C38 27 32 26 28 30 C24 26 18 26 14 30 C14 22 10 16 2 12 C22 6 38 10 44 16 Z"
	/>
	{#if eyes}
		<g class="fill-[#fde68a] dark:fill-[#fdba74]">
			<circle cx="47.5" cy="17.5" r="1.4" />
			<circle cx="52.5" cy="17.5" r="1.4" />
		</g>
	{/if}
</svg>
