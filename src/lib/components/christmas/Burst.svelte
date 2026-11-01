<script lang="ts">
	import Bauble from './Bauble.svelte';
	import Gift from './Gift.svelte';
	import Heart from './Heart.svelte';
	import PaperStar from './PaperStar.svelte';
	import Snowflake from './Snowflake.svelte';
	import Star from './Star.svelte';
	import StrawStar from './StrawStar.svelte';

	/**
	 * The win animation of a Christmas draft, clipped to the board: snowflakes drift down (A),
	 * presents, baubles and stars fly up (B), paper stars, straw stars and hearts float down (C).
	 */
	let { look, night }: { look: 'snow' | 'market' | 'nordic'; night: boolean } = $props();

	const GIFTS = [
		['#b3261e', '#f5c451'],
		['#1f6f3f', '#c81e1e'],
		['#2563eb', '#e5e7eb'],
		['#d9a63a', '#b3261e']
	];
	const flyers = Array.from({ length: 18 }, (_, i) => ({
		x: `${((i * 37) % 90) + 5}%`,
		delay: `${(i % 6) * 110}ms`,
		drift: `${((i * 53) % 81) - 40}px`,
		turn: `${((i * 71) % 300) - 150}deg`,
		size: i % 3
	}));
	const flash = $derived(
		look === 'snow'
			? night
				? 'rgb(125 223 245 / 0.5)'
				: 'rgb(125 211 252 / 0.55)'
			: look === 'market'
				? 'rgb(245 196 81 / 0.55)'
				: 'rgb(240 184 102 / 0.45)'
	);
</script>

<div
	class="xmas-burst {look === 'market'
		? 'rise'
		: 'fall'} pointer-events-none absolute inset-0 overflow-hidden"
	style:--flash={flash}
	aria-hidden="true"
>
	{#each flyers as f, i (i)}
		<div
			class="flyer"
			style:--x={f.x}
			style:--d={f.delay}
			style:--dx={f.drift}
			style:--turn={f.turn}
			style:--size="{(look === 'snow' ? 18 : 22) + f.size * 9}px"
		>
			{#if look === 'snow'}
				<Snowflake
					class="w-full {night
						? 'text-white drop-shadow-[0_0_6px_rgb(125_223_245/0.9)]'
						: 'text-[#55aaec] drop-shadow-[0_0_2px_white]'}"
				/>
			{:else if look === 'market'}
				{#if night}
					{#if i % 2}<Star class="w-full" />{:else}<span
							class="mx-auto block aspect-square w-1/3 rounded-full bg-[#ffe28a] shadow-[0_0_10px_4px_rgb(245_196_81/0.7)]"
						></span>{/if}
				{:else if i % 3 === 0}
					<Gift colour={GIFTS[i % 4][0]} ribbon={GIFTS[i % 4][1]} class="w-full" />
				{:else if i % 3 === 1}
					<Bauble colour={['#c81e1e', '#1f6f3f', '#2563eb'][i % 3]} class="mx-auto w-3/4" />
				{:else}
					<Star class="w-full" />
				{/if}
			{:else if i % 3 === 0}
				<PaperStar string={0} class="w-full" />
			{:else if i % 3 === 1}
				<StrawStar class="w-full" />
			{:else}
				<Heart class="mx-auto w-3/4" />
			{/if}
		</div>
	{/each}
</div>
