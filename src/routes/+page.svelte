<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { SavedGame } from '#lib/client/session.svelte.ts';
	import { currentPeriodStreak, getStats } from '#lib/client/stats.ts';
	import { keys, load } from '#lib/client/storage.ts';
	import { periodKey } from '#lib/core/variants.ts';
	import { GAMES } from '#lib/games/index.ts';
	import { t, variantLabel } from '#lib/i18n/index.svelte.ts';

	interface GameStatus {
		dailyKey: string | null;
		dailyDone: boolean;
		dailyStreak: number;
		tutorialDone: boolean;
	}

	let resume = $state<{ game: (typeof GAMES)[number]; save: SavedGame } | null>(null);
	let status = $state<Record<string, GameStatus>>({});

	onMount(() => {
		// The most recently played unsolved game.
		for (const key of keys('save:')) {
			const save = load<SavedGame | null>(key, null);
			const game = GAMES.find((g) => g.id === key.split(':')[1]);
			if (!save || save.solved || !game) continue;
			if (!game.variants.some((v) => v.key === save.variant)) continue;
			if (!resume || save.updatedAt > resume.save.updatedAt) resume = { game, save };
		}
		for (const game of GAMES) {
			const daily = game.variants.find((v) => v.special === 'daily');
			const stats = daily ? getStats(game.id, daily.key) : null;
			status[game.id] = {
				dailyKey: daily?.key ?? null,
				dailyDone: !!stats && stats.lastPeriod === periodKey('daily'),
				dailyStreak: stats ? currentPeriodStreak(stats, 'daily') : 0,
				tutorialDone: load<boolean>(`tutorialDone:${game.id}`, false)
			};
		}
	});

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

{#if resume}
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
			{#if s?.dailyKey}
				<a
					href={gameUrl(game.id, s.dailyKey)}
					class="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm {s.dailyDone
						? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
						: 'bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200'}"
				>
					<span aria-hidden="true">{s.dailyDone ? '✓' : '☀'}</span>
					<span class="flex-1">{s.dailyDone ? t('home.dailyDone') : t('home.dailyOpen')}</span>
					{#if s.dailyStreak > 0}
						<span class="font-medium">🔥 {t('home.streak', { count: s.dailyStreak })}</span>
					{/if}
				</a>
			{/if}
			<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
				<a class="btn btn-primary" href={gameUrl(game.id)}>{t('home.play')}</a>
				{#if game.tutorial && s && !s.tutorialDone}
					<a class="link text-sm" href={resolve('/[game]/tutorial', { game: game.id })}
						>{t('home.tutorial', { game: game.name })}</a
					>
				{/if}
			</div>
		</li>
	{/each}
</ul>
