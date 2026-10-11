<script lang="ts">
	import { flushSync, onMount } from 'svelte';
	import type { AnySession } from '../../client/session.svelte';
	import type { Settings, TouchMode } from '../../core/types';
	import type { AnyGame } from '../../games';
	import { t } from '../../i18n/index.svelte';
	import { printCellSize } from './boardFit';

	/**
	 * What is printed: the empty puzzle only, in the light colours. It is made only while printing,
	 * so the page does not draw every move twice.
	 */
	let {
		game,
		session,
		settings,
		label,
		tool,
		toolOption,
		touchMode
	}: {
		game: AnyGame;
		session: AnySession;
		settings: Settings<string>;
		/** The puzzle type's name. */
		label: string;
		tool: string;
		toolOption: number;
		touchMode: TouchMode;
	} = $props();

	const Board = $derived(game.board);
	let printing = $state(false);

	onMount(() => {
		// `beforeprint` comes before the browser lays out the page for printing (Ctrl+P, the menu);
		// the print media query also covers a print preview that sends no such event.
		const media = matchMedia('print');
		const follow = () => (printing = media.matches);
		const before = () => flushSync(() => (printing = true));
		const after = () => (printing = media.matches);
		window.addEventListener('beforeprint', before);
		window.addEventListener('afterprint', after);
		media.addEventListener('change', follow);
		follow();
		return () => {
			window.removeEventListener('beforeprint', before);
			window.removeEventListener('afterprint', after);
			media.removeEventListener('change', follow);
		};
	});
</script>

{#if printing && session.puzzle && session.state}
	<div class="print-only board-light">
		<p class="mb-2 text-sm">
			{game.name} · {label}{session.puzzleId ? ` · ${t('game.puzzleId')} ${session.puzzleId}` : ''}
		</p>
		<Board
			puzzle={session.puzzle}
			state={session.state}
			{settings}
			{tool}
			{toolOption}
			cellSize={printCellSize(session.puzzle.width)}
			readonly={true}
			lastChange={new Set()}
			blank={true}
			{touchMode}
			onmove={() => {}}
		/>
	</div>
{/if}
