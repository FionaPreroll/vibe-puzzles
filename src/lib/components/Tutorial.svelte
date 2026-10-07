<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { GameSettings } from '../client/settings.svelte';
	import { save } from '../client/storage';
	import type { GameModule } from '../core/types';
	import { t, tList, toolLabel } from '../i18n/index.svelte';

	/**
	 * Interactive first puzzle: a few short steps next to a small hand-picked board that the
	 * player solves with the real controls.
	 */
	let { game }: { game: GameModule } = $props();

	const tutorial = untrack(() => game.tutorial!);
	const settings = untrack(() => new GameSettings(game.id, game.settings));
	const isTouch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
	const Board = $derived(game.board);

	let current = $state.raw(untrack(() => tutorial.start(tutorial.puzzle)));
	let history = $state.raw<unknown[]>([]);
	let tool = $state(untrack(() => game.defaultTool(isTouch)));
	let lastChange = $state.raw<ReadonlySet<string>>(new Set());
	let step = $state(0);

	const steps = $derived(tList(`games.${game.id}.tutorial`));
	const last = $derived(step === steps.length - 1);
	const solved = $derived(
		game.isSolved(tutorial.puzzle, current) ||
			!!game.acceptAlternative?.(tutorial.puzzle, current, settings.values)
	);
	// Tutorials are small: use big cells, but stay within the screen.
	let width = $state(400);
	const cellSize = $derived(
		Math.max(
			32,
			Math.min(64, Math.floor(width / ((tutorial.puzzle as { width: number }).width + 0.3)))
		)
	);

	$effect(() => {
		if (solved) save(`tutorialDone:${game.id}`, true);
	});

	function move(next: typeof current, changed: string[]) {
		if (solved) return;
		history = [...history, current];
		current = game.afterMove?.(tutorial.puzzle, next, settings.values) ?? next;
		lastChange = new Set(changed);
	}

	function undo() {
		if (!history.length) return;
		current = history[history.length - 1] as typeof current;
		history = history.slice(0, -1);
	}

	const playUrl = $derived(resolve('/[game]', { game: game.id }));
</script>

<svelte:head>
	<title>{t('tutorial.title', { game: game.name })} · {t('app.name')}</title>
</svelte:head>

<div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_minmax(0,22rem)] md:items-start">
	<section class="order-2 md:order-1" bind:clientWidth={width}>
		<div class="mx-auto w-fit {solved ? 'solved-glow' : ''}">
			<Board
				puzzle={tutorial.puzzle}
				state={current}
				settings={settings.values}
				{tool}
				toolOption={game.toolOptions?.default ?? 0}
				{cellSize}
				readonly={solved}
				{lastChange}
				keyboard={true}
				touchMode="auto"
				onmove={move}
			/>
		</div>
		<div
			class="mt-4 flex flex-wrap justify-center gap-2"
			role="toolbar"
			aria-label={t('game.tools')}
		>
			{#each game.tools.filter((x) => !game.toolOptions || x.id !== game.toolOptions.tool) as tl (tl.id)}
				<button
					class="btn {tool === tl.id ? 'btn-active' : ''}"
					aria-pressed={tool === tl.id}
					onclick={() => (tool = tl.id)}
				>
					<span aria-hidden="true">{tl.icon}</span>
					{toolLabel(game.id, tl)}
				</button>
			{/each}
			<button class="btn" onclick={undo} disabled={!history.length}>↶ {t('game.undo')}</button>
		</div>
	</section>

	<aside class="panel order-1 md:order-2" aria-live="polite">
		<h1 class="text-xl font-bold tracking-tight">
			<span aria-hidden="true">{game.icon}</span>
			{t('tutorial.title', { game: game.name })}
		</h1>
		{#if solved}
			<p class="mt-4 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
				🎉 {t('tutorial.wellDone')}
			</p>
			<p class="mt-2">{t('tutorial.solvedAll')}</p>
			<a class="btn btn-primary mt-4" href={playUrl}>{t('tutorial.finish')}</a>
		{:else}
			<p class="section-title mt-3">{t('tutorial.step', { n: step + 1, total: steps.length })}</p>
			<p class="mt-2">{steps[step]}</p>
			{#if last}
				<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">
					{t(`games.${game.id}.${isTouch ? 'controlsTouch' : 'controlsMouse'}`)}
				</p>
			{:else}
				<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">{t('tutorial.tryIt')}</p>
			{/if}
			<div class="mt-4 flex gap-2">
				<button class="btn" onclick={() => step--} disabled={step === 0}
					>{t('tutorial.back')}</button
				>
				{#if !last}
					<button class="btn btn-primary" onclick={() => step++}>{t('tutorial.next')}</button>
				{/if}
			</div>
			<a class="link mt-4 inline-block text-sm" href={playUrl}>{t('tutorial.skip')}</a>
		{/if}
	</aside>
</div>
