<script lang="ts">
	import Tutorial from '#lib/components/Tutorial.svelte';
	import { gameById } from '#lib/games/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const game = $derived(gameById(data.gameId)!);
</script>

{#key game.id}
	<Tutorial {game} />
{/key}
