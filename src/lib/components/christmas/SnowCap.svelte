<script lang="ts">
	/** Snow lying on the edge of the header, with icicles hanging from it (draft A). */
	const lumps = Array.from({ length: 160 }, (_, i) => ({
		x: i * 15 + ((i * 7) % 5),
		r: 6 + ((i * 5) % 4)
	}));
	const icicles = Array.from({ length: 90 }, (_, i) => ({
		x: i * 27 + ((i * 13) % 11),
		len: [7, 12, 5, 10, 15, 6, 9][i % 7]
	}));
</script>

<svg class="snow-only pointer-events-none block h-6 w-full overflow-hidden" aria-hidden="true">
	<g class="fill-[#cfe3f5] dark:fill-[#9fc2e0]">
		{#each icicles as c, i (i)}
			<path d="M{c.x - 2.2} 4 L{c.x + 2.2} 4 L{c.x} {6 + c.len} Z" />
		{/each}
	</g>
	<g class="fill-white drop-shadow-[0_1px_1px_rgb(23_72_122/0.25)] dark:fill-[#e6eef7]">
		<rect x="0" y="0" width="100%" height="3" />
		{#each lumps as l, i (i)}<circle cx={l.x} cy="1" r={l.r * 0.55} />{/each}
	</g>
</svg>
