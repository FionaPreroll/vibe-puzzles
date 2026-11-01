<script lang="ts">
	/** A decorated Christmas tree with a star, baubles, a garland and lights that glow by night. */
	let { class: className = '' }: { class?: string } = $props();

	const lights = [
		[34, 30],
		[46, 34],
		[28, 50],
		[52, 52],
		[40, 46],
		[22, 70],
		[36, 66],
		[58, 72],
		[46, 80],
		[30, 84],
		[16, 88],
		[64, 90]
	];
	const LIGHT_COLOURS = ['#fde68a', '#fecaca', '#bbf7d0', '#bfdbfe'];
	const baubles = [
		[40, 36, '#c81e1e'],
		[30, 58, '#d9a63a'],
		[50, 62, '#c81e1e'],
		[24, 80, '#2563eb'],
		[44, 74, '#d9a63a'],
		[60, 84, '#c81e1e']
	] as const;
</script>

<svg viewBox="0 0 80 112" class="overflow-visible {className}" aria-hidden="true">
	<rect x="34" y="94" width="12" height="14" rx="1.5" class="fill-[#6b4a2e] dark:fill-[#4b3420]" />
	<g class="fill-[#1f6f3f] dark:fill-[#195c34]">
		<path d="M40 46 L78 98 L2 98 Z" />
		<path d="M40 26 L68 70 L12 70 Z" />
		<path d="M40 8 L58 44 L22 44 Z" />
	</g>
	<g fill="none" stroke="#e3b341" stroke-width="1.6" stroke-linecap="round">
		<path d="M26 40 Q40 48 55 38" />
		<path d="M17 64 Q40 76 64 62" />
		<path d="M8 90 Q40 104 72 88" />
	</g>
	{#each baubles as [x, y, c], i (i)}
		<circle cx={x} cy={y} r="4" fill={c} />
		<circle cx={x - 1.3} cy={y - 1.3} r="1.1" fill="#fff" opacity=".55" />
	{/each}
	{#each lights as [x, y], i (i)}
		<g
			class="xmas-bulb"
			style:color={LIGHT_COLOURS[i % LIGHT_COLOURS.length]}
			style:--d="{-((i * 0.6) % 2.4)}s"
		>
			<circle class="halo" cx={x} cy={y} r="4.5" fill="currentColor" />
			<circle cx={x} cy={y} r="1.8" fill="currentColor" />
		</g>
	{/each}
	<circle class="halo-star" cx="40" cy="10" r="14" fill="#f5c451" />
	<path
		d="M40 0 L43 6.4 L50 7.2 L44.8 11.8 L46.2 18.6 L40 15.2 L33.8 18.6 L35.2 11.8 L30 7.2 L37 6.4 Z"
		fill="#f5c451"
		stroke="#d99a1e"
		stroke-width="1"
		stroke-linejoin="round"
	/>
</svg>
