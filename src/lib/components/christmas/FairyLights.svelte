<script lang="ts">
	/** A string of fairy lights under the header (draft B); the bulbs glow by night. */
	const COLOURS = ['#e0362c', '#f5c451', '#2f9e5b', '#4f8fe8'];
	const bulbs = Array.from({ length: 70 }, (_, i) => ({
		x: i * 38 + 19,
		colour: COLOURS[i % COLOURS.length],
		delay: `${-((i * 0.7) % 2.4)}s`
	}));
</script>

<svg class="market-only pointer-events-none block h-6 w-full overflow-hidden" aria-hidden="true">
	<path
		d={bulbs.map((b) => `M${b.x - 19} 1 Q${b.x} 9 ${b.x + 19} 1`).join(' ')}
		fill="none"
		class="stroke-[#3b5a3f] dark:stroke-[#4b6a4f]"
		stroke-width="1.2"
	/>
	{#each bulbs as b, i (i)}
		<g style:color={b.colour}>
			<rect
				x={b.x - 1.8}
				y="4"
				width="3.6"
				height="3.4"
				rx="0.8"
				class="fill-[#3b5a3f] dark:fill-[#6b7a5f]"
			/>
			<g class="xmas-bulb" style:--d={b.delay}>
				<circle class="halo" cx={b.x} cy="12" r="8" fill="currentColor" />
				<ellipse cx={b.x} cy="12" rx="3.2" ry="4.8" fill="currentColor" />
			</g>
		</g>
	{/each}
</svg>
