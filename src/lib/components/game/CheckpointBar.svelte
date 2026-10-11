<script lang="ts">
	import { ask } from '../../client/confirm.svelte';
	import type { AnySession } from '../../client/session.svelte';
	import { MAX_CHECKPOINTS } from '../../client/session/history.svelte';
	import { t } from '../../i18n/index.svelte';
	import { question } from './questions';

	/** Save the position as a checkpoint, add another, go back to one or delete one. */
	let { session }: { session: AnySession } = $props();

	async function remove(i: number) {
		if (await ask(question('deleteCheckpoint', true, { n: i + 1 }))) session.deleteCheckpoint(i);
	}
</script>

<div
	class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3 lg:gap-x-2.5"
	role="group"
	aria-label={t('game.checkpoints')}
>
	<button class="btn-sm" onclick={() => session.saveCheckpoint()} title="Ctrl+S"
		>{t('game.save')}</button
	>
	<button
		class="btn-sm"
		onclick={() => session.addCheckpoint()}
		disabled={session.checkpoints.length >= MAX_CHECKPOINTS}
		title="Ctrl+Shift+S">{t('game.add')}</button
	>
	{#each session.checkpoints as _, i (i)}
		<span class="relative">
			<button
				class="btn-sm min-w-9 {session.currentCheckpoint === i ? 'btn-active' : ''}"
				onclick={() => session.loadCheckpoint(i)}
				oncontextmenu={(e) => (e.preventDefault(), remove(i))}
				title={t('game.loadCheckpoint', { n: i + 1 })}>{i + 1}</button
			>
			<!-- The badge stays small, the button around it is a 32 px target on phones -->
			<button
				class="group absolute -top-4 -right-4 grid size-8 place-items-center lg:-top-3 lg:-right-3 lg:size-6"
				aria-label={t('game.deleteCheckpoint', { n: i + 1 })}
				title={t('game.deleteCheckpoint', { n: i + 1 })}
				onclick={() => remove(i)}
				><span
					class="grid size-5 place-items-center rounded-full bg-stone-300 text-xs leading-none group-hover:bg-rose-500 group-hover:text-white lg:size-4 lg:text-[10px] dark:bg-stone-600"
					aria-hidden="true">×</span
				></button
			>
		</span>
	{/each}
</div>
