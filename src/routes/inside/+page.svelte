<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { BasePuzzle } from '#lib/core/types.ts';
	import type { Film } from '#lib/inside/film.ts';
	import { loopFilm } from '#lib/inside/films/loop.ts';
	import { pinwheelFilm } from '#lib/inside/films/pinwheel.ts';
	import { sudokuFilm } from '#lib/inside/films/sudoku.ts';
	import { tetroidFilm } from '#lib/inside/films/tetroid.ts';
	import { ti } from '#lib/inside/i18n/index.ts';
	import Player from '#lib/inside/Player.svelte';

	/**
	 * Inside: films of how the generators and solvers work, one per game, each made from its
	 * generator's trace. Only this page loads the films, their texts and the player; the games do
	 * not import them.
	 */
	const FILMS: { id: string; name: string; make: (seed?: number) => Film<BasePuzzle, unknown> }[] =
		[
			{ id: 'sudoku', name: 'Sudoku', make: sudokuFilm },
			{ id: 'pinwheel', name: 'Pinwheel', make: pinwheelFilm },
			{ id: 'tetroid', name: 'Tetroid', make: tetroidFilm },
			{ id: 'loop', name: 'Loop', make: loopFilm }
		];

	// Raw: a deep proxy would never be one of FILMS.
	let chosen = $state.raw(FILMS[0]);
	let film = $state.raw(FILMS[0].make());

	function choose(next: (typeof FILMS)[number]) {
		if (next === chosen) return;
		chosen = next;
		film = next.make();
	}

	/** The making of another puzzle (any seed; only the generators must not use `Math.random`). */
	function another() {
		film = chosen.make(1 + Math.floor(Math.random() * (2 ** 26 - 1)));
	}
</script>

<svelte:head>
	<title>{ti('title')} · {t('app.name')}</title>
</svelte:head>

<h1 class="font-display text-3xl font-bold tracking-tight">{ti('title')}</h1>
<p class="mt-2 text-stone-600 dark:text-stone-400">{ti('intro')}</p>

<div class="mt-6 flex flex-wrap gap-2" role="group" aria-label={ti('films.label')}>
	{#each FILMS as f (f.id)}
		<button
			class="btn {chosen === f ? 'btn-active' : ''}"
			aria-pressed={chosen === f}
			onclick={() => choose(f)}>{f.name}</button
		>
	{/each}
</div>

<section class="panel mt-3 max-w-2xl">
	<h2 class="section-title mb-3">{ti(`films.${chosen.id}`)}</h2>
	{#key film}
		<Player {film} onanother={another} />
	{/key}
	<p class="mt-4 hidden text-center text-xs text-stone-500 sm:block">{ti('player.keys')}</p>
</section>
