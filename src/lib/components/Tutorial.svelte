<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { GameSettings } from '../client/settings.svelte';
	import { KeyDispatcher } from '../client/keys';
	import { save } from '../client/storage';
	import type { GameModule, Hint } from '../core/types';
	import {
		findTutorial,
		tutorialDoneKey,
		tutorialNextVariant,
		tutorialTextKey
	} from '../games/tutorials';
	import { t, tSteps, toolLabel } from '../i18n/index.svelte';

	/**
	 * Interactive first puzzle: a few short steps next to a small hand-picked board that the
	 * player solves with the real controls. The steps are guided: some are
	 * only read, others are a task on the board that has to be done before going on. A `mode`
	 * picks that mode's tutorial instead, e.g. Calcudoku in Sudoku.
	 */
	let { game, mode }: { game: GameModule; mode?: string } = $props();

	const ref = untrack(() => findTutorial(game, mode)!);
	const tutorial = ref.tutorial;
	const name = $derived(mode ? t(`mode.${mode}`) : game.name);
	const settings = untrack(() => new GameSettings(game.id, game.settings));
	const isTouch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
	const Board = $derived(game.board);
	/** The board's keys; the tutorial has no shortcuts of its own. */
	const keys = new KeyDispatcher();

	let current = $state.raw(untrack(() => tutorial.start(tutorial.puzzle)));
	let history = $state.raw<unknown[]>([]);
	let tool = $state(untrack(() => game.defaultTool(isTouch)));
	let lastChange = $state.raw<ReadonlySet<string>>(new Set());
	let step = $state(0);
	/** The hint on the board in the last step, until the next move. */
	let hint = $state.raw<Hint | null>(null);
	/** Whether the hint shows its result, or only its first look. */
	let hintFull = $state(false);

	const steps = $derived(tSteps(tutorialTextKey(ref)));
	const last = $derived(step === steps.length - 1);
	const guide = $derived(tutorial.steps[step]);
	const taskDone = $derived(!!guide?.done?.(tutorial.puzzle, current));
	const canGoOn = $derived(!guide?.done || taskDone);
	const spotlight = $derived(
		new Set(hint ? (hintFull ? hint.spotlight : []) : (guide?.spotlight ?? []))
	);
	const area = $derived(hint?.area ? new Set(hint.area) : undefined);
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
		if (solved) save(tutorialDoneKey(ref), true);
	});

	function move(next: typeof current, changed: string[]) {
		if (solved) return;
		history = [...history, current];
		current = game.afterMove?.(tutorial.puzzle, next, settings.values) ?? next;
		lastChange = new Set(changed);
		hint = null;
	}

	/**
	 * The last step is the player's alone: the game's hint helps there, as in a real puzzle, first
	 * with where to look, then with the step itself.
	 */
	function showHint() {
		const shown = hint;
		hint = shown ?? game.hint?.(tutorial.puzzle, current) ?? null;
		hintFull = !!shown || !hint?.teaser;
	}

	function showMe() {
		const next = guide?.show?.(tutorial.puzzle, current);
		if (next) move(next, []);
	}

	function undo() {
		if (!history.length) return;
		current = history[history.length - 1] as typeof current;
		history = history.slice(0, -1);
		hint = null;
	}

	const playUrl = $derived.by(() => {
		const v = tutorialNextVariant(ref);
		return `${resolve('/[game]', { game: game.id })}${v ? `?v=${v}` : ''}`;
	});
</script>

<svelte:window onkeydown={keys.keydown} onkeyup={keys.keyup} onblur={keys.blur} />

<svelte:head>
	<title>{t('tutorial.title', { game: name })} · {t('app.name')}</title>
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
				spotlight={solved ? undefined : spotlight}
				area={solved ? undefined : area}
				keys={keys.attach}
				touchMode="auto"
				onmove={move}
				ontool={(next) => (tool = next)}
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
		<h1 class="font-display text-xl font-bold tracking-tight">
			<span aria-hidden="true">{game.icon}</span>
			{t('tutorial.title', { game: name })}
		</h1>
		{#if solved}
			<p class="mt-4 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
				🎉 {t('tutorial.wellDone')}
			</p>
			<p class="mt-2">{t('tutorial.solvedAll')}</p>
			<a class="btn btn-primary mt-4" href={playUrl}>{t('tutorial.finish')}</a>
		{:else}
			<p class="section-title mt-3">{t('tutorial.step', { n: step + 1, total: steps.length })}</p>
			<p class="mt-2">{steps[step]?.text}</p>
			{#if steps[step]?.task}
				<div
					class="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40"
				>
					<p class="text-sm font-semibold">👉 {t('tutorial.yourTurn')}</p>
					<p class="mt-1">{steps[step].task}</p>
				</div>
			{/if}
			{#if taskDone && steps[step]?.done}
				<p class="mt-3 font-semibold text-emerald-700 dark:text-emerald-400">
					✓ {steps[step].done}
				</p>
			{/if}
			{#if last}
				<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">
					{t(`games.${game.id}.${isTouch ? 'controlsTouch' : 'controlsMouse'}`)}
				</p>
				{#if game.hint}
					<p class="mt-2 text-sm">{t('tutorial.hint')}</p>
				{/if}
			{/if}
			{#if hint}
				<p
					class="mt-3 rounded-md px-3 py-1.5 text-sm {hint.kind === 'mistake'
						? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
						: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200'}"
				>
					{(hintFull ? hint.text : hint.teaser!).map((key) => t(key, hint!.params)).join(' ')}
					{#if !hintFull}
						<button class="ml-1 font-semibold underline" onclick={showHint}
							>{t('game.hintShow')}</button
						>
					{/if}
				</p>
			{/if}
			<div class="mt-4 flex flex-wrap gap-2">
				<button class="btn" onclick={() => ((hint = null), step--)} disabled={step === 0}
					>{t('tutorial.back')}</button
				>
				{#if !last}
					<button
						class="btn btn-primary {guide?.done && taskDone ? 'next-up' : ''}"
						onclick={() => step++}
						disabled={!canGoOn}>{t('tutorial.next')}</button
					>
				{/if}
				{#if guide?.show && !taskDone}
					<button class="btn" onclick={showMe}>{t('tutorial.showMe')}</button>
				{/if}
				{#if last && game.hint}
					<button class="btn" onclick={showHint}>{t('game.hint')}</button>
				{/if}
			</div>
			<a class="link mt-4 inline-block text-sm" href={playUrl}>{t('tutorial.skip')}</a>
		{/if}
	</aside>
</div>
