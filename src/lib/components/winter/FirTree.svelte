<script lang="ts">
	/**
	 * A fir tree in three tiers, optionally with snow on its branches. The colours come from the
	 * classes: `fill` for the tree, the snow is `snowClass`.
	 */
	let {
		snow = false,
		class: className = '',
		snowClass = 'fill-white'
	}: { snow?: boolean; class?: string; snowClass?: string } = $props();

	/** Snow along a branch's lower edge, from x `a` to `b` at height `y`: a scalloped band. */
	function band(a: number, b: number, y: number) {
		const n = Math.round((b - a) / 5.5);
		const w = (b - a) / n;
		let d = `M${a} ${y + 1.8} L${a} ${y}`;
		for (let i = 0; i < n; i++) {
			const x = a + i * w;
			d += ` Q${x + w / 2} ${y - (i % 2 ? 4.2 : 5.4)} ${x + w} ${y}`;
		}
		return `${d} L${b} ${y + 1.8} Z`;
	}
</script>

<svg viewBox="0 0 60 90" class={className} aria-hidden="true">
	<rect x="26" y="72" width="8" height="14" rx="1" class="fill-[#6b4a2e] dark:fill-[#3b2a1c]" />
	<path d="M30 36 L58 74 L2 74 Z" />
	<path d="M30 18 L52 52 L8 52 Z" />
	<path d="M30 3 L46 31 L14 31 Z" />
	{#if snow}
		<g class={snowClass}>
			<path d="M30 3 L36.3 14 Q33 12.6 30 15 Q27 12.6 23.7 14 Z" />
			<path d={band(14.5, 45.5, 30)} />
			<path d={band(8.5, 51.5, 51)} />
			<path d={band(2.5, 57.5, 73)} />
		</g>
	{/if}
</svg>
