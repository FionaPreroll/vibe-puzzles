<script lang="ts">
	import type { AnySession } from '../../client/session.svelte';
	import type { AnyGame } from '../../games';
	import { t, toolHint, toolLabel } from '../../i18n/index.svelte';
	import HoldButton from '../HoldButton.svelte';
	import type { ToolState } from './tools.svelte';

	/**
	 * Undo, redo, the trial, the tools and the hint: below the board on wide screens, fixed at the
	 * bottom on phones. `showTools` is false while the player hides the tool buttons.
	 */
	let {
		game,
		session,
		tools,
		showTools,
		wide
	}: {
		game: AnyGame;
		session: AnySession;
		tools: ToolState;
		showTools: boolean;
		wide: boolean;
	} = $props();
</script>

<HoldButton
	class="play-btn"
	named={false}
	label="{t('game.undo')} (Z)"
	action={() => session.undo()}
	disabled={session.past.length === 0 || session.readonly}
>
	<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
		<path
			d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>{t('game.undoShort')}
</HoldButton>
<HoldButton
	class="play-btn"
	named={false}
	label="{t('game.redo')} (X)"
	action={() => session.redo()}
	disabled={session.future.length === 0 || session.readonly}
>
	<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
		<path
			d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>{t('game.redoShort')}
</HoldButton>
<!-- A trial: pressed while one runs, and then it keeps it (see `TrialRow`) -->
<button
	class="play-btn {session.trial ? 'play-btn-trial' : ''}"
	onclick={() => (session.trial ? session.keepTrial() : session.startTrial())}
	disabled={session.readonly}
	aria-pressed={!!session.trial}
	title={t(session.trial ? 'game.trialKeepTitle' : 'game.trialTitle')}
>
	<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
		<path
			d="M9.5 3.5h5M10.5 3.5v6L5.2 18.2A1.5 1.5 0 0 0 6.5 20.5h11a1.5 1.5 0 0 0 1.3-2.3L13.5 9.5v-6M7.5 15h9"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>{t('game.trial')}
</button>
{#if showTools}
	<span class="play-sep" aria-hidden="true"></span>
	<div class="flex flex-[999] lg:gap-0.5" role="toolbar" aria-label={t('game.tools')}>
		{#each game.tools as tl (tl.id)}
			{@const name = toolLabel(game.id, tl)}
			{@const hint = toolHint(game.id, tl.id)}
			{@const swatch =
				game.toolOptions?.tool === tl.id
					? game.toolOptions.values.find((o) => o.value === tools.option)?.color
					: undefined}
			<button
				class="play-btn {tools.tool === tl.id ? 'play-btn-active' : ''}"
				aria-pressed={tools.tool === tl.id}
				title="{name} ({tl.key}){hint ? `: ${hint}` : ''}"
				onclick={() => tools.press(tl.id, wide)}
			>
				{#if swatch}
					<span class="size-5 rounded-full border border-stone-400" style:background={swatch}
					></span>
				{:else}
					<span class="text-lg leading-5" aria-hidden="true">{tl.icon}</span>
				{/if}
				{name}
			</button>
		{/each}
	</div>
{/if}
{#if session.canHint}
	<span class="play-sep" aria-hidden="true"></span>
	<!-- Stays once solved, greyed out, so nothing around it moves -->
	<button
		class="play-btn"
		onclick={() => session.showHint()}
		disabled={session.readonly || session.solved}
		title={t('game.hintTitle')}
	>
		<svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
			<path
				d="M10 2.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5h5c0-.6.2-1.1.7-1.5a5.5 5.5 0 0 0-3.2-10ZM8 16.5h4M8.8 18.5h2.4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>{t('game.hint')}
	</button>
{/if}
