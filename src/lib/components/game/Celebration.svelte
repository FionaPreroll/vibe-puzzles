<script lang="ts">
	import { theme } from '../../client/settings.svelte';
	import { CELEBRATION_COLOURS } from '../../core/grid';
	import HalloweenBurst from '../halloween/Burst.svelte';

	/** The short celebration over a board that was just solved. */
</script>

{#if theme.look === 'halloween'}
	<HalloweenBurst night={theme.night} />
{:else}
	<!-- Clipped to the board so the sparkles never resize the page -->
	<div class="solved-burst pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<!-- Confetti raining down, sparkles bursting from the middle -->
		{#each Array.from({ length: 36 }, (_, i) => i) as i (i)}
			<i
				class="confetti"
				style:--x="{(i * 37) % 100}%"
				style:--c={CELEBRATION_COLOURS[i % CELEBRATION_COLOURS.length]}
				style:--d="{(i % 6) * 70}ms"
				style:--dx="{((i * 53) % 81) - 40}px"
				style:--turn="{((i * 97) % 5) + 1}turn"
				style:--r={i % 3 === 0 ? '50%' : '2px'}
			></i>
		{/each}
		{#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
			<span
				style:--a="{i * 30}deg"
				style:--d="{(i % 3) * 60}ms"
				style:--c={CELEBRATION_COLOURS[(i * 3) % CELEBRATION_COLOURS.length]}>✦</span
			>
		{/each}
	</div>
{/if}
