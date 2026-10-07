<script lang="ts">
	import type { GameSettings } from '../client/settings.svelte';
	import { settingLabel, t } from '../i18n/index.svelte';
	import Dialog from './Dialog.svelte';

	let { open = $bindable(false), settings }: { open: boolean; settings: GameSettings } = $props();

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
						onchange={(e) => settings.set(s.key, e.currentTarget.checked)}
					/>
					<span>{settingLabel(s)}</span>
				</label>
			</li>
		{/each}
	</ul>
</Dialog>
