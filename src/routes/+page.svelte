<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Bat from '#lib/components/halloween/Bat.svelte';
	import Candle from '#lib/components/halloween/Candle.svelte';
	import CandyCorn from '#lib/components/halloween/CandyCorn.svelte';
	import Cobweb from '#lib/components/halloween/Cobweb.svelte';
	import HomeScene from '#lib/components/halloween/HomeScene.svelte';
	import Pumpkin from '#lib/components/halloween/Pumpkin.svelte';
	import Spider from '#lib/components/halloween/Spider.svelte';
	import Stars from '#lib/components/halloween/Stars.svelte';
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

<section class="relative flex items-end justify-between gap-6">
	<Stars />
	<div class="relative max-w-3xl min-w-0 flex-1">
		<p class="halloween-only mb-3">
			<span
				class="only-day inline-flex items-center gap-2 rounded-full bg-[#f3e8ff] py-1 pr-3.5 pl-2 text-sm font-semibold text-[#5b21b6]"
				><CandyCorn class="h-[1.2em]" />{t('look.tagline')}</span
			>
			<span class="only-night night-tagline text-sm text-[#f2a65a] uppercase"
				>{t('look.taglineNight')}</span
			>
		</p>
		<h1 class="hero-title font-display text-3xl font-bold tracking-tight">{t('home.title')}</h1>
		<p class="mt-2 text-stone-600 dark:text-stone-400">{t('home.intro')}</p>
	</div>
	<HomeScene />
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
		<li class="panel relative isolate flex h-full flex-col overflow-hidden">
			<!-- Halloween: a spider, a bat or a cobweb in the corner -->
			{#if game.id === 'tetroid'}
				<Spider class="halloween-only absolute top-0 right-8 -z-10 w-7" />
			{:else if game.id === 'pinwheel'}
				<Bat
					eyes
					class="halloween-only halloween-bob absolute top-4 right-5 -z-10 w-14 text-[#7c3aed] dark:text-[#8b5cf6]"
				/>
			{:else if game.id === 'sudoku'}
				<Cobweb class="halloween-only absolute top-0 right-0 -z-10 w-16" />
			{/if}
			<a href={gameUrl(game.id)} class="group block flex-1">
				<div class="flex items-center gap-3">
					<span class="text-3xl" aria-hidden="true">{game.icon}</span>
					<h2
						class="font-display text-xl font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
					>
						{game.name}
					</h2>
					{#if game.earlyAccess}<span class="early-access">{t('game.earlyAccess')}</span>{/if}
				</div>
				<p class="mt-2 text-sm text-stone-600 dark:text-stone-400">
					{t(`games.${game.id}.tagline`)}
				</p>
			</a>
			{#if s?.tutorials.length}
				<!-- Second to Play: a hint with quiet buttons, above the daily puzzle and Play. The
				     buttons get a line of their own below the hint, side by side where they fit. -->
				<div class="mt-3 text-sm">
					<p class="text-stone-600 dark:text-stone-400">{t('home.newHere')}</p>
					<div class="mt-2 flex flex-wrap gap-2">
						{#each s.tutorials as r (r.mode ?? '')}
							<a
								class="btn-sm"
								href={r.mode
									? resolve('/[game]/tutorial/[mode]', { game: game.id, mode: r.mode })
									: resolve('/[game]/tutorial', { game: game.id })}
								>{t('home.learn', { game: r.mode ? t(`mode.${r.mode}`) : game.name })}</a
							>
						{/each}
					</div>
				</div>
			{/if}
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
					{#if s.dailyDone}
						<span aria-hidden="true">✓</span>
					{:else}
						<span class="classic-only" aria-hidden="true">☀</span>
						<Pumpkin class="halloween-only only-day w-[1.1em]" />
						<Candle class="halloween-only only-night h-[1.1em]" />
					{/if}
					<span class="flex-1">{s.dailyDone ? t('home.dailyDone') : t('home.dailyOpen')}</span>
					{#if s.dailyStreak > 0}
						<span class="font-medium">🔥 {t('home.streak', { count: s.dailyStreak })}</span>
					{/if}
				</a>
				<p class="mt-1 text-xs text-stone-500 dark:text-stone-400">{nextDailyText(now)}</p>
			{/if}
			<div class="mt-3">
				<a class="btn btn-primary" href={gameUrl(game.id)}>{t('home.play')}</a>
			</div>
		</li>
	{/each}
</ul>
