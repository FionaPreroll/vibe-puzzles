<script lang="ts">
	import type { GameSettings } from '../client/settings.svelte';
	import { settingHelp, settingLabel, t } from '../i18n/index.svelte';
	import {
		loadPuzzleSource,
		PUZZLE_SOURCES,
		savePuzzleSource,
		type PuzzleSource
	} from '../client/bank';
	import type { TouchMode } from '../core/types';
	import Dialog from './Dialog.svelte';

	let {
		open = $bindable(false),
		settings,
		mode,
		touchMode,
		ontouchmode
	}: {
		open: boolean;
		settings: GameSettings<string>;
		/** Mode of the current puzzle type, e.g. 'calc', for texts worded for that mode. */
		mode?: string;
		/** Set on touch devices, which get a choice of how dragging on the board behaves. */
		touchMode?: TouchMode;
		ontouchmode?: (mode: TouchMode) => void;
	} = $props();

	/** A line under a setting, lined up with its label. */
	const HELP = '-mt-1 pr-2 pb-1 pl-9 text-xs text-stone-500 dark:text-stone-400';

	const TOUCH_MODES: TouchMode[] = ['draw', 'auto', 'pan'];
	/** 'draw' → 'Draw', for the translation keys of a touch mode. */
	const name = (m: TouchMode) => `${m[0].toUpperCase()}${m.slice(1)}`;

	let source = $state<PuzzleSource>(loadPuzzleSource());

	const visible = $derived(
		settings.info.filter((s) => !s.requires || settings.values[s.requires.key] === s.requires.value)
	);
</script>

<Dialog bind:open title={t('game.settings')}>
	<ul class="space-y-1">
		{#each visible as s (s.key)}
			{@const help = settingHelp(s.key, settings.game, mode)}
			{@const ids = [help && `setting-${s.key}-help`, s.countsAsHint && `setting-${s.key}-note`]}
			<li>
				<label
					class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"
				>
					<input
						type="checkbox"
						class="size-4 accent-indigo-600"
						checked={settings.values[s.key]}
						aria-describedby={ids.filter(Boolean).join(' ') || undefined}
						onchange={(e) => settings.set(s.key, e.currentTarget.checked)}
					/>
					<span>{settingLabel(s, settings.game, mode)}</span>
				</label>
				{#if help || s.countsAsHint}
					<p class={HELP}>
						{#if help}<span id="setting-{s.key}-help">{help}</span>{/if}
						{#if s.countsAsHint}
							<span id="setting-{s.key}-note" class="mt-0.5 block font-medium"
								>{t('game.countsAsHint')}</span
							>
						{/if}
					</p>
				{/if}
			</li>
		{/each}
	</ul>
	{#if touchMode}
		<fieldset class="mt-4 border-t border-stone-200 pt-3 dark:border-stone-700">
			<legend class="section-title px-2">{t('game.touch')}</legend>
			{#each TOUCH_MODES as m (m)}
				<label
					class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"
				>
					<input
						type="radio"
						name="touch-mode"
						class="size-4 accent-indigo-600"
						checked={touchMode === m}
						aria-describedby="touch-{m}-help"
						onchange={() => ontouchmode?.(m)}
					/>
					<span>{t(`game.touch${name(m)}`)}</span>
				</label>
				<p id="touch-{m}-help" class={HELP}>{t(`game.touch${name(m)}Text`)}</p>
			{/each}
		</fieldset>
	{/if}
	<fieldset class="mt-4 border-t border-stone-200 pt-3 dark:border-stone-700">
		<legend class="section-title px-2">{t('source.title')}</legend>
		{#each PUZZLE_SOURCES as s (s)}
			<label
				class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"
			>
				<input
					type="radio"
					name="puzzle-source"
					class="size-4 accent-indigo-600"
					checked={source === s}
					onchange={() => {
						source = s;
						savePuzzleSource(s);
					}}
				/>
				<span>{t(`source.${s}`)}</span>
			</label>
		{/each}
		<p class="mt-1 px-2 text-xs text-stone-500 dark:text-stone-400">{t('source.note')}</p>
	</fieldset>
</Dialog>
