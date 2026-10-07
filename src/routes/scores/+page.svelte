<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { replaceState } from '$app/navigation';
	import {
		currentPlayer,
		leaderboard,
		serverAvailable,
		type Leaderboard
	} from '#lib/client/api.ts';
	import { getStats, type VariantStats } from '#lib/client/stats.ts';
	import { formatDuration } from '#lib/core/time.ts';
	import { encodePuzzleId, periodKey, specialSeed } from '#lib/core/variants.ts';
	import { GAMES } from '#lib/games/index.ts';

	let gameId = $state(GAMES[0].id);
	let variantKey = $state(GAMES[0].variants[0].key);
	let hasServer = $state<boolean | null>(null);
	let board = $state<Leaderboard | null>(null);
	let boardError = $state('');
	let stats = $state<VariantStats | null>(null);

	const game = $derived(GAMES.find((g) => g.id === gameId) ?? GAMES[0]);
	const variant = $derived(game.variants.find((v) => v.key === variantKey) ?? game.variants[0]);

	onMount(() => {
		const q = new URL(location.href).searchParams;
		const g = GAMES.find((x) => x.id === q.get('game'));
		if (g) {
			gameId = g.id;
			if (g.variants.some((v) => v.key === q.get('v'))) variantKey = q.get('v')!;
		}
		serverAvailable().then((ok) => (hasServer = ok));
	});

	$effect(() => {
		if (!game.variants.some((v) => v.key === variantKey)) variantKey = game.variants[0].key;
	});

	$effect(() => {
		stats = getStats(game.id, variant.key);
		if (typeof location !== 'undefined') {
			replaceState(`${resolve('/scores')}?game=${game.id}&v=${variant.key}`, {});
		}
	});

	$effect(() => {
		const g = game;
		const v = variant;
		board = null;
		boardError = '';
		if (!hasServer) return;
		const index = g.variants.indexOf(v);
		const puzzleId = v.special
			? encodePuzzleId(index, specialSeed(g.id, v.special, periodKey(v.special)))
			: undefined;
		leaderboard(g.id, v.key, puzzleId)
			.then((b) => (board = b))
			.catch((e) => (boardError = String(e.message ?? e)));
	});

	const average = $derived(stats && stats.solved ? stats.totalMs / stats.solved : null);
</script>

<svelte:head>
	<title>Scores · Vibe Puzzles</title>
</svelte:head>

<h1 class="text-3xl font-bold tracking-tight">Hall of fame & statistics</h1>

<div class="mt-6 flex flex-wrap gap-3">
	<label class="flex items-center gap-2 text-sm">
		Game
		<select class="input" bind:value={gameId}>
			{#each GAMES as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
		</select>
	</label>
	<label class="flex items-center gap-2 text-sm">
		Puzzle type
		<select class="input" bind:value={variantKey}>
			{#each game.variants as v (v.key)}<option value={v.key}>{v.label}</option>{/each}
		</select>
	</label>
</div>

<div class="mt-6 grid gap-6 lg:grid-cols-2">
	<section class="panel">
		<h2 class="text-lg font-semibold">Your statistics</h2>
		<p class="text-xs text-stone-500">Kept on this device.</p>
		{#if stats}
			<dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each [['Solved', String(stats.solved)], ['Current streak', String(stats.streak)], ['Best streak', String(stats.bestStreak)], ['Best time', stats.bestMs != null ? formatDuration(stats.bestMs) : '–'], ['Average', average != null ? formatDuration(average) : '–']] as [label, value] (label)}
					<div class="rounded-lg bg-stone-100 p-3 dark:bg-stone-800">
						<dt class="text-xs text-stone-500 dark:text-stone-400">{label}</dt>
						<dd class="mt-1 font-mono text-xl tabular-nums">{value}</dd>
					</div>
				{/each}
			</dl>
			{#if stats.recent.length}
				<h3 class="section-title mt-5">Recent solves</h3>
				<ul class="mt-2 divide-y divide-stone-200 text-sm dark:divide-stone-800">
					{#each stats.recent as r (r.at)}
						<li class="flex justify-between py-1.5">
							<a
								class="link font-mono"
								href="{resolve('/[game]', { game: game.id })}?id={r.puzzleId}">#{r.puzzleId}</a
							>
							<span class="font-mono tabular-nums">{formatDuration(r.timeMs)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</section>

	<section class="panel">
		<h2 class="text-lg font-semibold">
			{variant.special ? `${variant.label}: current puzzle` : 'Best times'}
		</h2>
		{#if hasServer === false}
			<p class="mt-3 text-sm text-stone-600 dark:text-stone-400">
				Online leaderboards need the optional server, which this deployment does not run.
			</p>
		{:else if boardError}
			<p class="mt-3 text-sm text-rose-600">{boardError}</p>
		{:else if !board}
			<p class="mt-3 text-sm text-stone-500">Loading…</p>
		{:else if board.entries.length === 0}
			<p class="mt-3 text-sm text-stone-600 dark:text-stone-400">No times yet. Be the first!</p>
		{:else}
			<p class="text-xs text-stone-500">{board.players} player{board.players === 1 ? '' : 's'}</p>
			<ol class="mt-3 divide-y divide-stone-200 text-sm dark:divide-stone-800">
				{#each board.entries as e (e.rank)}
					<li
						class="flex items-center gap-3 py-1.5 {e.me
							? 'font-semibold text-indigo-700 dark:text-indigo-300'
							: ''}"
					>
						<span class="w-8 text-right tabular-nums">{e.rank}.</span>
						<span class="flex-1 truncate">{e.name}</span>
						<span class="font-mono tabular-nums">{formatDuration(e.timeMs)}</span>
					</li>
				{/each}
			</ol>
			{#if board.me && !board.entries.some((e) => e.me)}
				<p class="mt-3 border-t border-stone-200 pt-2 text-sm dark:border-stone-800">
					You: rank {board.me.rank} with {formatDuration(board.me.timeMs)}
				</p>
			{/if}
		{/if}
		{#if hasServer && !currentPlayer()}
			<p class="mt-4 text-sm">
				<a class="link" href={resolve('/player')}>Pick a player name</a> to appear here.
			</p>
		{/if}
	</section>
</div>
