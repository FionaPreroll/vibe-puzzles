<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t, variantLabel } from '#lib/i18n/index.svelte.ts';
	import type { FilmType } from '#lib/inside/film.ts';
	import { FILMS, filmFor, type AskedPuzzle, type FilmEntry } from '#lib/inside/films/index.ts';
	import { ti } from '#lib/inside/i18n/index.ts';
	import Player from '#lib/inside/Player.svelte';

	/**
	 * Inside: films of how the generators and solvers work, one per game, each made from its
	 * generator's trace. Only this page loads the films, their texts and the player; the games do
	 * not import them. A game links here with a puzzle (`?game=…&id=…&p=…`) to show how it was made.
	 */

	// Raw: a deep proxy would never be one of FILMS.
	let chosen = $state.raw(FILMS[0]);
	let type = $state.raw(FILMS[0].type);
	let film = $state.raw(FILMS[0].make());
	/** The puzzle a game linked to, while its film (or the example in its place) is showing. */
	let asked = $state.raw<AskedPuzzle | null>(null);

	onMount(() => {
		const showing = filmFor(new URL(location.href).searchParams);
		if (!showing) return;
		chosen = showing.entry;
		type = showing.type;
		film = showing.film;
		asked = showing.asked ?? null;
	});

	/** A film of the viewer's own choosing: the address no longer names a puzzle. */
	function show(entry: FilmEntry, next: FilmType, seed?: number) {
		chosen = entry;
		type = next;
		film = entry.make(seed, next);
		if (asked) replaceState(resolve('/inside'), {});
		asked = null;
	}

	function choose(next: FilmEntry) {
		if (next !== chosen) show(next, next.type);
	}

	/** The making of another puzzle of the same type (any seed; only the generators must not use `Math.random`). */
	function another() {
		show(chosen, type, 1 + Math.floor(Math.random() * (2 ** 26 - 1)));
	}

	/** A type's name, e.g. "7×7 Normal". */
	const typeName = (v: FilmType) => variantLabel({ key: '', label: '', ...v });
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
	{#if asked}
		{@const values = {
			id: asked.id.toLocaleString('en-US'),
			type: variantLabel(asked.variant),
			game: chosen.name,
			example: typeName(type)
		}}
		<p class="mb-3 text-sm text-stone-600 dark:text-stone-400" data-testid="asked">
			{ti(asked.missing ? `puzzle.${asked.missing}` : 'puzzle.made', values)}
		</p>
	{/if}
	{#key film}
		<Player {film} onanother={another} />
	{/key}
	<p class="mt-4 hidden text-center text-xs text-stone-500 sm:block">{ti('player.keys')}</p>
</section>
