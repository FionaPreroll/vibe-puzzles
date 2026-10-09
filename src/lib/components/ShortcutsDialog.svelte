<script lang="ts">
	import type { GameModule } from '../core/types';
	import { t, tList, toolLabel } from '../i18n/index.svelte';
	import Dialog from './Dialog.svelte';

	/** The keyboard shortcuts of the game page, opened with "?". */
	let {
		open = $bindable(false),
		game,
		tools
	}: {
		open: boolean;
		game: GameModule;
		/** The tool keys work (controls are shown). */ tools: boolean;
	} = $props();

	const mod =
		typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';
	const general = $derived([
		[['Z', `${mod}+Z`], t('shortcuts.undo')],
		[['X', 'Shift+Z', `${mod}+Y`], t('shortcuts.redo')],
		[['Enter'], t('shortcuts.done')],
		[['+'], t('shortcuts.newPuzzle')],
		...(game.hint ? [[['H'], t('shortcuts.hint')]] : []),
		[[`${mod}+S`], t('shortcuts.save')],
		[[`${mod}+Shift+S`], t('shortcuts.add')],
		...(game.toolOptions && tools ? [[[']'], t('shortcuts.colourTool')]] : []),
		[['Esc'], t('shortcuts.escape')],
		[['?'], t('shortcuts.help')]
	] as [string[], string][]);
	const swatchNames = $derived(tList('swatch'));
</script>

{#snippet keys(list: string[])}
	{#each list as k, i (k)}{#if i > 0}<span class="mx-1 text-xs text-stone-500 dark:text-stone-400">
				{t('shortcuts.or')}
			</span>{/if}<kbd
			class="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-xs dark:border-stone-600 dark:bg-stone-800"
			>{k}</kbd
		>{/each}
{/snippet}

<Dialog bind:open title={t('shortcuts.title')}>
	<h3 class="section-title">{t('shortcuts.general')}</h3>
	<dl class="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
		{#each general as [k, what] (what)}
			<dt>{@render keys(k)}</dt>
			<dd>{what}</dd>
		{/each}
	</dl>
	{#if tools}
		<h3 class="section-title mt-4">{t('shortcuts.tools')}</h3>
		<dl class="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
			{#each game.tools as tool (tool.id)}
				<dt>{@render keys([tool.key])}</dt>
				<dd>{toolLabel(game.id, tool)}</dd>
			{/each}
		</dl>
		{#if game.toolOptions}
			<h3 class="section-title mt-4">{t('shortcuts.colours')}</h3>
			<dl class="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
				{#each game.toolOptions.values as o (o.value)}
					<dt>{@render keys([o.key])}</dt>
					<dd class="flex items-center gap-2">
						<span class="size-3 rounded-full border border-stone-400" style:background={o.color}
						></span>{swatchNames[o.value] ?? o.label}
					</dd>
				{/each}
			</dl>
		{/if}
	{/if}
	<h3 class="section-title mt-4">{t('shortcuts.board')}</h3>
	<p class="mt-1 text-sm">{t(`games.${game.id}.controlsMouse`)}</p>
</Dialog>
