<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { replaceState } from '$app/navigation';
	import { currentPlayer, leaderboard, watchServer, type Leaderboard } from '#lib/client/api.ts';
	import { net } from '#lib/client/network.svelte.ts';
	import { getStats, type VariantStats } from '#lib/client/stats.ts';
	import { formatDuration } from '#lib/core/time.ts';
	import { encodePuzzleId, isPlayable, periodKey, specialSeed } from '#lib/core/variants.ts';
	import { GAMES } from '#lib/games/index.ts';
	import { t, variantLabel } from '#lib/i18n/index.svelte.ts';

	let gameId = $state(GAMES[0].id);
	let variantKey = $state(GAMES[0].variants[0].key);
	let hasServer = $state<boolean | null>(null);
	let board = $state<Leaderboard | null>(null);
	let boardError = $state('');
	let stats = $state<VariantStats | null>(null);

	const game = $derived(GAMES.find((g) => g.id === gameId) ?? GAMES[0]);
	/** Types that are only announced have no scores yet. */
	const playable = $derived(game.variants.filter(isPlayable));
	const variant = $derived(playable.find((v) => v.key === variantKey) ?? playable[0]);

	onMount(() => {
		const q = new URL(location.href).searchParams;
		const g = GAMES.find((x) => x.id === q.get('game'));
		if (g) {
			gameId = g.id;
			if (g.variants.some((v) => v.key === q.get('v') && isPlayable(v))) variantKey = q.get('v')!;
		}
		return watchServer((ok) => (hasServer = ok));
	});

	$effect(() => {
		if (!playable.some((v) => v.key === variantKey)) variantKey = playable[0].key;
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
	<title>{t('scores.title')} · {t('app.name')}</title>
</svelte:head>

<h1 class="font-display text-3xl font-bold tracking-tight">{t('scores.title')}</h1>

<div class="mt-6 flex flex-wrap gap-3">
	<label class="flex items-center gap-2 text-sm">
		{t('scores.game')}
		<select class="input" bind:value={gameId}>
			{#each GAMES as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
		</select>
	</label>
	<label class="flex items-center gap-2 text-sm">
		{t('scores.puzzleType')}
		<select class="input" bind:value={variantKey}>
			{#each playable as v (v.key)}<option value={v.key}>{variantLabel(v)}</option>{/each}
		</select>
	</label>
</div>

<div class="mt-6 grid gap-6 lg:grid-cols-2">
	<section class="panel">
		<h2 class="text-lg font-semibold">{t('scores.yourStats')}</h2>
		<p class="text-xs text-stone-500">{t('scores.keptLocally')}</p>
		{#if stats}
			<dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each [[t('scores.solved'), String(stats.solved)], [t('scores.streak'), String(stats.streak)], [t('scores.bestStreak'), String(stats.bestStreak)], [t('scores.bestTime'), stats.bestMs != null ? formatDuration(stats.bestMs) : '–'], [t('scores.average'), average != null ? formatDuration(average) : '–']] as [label, value] (label)}
					<div class="rounded-lg bg-stone-100 p-3 dark:bg-stone-800">
						<dt class="text-xs text-stone-500 dark:text-stone-400">{label}</dt>
						<dd class="mt-1 font-mono text-xl tabular-nums">{value}</dd>
					</div>
				{/each}
			</dl>
			{#if stats.recent.length}
				<h3 class="section-title mt-5">{t('scores.recent')}</h3>
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
			{variant.special
				? t('scores.currentPuzzle', { variant: variantLabel(variant) })
				: t('scores.bestTimes')}
		</h2>
		{#if hasServer === false}
			<p class="mt-3 text-sm text-stone-600 dark:text-stone-400">
				{net.offline
					? t('net.offlineHint')
					: net.status === 'unreachable'
						? t('net.unreachableHint')
						: t('scores.noServer')}
			</p>
		{:else if boardError}
			<p class="mt-3 text-sm text-rose-600">{boardError}</p>
		{:else if !board}
			<p class="mt-3 text-sm text-stone-500">{t('scores.loading')}</p>
		{:else if board.entries.length === 0}
			<p class="mt-3 text-sm text-stone-600 dark:text-stone-400">{t('scores.empty')}</p>
		{:else}
			<p class="text-xs text-stone-500">
				{board.players === 1 ? t('scores.player') : t('scores.players', { count: board.players })}
			</p>
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
					{t('scores.you', { rank: board.me.rank, time: formatDuration(board.me.timeMs) })}
				</p>
			{/if}
		{/if}
		{#if hasServer && !currentPlayer()}
			<p class="mt-4 text-sm">
				<a class="link" href={resolve('/player')}>{t('scores.pickName')}</a>{t('scores.toAppear')}
			</p>
		{/if}
	</section>
</div>
