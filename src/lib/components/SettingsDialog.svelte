<script lang="ts">
	import type { GameSettings } from '../client/settings.svelte';
	import { settingLabel, t } from '../i18n/index.svelte';
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
		touchMode,
		ontouchmode
	}: {
		open: boolean;
		settings: GameSettings<string>;
		/** Set on touch devices, which get a choice of how dragging on the board behaves. */
		touchMode?: TouchMode;
		ontouchmode?: (mode: TouchMode) => void;
	} = $props();

	const TOUCH_MODES: TouchMode[] = ['draw', 'auto', 'pan'];

	let source = $state<PuzzleSource>(loadPuzzleSource());

	const visible = $derived(
		settings.info.filter((s) => !s.requires || settings.values[s.requires.key] === s.requires.value)
	);
</script>

<Dialog bind:open title={t('game.settings')}>
	<ul class="space-y-1">
		{#each visible as s (s.key)}
			<li>
				<label
					class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"
				>
					<input
						type="checkbox"
						class="size-4 accent-indigo-600"
						checked={settings.values[s.key]}
						aria-describedby={s.countsAsHint ? `setting-${s.key}-note` : undefined}
						onchange={(e) => settings.set(s.key, e.currentTarget.checked)}
					/>
					<span>{settingLabel(s)}</span>
				</label>
				{#if s.countsAsHint}
					<p
						id="setting-{s.key}-note"
						class="-mt-1 pr-2 pb-1 pl-9 text-xs text-stone-500 dark:text-stone-400"
					>
						{t('game.countsAsHint')}
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
						onchange={() => ontouchmode?.(m)}
					/>
					<span>{t(`game.touch${m[0].toUpperCase()}${m.slice(1)}`)}</span>
				</label>
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
