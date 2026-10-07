<script lang="ts">
	import GameView from '#lib/components/GameView.svelte';
	import { gameById } from '#lib/games/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const game = $derived(gameById(data.gameId)!);
</script>

{#key game.id}
	<GameView {game} />
{/key}
