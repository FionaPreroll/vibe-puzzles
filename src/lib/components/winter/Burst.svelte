<script lang="ts">
	import Snowflake from './Snowflake.svelte';

	/**
	 * The win animation in the winter look, clipped to the board: an icy flash, then snowflakes
	 * drift down, blue by day and glowing white by night.
	 */
	let { night }: { night: boolean } = $props();

	const flakes = Array.from({ length: 18 }, (_, i) => ({
		x: `${((i * 37) % 90) + 5}%`,
		delay: `${(i % 6) * 110}ms`,
		drift: `${((i * 53) % 81) - 40}px`,
		turn: `${((i * 71) % 300) - 150}deg`,
		size: `${18 + (i % 3) * 9}px`
	}));
</script>

<div class="winter-burst pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
	{#each flakes as f, i (i)}
		<div
			class="flyer"
			style:--x={f.x}
			style:--d={f.delay}
			style:--dx={f.drift}
			style:--turn={f.turn}
			style:--size={f.size}
		>
			<Snowflake
				class="w-full {night
					? 'text-white drop-shadow-[0_0_6px_rgb(125_223_245/0.9)]'
					: 'text-[#55aaec] drop-shadow-[0_0_2px_white]'}"
			/>
		</div>
	{/each}
</div>
