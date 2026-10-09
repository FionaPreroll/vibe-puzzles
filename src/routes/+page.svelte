<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { latestUnfinished } from '#lib/client/resume.ts';
	import type { SavedGame } from '#lib/client/session.svelte.ts';
	import { currentPeriodStreak, getStats } from '#lib/client/stats.ts';
	import { load } from '#lib/client/storage.ts';
	import { periodKey } from '#lib/core/variants.ts';
	import { GAMES } from '#lib/games/index.ts';
	import { tutorialDoneKey, tutorialsOf, type TutorialRef } from '#lib/games/tutorials.ts';
	import { nextDailyText, t, variantLabel } from '#lib/i18n/index.svelte.ts';

	interface GameStatus {
		dailyDone: boolean;
		dailyStreak: number;
		/** Tutorials not solved yet: the game's own, then one per mode. */
		tutorials: TutorialRef[];
	}

	let resume = $state<{ game: (typeof GAMES)[number]; save: SavedGame } | null>(null);
	let status = $state<Record<string, GameStatus>>({});
	/**
	 * Saves and stats live in this browser only, so the prerendered page shows placeholders of the
	 * same size until it has read them: nothing jumps.
	 */
	let mounted = $state(false);
	let now = $state(0);

	onMount(() => {
		mounted = true;
		now = Date.now();
		const tick = setInterval(() => (now = Date.now()), 30_000);
		const latest = latestUnfinished();
		const game = latest && GAMES.find((g) => g.id === latest.gameId);
		if (game) resume = { game, save: latest!.save };
		for (const game of GAMES) {
			const daily = game.variants.find((v) => v.special === 'daily');
			const stats = daily ? getStats(game.id, daily.key) : null;
			status[game.id] = {
				dailyDone: !!stats && stats.lastPeriod === periodKey('daily'),
				dailyStreak: stats ? currentPeriodStreak(stats, 'daily') : 0,
				tutorials: tutorialsOf(game).filter((r) => !load<boolean>(tutorialDoneKey(r), false))
			};
		}
		return () => clearInterval(tick);
	});

	const dailyKey = (game: (typeof GAMES)[number]) =>
		game.variants.find((v) => v.special === 'daily')?.key;

	const gameUrl = (id: string, variant?: string) =>
		`${resolve('/[game]', { game: id })}${variant ? `?v=${variant}` : ''}`;
</script>

<svelte:head>
	<title>{t('app.name')}</title>
</svelte:head>

<section class="max-w-3xl">
	<h1 class="text-3xl font-bold tracking-tight">{t('home.title')}</h1>
	<p class="mt-2 text-stone-600 dark:text-stone-400">{t('home.intro')}</p>
</section>

{#if !mounted}
	<div class="panel mt-6 flex max-w-xl animate-pulse items-center gap-4" aria-hidden="true">
		<span class="invisible text-3xl">{GAMES[0].icon}</span>
		<span class="invisible min-w-0 flex-1">
			<span class="section-title block">{t('home.continue')}</span>
			<span class="font-semibold">{GAMES[0].name}</span>
		</span>
		<span class="btn invisible">{t('home.play')}</span>
	</div>
{:else if resume}
	{@const v = resume.game.variants.find((x) => x.key === resume!.save.variant)!}
	<a
		href={gameUrl(resume.game.id, v.key)}
		class="panel mt-6 flex max-w-xl items-center gap-4 border-indigo-300 transition hover:shadow-md dark:border-indigo-800"
	>
		<span class="text-3xl" aria-hidden="true">{resume.game.icon}</span>
		<span class="min-w-0 flex-1">
			<span class="section-title block">{t('home.continue')}</span>
			<span class="font-semibold"
				>{t('home.continueGame', { game: resume.game.name, variant: variantLabel(v) })}</span
			>
		</span>
		<span class="btn btn-primary">{t('home.play')}</span>
	</a>
{/if}

<ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each GAMES as game (game.id)}
		{@const s = status[game.id]}
		{@const daily = dailyKey(game)}
		<li class="panel flex h-full flex-col">
			<a href={gameUrl(game.id)} class="group block flex-1">
				<div class="flex items-center gap-3">
					<span class="text-3xl" aria-hidden="true">{game.icon}</span>
					<h2
						class="text-xl font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
					>
						{game.name}
					</h2>
				</div>
				<p class="mt-2 text-sm text-stone-600 dark:text-stone-400">
					{t(`games.${game.id}.tagline`)}
				</p>
			</a>
			{#if daily && !s}
				<!-- Placeholder until the stats are read -->
				<div class="mt-4 animate-pulse text-sm" aria-hidden="true">
					<div class="rounded-lg bg-stone-100 px-3 py-2 dark:bg-stone-800">
						<span class="invisible">{t('home.dailyOpen')}</span>
					</div>
					<p class="invisible mt-1 text-xs">{t('home.dailyOpen')}</p>
				</div>
			{:else if daily}
				<a
					href={gameUrl(game.id, daily)}
					class="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm {s.dailyDone
						? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
						: 'bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900'}"
				>
					<span aria-hidden="true">{s.dailyDone ? '✓' : '☀'}</span>
					<span class="flex-1">{s.dailyDone ? t('home.dailyDone') : t('home.dailyOpen')}</span>
					{#if s.dailyStreak > 0}
						<span class="font-medium">🔥 {t('home.streak', { count: s.dailyStreak })}</span>
					{/if}
				</a>
				<p class="mt-1 text-xs text-stone-500 dark:text-stone-400">{nextDailyText(now)}</p>
			{/if}
			<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
				<a class="btn btn-primary" href={gameUrl(game.id)}>{t('home.play')}</a>
				{#each s?.tutorials ?? [] as r (r.mode ?? '')}
					<a
						class="link text-sm"
						href={r.mode
							? resolve('/[game]/tutorial/[mode]', { game: game.id, mode: r.mode })
							: resolve('/[game]/tutorial', { game: game.id })}
						>{t('home.tutorial', { game: r.mode ? t(`mode.${r.mode}`) : game.name })}</a
					>
				{/each}
			</div>
		</li>
	{/each}
</ul>
