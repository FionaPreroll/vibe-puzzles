<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { sudokuFilm } from '#lib/inside/films/sudoku.ts';
	import { ti } from '#lib/inside/i18n/index.ts';
	import Player from '#lib/inside/Player.svelte';

	/**
	 * Inside: films of how the generators and solvers work. Only this page loads the films, their
	 * texts and the player; the games do not import them.
	 */
	let film = $state.raw(sudokuFilm());

	/** The making of another puzzle (any seed; only the generator must not use `Math.random`). */
	function another() {
		film = sudokuFilm(1 + Math.floor(Math.random() * (2 ** 26 - 1)));
	}
</script>

<svelte:head>
	<title>{ti('title')} · {t('app.name')}</title>
</svelte:head>

<h1 class="font-display text-3xl font-bold tracking-tight">{ti('title')}</h1>
<p class="mt-2 text-stone-600 dark:text-stone-400">{ti('intro')}</p>

<section class="panel mt-6 max-w-2xl">
	<h2 class="section-title mb-3">{ti('films.sudoku')}</h2>
	{#key film}
		<Player {film} onanother={another} />
	{/key}
	<p class="mt-4 hidden text-center text-xs text-stone-500 sm:block">{ti('player.keys')}</p>
</section>
