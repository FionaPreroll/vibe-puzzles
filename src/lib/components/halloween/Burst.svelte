<script lang="ts">
	import Bat from './Bat.svelte';
	import CandyCorn from './CandyCorn.svelte';
	import Pumpkin from './Pumpkin.svelte';

	/**
	 * The win animation in the Halloween look, clipped to the board: a warm flash, then pumpkins
	 * and candy corn fly up by day, a flock of bats by night.
	 */
	let { night }: { night: boolean } = $props();

	const flyers = Array.from({ length: 16 }, (_, i) => ({
		x: `${((i * 37) % 90) + 5}%`,
		delay: `${(i % 5) * 90}ms`,
		drift: `${((i * 53) % 81) - 40}px`,
		turn: `${((i * 71) % 90) - 45}deg`,
		size: i % 3
	}));
</script>

<div
	class="halloween-burst pointer-events-none absolute inset-0 overflow-hidden"
	aria-hidden="true"
>
	{#each flyers as f, i (i)}
		<div
			class="flyer"
			style:--x={f.x}
			style:--d={f.delay}
			style:--dx={f.drift}
			style:--turn={night ? '0deg' : f.turn}
			style:--size="{(night ? 30 : 22) + f.size * 8}px"
		>
			{#if night}
				<Bat eyes class="flap w-full text-[#d9ccff]" />
			{:else if i % 3 === 0}
				<Pumpkin face="always" class="w-full" />
			{:else if i % 3 === 1}
				<CandyCorn class="mx-auto w-3/4" />
			{:else}
				<span class="mx-auto block aspect-square w-1/2 rounded-full bg-[#7c3aed]"></span>
			{/if}
		</div>
	{/each}
</div>
