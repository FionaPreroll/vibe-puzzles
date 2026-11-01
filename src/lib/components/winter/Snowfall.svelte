<script lang="ts">
	/** Snow falling gently through its box (fills the positioned parent), in the text colour. */
	let { count = 26, class: className = '' }: { count?: number; class?: string } = $props();

	const flakes = $derived(
		Array.from({ length: count }, (_, i) => ({
			x: `${(i * 37 + 11) % 100}%`,
			size: `${[4, 6, 5, 8, 3, 7][i % 6]}px`,
			delay: `${-((i * 1.7) % 12)}s`,
			time: `${9 + ((i * 3) % 7)}s`,
			drift: `${((i * 29) % 41) - 20}px`,
			opacity: `${[0.9, 0.6, 0.8, 0.5, 0.7][i % 5]}`
		}))
	);
</script>

<div
	class="winter-snowfall pointer-events-none absolute inset-0 overflow-hidden {className}"
	aria-hidden="true"
>
	{#each flakes as f, i (i)}
		<span
			class="flake block aspect-square rounded-full bg-current"
			style:--x={f.x}
			style:--s={f.size}
			style:--d={f.delay}
			style:--t={f.time}
			style:--dx={f.drift}
			style:--o={f.opacity}
		></span>
	{/each}
</div>
