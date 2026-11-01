<script lang="ts">
	/**
	 * An Advent wreath of fir with four white candles; `lit` of them burn (the Sundays of Advent
	 * so far). By night the flames glow.
	 */
	let { lit = 4, class: className = '' }: { lit?: number; class?: string } = $props();
	const candles = [
		{ x: 30, y: 46 },
		{ x: 52, y: 42 },
		{ x: 74, y: 42 },
		{ x: 96, y: 46 }
	];
	const needles = Array.from({ length: 30 }, (_, i) => {
		const a = (i / 30) * Math.PI * 2;
		return { x: 63 + Math.cos(a) * 50, y: 52 + Math.sin(a) * 13, r: ((i * 37) % 60) - 30 };
	});
</script>

<svg viewBox="0 0 126 74" class={className} aria-hidden="true">
	<!-- The back half of the wreath, then the candles, then the front half over their feet -->
	<path
		d="M13 52 A50 13 0 0 1 113 52"
		fill="none"
		class="stroke-[#2f5d4a] dark:stroke-[#294d3e]"
		stroke-width="13"
	/>
	{#each candles as c, i (i)}
		<rect
			x={c.x - 4.5}
			y={c.y - 26}
			width="9"
			height="28"
			rx="1.5"
			class="fill-[#f8f3ea] dark:fill-[#efe4d0]"
		/>
		<rect
			x={c.x - 4.5}
			y={c.y - 26}
			width="9"
			height="3"
			rx="1.5"
			class="fill-[#e9e0d0] dark:fill-[#d9ccb4]"
		/>
		<path d="M{c.x} {c.y - 26} v-3" class="stroke-[#3d3631]" stroke-width="1" />
		{#if i < lit}
			<circle class="halo-flame" cx={c.x} cy={c.y - 33} r="9" fill="#f6b04d" />
			<path
				class="candle-flame"
				d="M{c.x} {c.y - 40} C{c.x + 3} {c.y - 35} {c.x + 3.6} {c.y - 32} {c.x} {c.y - 29} C{c.x -
					3.6} {c.y - 32} {c.x - 3} {c.y - 35} {c.x} {c.y - 40} Z"
				fill="#f6b04d"
			/>
		{/if}
	{/each}
	<path
		d="M13 52 A50 13 0 0 0 113 52"
		fill="none"
		class="stroke-[#3f7d5c] dark:stroke-[#2f5d4a]"
		stroke-width="13"
	/>
	<g class="fill-[#2a5240] dark:fill-[#1f3d30]">
		{#each needles as n, i (i)}
			<ellipse cx={n.x} cy={n.y} rx="6" ry="2" transform="rotate({n.r} {n.x} {n.y})" />
		{/each}
	</g>
	<g fill="#b23a3a">
		<circle cx="18" cy="58" r="2.6" />
		<circle cx="22" cy="61" r="2.6" />
		<circle cx="58" cy="66" r="2.6" />
		<circle cx="63" cy="64" r="2.6" />
		<circle cx="104" cy="60" r="2.6" />
		<circle cx="108" cy="57" r="2.6" />
	</g>
</svg>
