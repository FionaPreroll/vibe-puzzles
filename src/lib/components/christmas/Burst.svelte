<script lang="ts">
	import Bauble from './Bauble.svelte';
	import Gift from './Gift.svelte';
	import Star from './Star.svelte';

	/**
	 * The win animation in the Christmas look, clipped to the board: a golden flash, then presents,
	 * baubles and stars fly up by day, gold stars and lights by night.
	 */
	let { night }: { night: boolean } = $props();

	const GIFTS = [
		['#b3261e', '#f5c451'],
		['#1f6f3f', '#c81e1e'],
		['#2563eb', '#e5e7eb'],
		['#d9a63a', '#b3261e']
	];
	const BAUBLES = ['#c81e1e', '#1f6f3f', '#2563eb'];
	const flyers = Array.from({ length: 18 }, (_, i) => ({
		x: `${((i * 37) % 90) + 5}%`,
		delay: `${(i % 6) * 110}ms`,
		drift: `${((i * 53) % 81) - 40}px`,
		turn: `${((i * 71) % 300) - 150}deg`,
		size: `${22 + (i % 3) * 9}px`
	}));
</script>

<div
	class="christmas-burst pointer-events-none absolute inset-0 overflow-hidden"
	aria-hidden="true"
>
	{#each flyers as f, i (i)}
		<div
			class="flyer"
			style:--x={f.x}
			style:--d={f.delay}
			style:--dx={f.drift}
			style:--turn={f.turn}
			style:--size={f.size}
		>
			{#if night}
				{#if i % 2}
					<Star class="w-full" />
				{:else}
					<span class="light mx-auto block aspect-square w-1/3 rounded-full"></span>
				{/if}
			{:else if i % 3 === 0}
				<Gift colour={GIFTS[i % 4][0]} ribbon={GIFTS[i % 4][1]} class="w-full" />
			{:else if i % 3 === 1}
				<Bauble colour={BAUBLES[i % 3]} class="mx-auto w-3/4" />
			{:else}
				<Star class="w-full" />
			{/if}
		</div>
	{/each}
</div>
