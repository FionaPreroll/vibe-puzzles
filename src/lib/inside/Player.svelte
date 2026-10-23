<script lang="ts" generics="P extends BasePuzzle, S">
	import { onDestroy, untrack } from 'svelte';
	import { settingValues } from '../core/settings';
	import type { BasePuzzle } from '../core/types';
	import { gameById } from '../games';
	import { Timeline, type Caption, type Film } from './film';
	import { ti } from './i18n';
	import { FilmPlayer, SPEEDS } from './player.svelte';

	/**
	 * A film on the game's own board, played like a video: play and pause, a scrubber, chapters to
	 * jump to, single steps and speeds, and the keys of a video player. Captions say what happens;
	 * "More detail" adds the technical side. Another film needs a new player (`{#key}`).
	 */
	let { film, onanother }: { film: Film<P, S>; onanother?: () => void } = $props();

	const player = new FilmPlayer<P, S>();
	player.load(new Timeline(untrack(() => film)));
	onDestroy(() => player.dispose());

	const game = $derived(gameById(film.game)!);
	const Board = $derived(game.board);
	/** The game's defaults, without what belongs to playing: coordinates, the last move. */
	const settings = $derived({
		...settingValues(game.settings),
		showCoordinates: false,
		highlightLastChange: false,
		...film.settings
	});
	const timeline = $derived(player.timeline);
	const frame = $derived(player.frame);
	const count = $derived(timeline?.frames.length ?? 0);

	let detail = $state(false);
	let width = $state(360);
	/** As large as fits the column, up to the size of a comfortable board. */
	const cellSize = $derived(
		Math.max(24, Math.min(56, Math.floor((width - 24) / ((frame?.puzzle.width ?? 9) + 0.6))))
	);

	const say = (c: Caption) => ti(c.key, c.params);
	const set = (keys?: string[]) => (keys ? new Set(keys) : undefined);

	function onkeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		if (e.altKey || e.ctrlKey || e.metaKey || target?.isContentEditable) return;
		const typing = target?.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range';
		if (typing || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;
		const actions: Record<string, () => void> = {
			' ': () => player.toggle(),
			ArrowLeft: () => player.step(-1),
			ArrowRight: () => player.step(1),
			PageUp: () => player.chapterBack(),
			PageDown: () => player.chapterNext(),
			Home: () => player.seek(0),
			End: () => player.seek(count - 1)
		};
		const action = actions[e.key];
		if (!action) return;
		// The scrubber's own arrows, and a focused button's Space, would act a second time.
		e.preventDefault();
		action();
	}
</script>

<svelte:window {onkeydown} />

<div class="grid gap-3" bind:clientWidth={width} data-testid="film">
	{#if frame}
		<div class="board-stage" aria-hidden="true">
			<Board
				puzzle={frame.puzzle}
				state={frame.state}
				{settings}
				tool={game.defaultTool(false)}
				toolOption={0}
				{cellSize}
				readonly={true}
				lastChange={new Set()}
				spotlight={set(frame.spotlight)}
				mistake={frame.mistake}
				area={set(frame.area)}
				trial={set(frame.trial)}
				touchMode="pan"
				onmove={() => {}}
			/>
		</div>

		<!-- Room for the longest caption, so that the controls below stay where they are -->
		<p
			class="min-h-24 text-center text-base font-medium sm:min-h-12"
			aria-live={player.playing ? 'off' : 'polite'}
			data-testid="caption"
		>
			{say(frame.caption)}
		</p>
	{/if}

	{#if timeline}
		<!-- Chapters as parts of one bar, filled as far as the film has played -->
		<div class="flex gap-1" role="group" aria-label={ti('player.chapters')}>
			{#each timeline.film.chapters as chapter, k (k)}
				{@const start = timeline.starts[k]}
				{@const length = chapter.frames.length}
				{@const done = Math.max(0, Math.min(1, (player.index - start + 1) / length))}
				<button
					class="group grid min-w-0 gap-1 text-left text-xs"
					style:flex-grow={length}
					style:flex-basis="0"
					aria-current={player.chapter === k ? 'step' : undefined}
					onclick={() => player.seek(start)}
				>
					<span class="h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
						<span class="block h-full bg-indigo-500" style:width="{done * 100}%"></span>
					</span>
					<span
						class="truncate {player.chapter === k
							? 'font-semibold'
							: 'text-stone-500 group-hover:text-stone-800 dark:text-stone-400 dark:group-hover:text-stone-200'}"
						>{k + 1}. {ti(chapter.title)}</span
					>
				</button>
			{/each}
		</div>

		<input
			type="range"
			class="w-full accent-indigo-600"
			min="0"
			max={count - 1}
			value={player.index}
			oninput={(e) => player.seek(Number(e.currentTarget.value))}
			aria-label={ti('player.position')}
			aria-valuetext={ti('player.step', { n: player.index + 1, count })}
		/>

		<div class="flex flex-wrap items-center justify-center gap-1">
			<button
				class="btn-icon"
				onclick={() => player.chapterBack()}
				title={ti('player.back')}
				aria-label={ti('player.back')}
			>
				<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
					<path d="M6 5h2v14H6zM20 5v14l-10-7z" />
				</svg>
			</button>
			<button
				class="btn-icon"
				onclick={() => player.step(-1)}
				title={ti('player.stepBack')}
				aria-label={ti('player.stepBack')}
			>
				<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
					<path d="M15 5v14l-9-7z" />
				</svg>
			</button>
			<button
				class="btn btn-primary mx-1 size-11 justify-center rounded-full p-0"
				onclick={() => player.toggle()}
				title={ti(player.playing ? 'player.pause' : 'player.play')}
				aria-label={ti(player.playing ? 'player.pause' : 'player.play')}
				data-testid="play"
			>
				<svg viewBox="0 0 24 24" class="size-6" fill="currentColor" aria-hidden="true">
					{#if player.playing}
						<path d="M6 5h4v14H6zM14 5h4v14h-4z" />
					{:else}
						<path d="M8 5v14l11-7z" />
					{/if}
				</svg>
			</button>
			<button
				class="btn-icon"
				onclick={() => player.step(1)}
				title={ti('player.stepForward')}
				aria-label={ti('player.stepForward')}
			>
				<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
					<path d="M9 5v14l9-7z" />
				</svg>
			</button>
			<button
				class="btn-icon"
				onclick={() => player.chapterNext()}
				title={ti('player.next')}
				aria-label={ti('player.next')}
			>
				<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
					<path d="M16 5h2v14h-2zM4 5v14l10-7z" />
				</svg>
			</button>
			<span class="ml-2 text-xs text-stone-500 tabular-nums dark:text-stone-400" data-testid="step">
				{ti('player.step', { n: player.index + 1, count })}
			</span>
		</div>

		<div class="flex flex-wrap items-center justify-center gap-2 text-sm">
			<div class="flex items-center gap-1" role="group" aria-label={ti('player.speed')}>
				<span class="text-xs text-stone-500 dark:text-stone-400">{ti('player.speed')}</span>
				{#each SPEEDS as speed (speed)}
					<button
						class="btn-sm {player.speed === speed ? 'btn-active' : ''}"
						aria-pressed={player.speed === speed}
						onclick={() => player.setSpeed(speed)}>{speed}×</button
					>
				{/each}
			</div>
			<button
				class="btn-sm {detail ? 'btn-active' : ''}"
				aria-pressed={detail}
				onclick={() => (detail = !detail)}>{ti('player.detail')}</button
			>
			{#if onanother}
				<button class="btn-sm" onclick={onanother}>{ti('player.another')}</button>
			{/if}
		</div>
	{/if}

	{#if detail && frame?.detail}
		<p
			class="rounded-lg bg-stone-100 p-3 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300"
			data-testid="detail"
		>
			{say(frame.detail)}
		</p>
	{/if}
</div>
