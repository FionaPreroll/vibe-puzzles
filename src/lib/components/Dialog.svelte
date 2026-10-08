<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '../i18n/index.svelte';

	let {
		open = $bindable(false),
		title,
		role = 'dialog',
		children
	}: {
		open: boolean;
		title: string;
		/** `alertdialog` for questions that need an answer. */
		role?: 'dialog' | 'alertdialog';
		children: Snippet;
	} = $props();

	const id = $props.id();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	{role}
	aria-labelledby="{id}-title"
	onclose={() => {
		// The close event comes a moment later; by then the dialog may have opened again (the next
		// question right after an answer), and that one must stay.
		if (!dialog?.open) open = false;
	}}
	onclick={(e) => e.target === dialog && (open = false)}
	class="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-stone-200 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-black/40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
>
	<div
		class="flex items-center justify-between border-b border-stone-200 px-5 py-3 dark:border-stone-700"
	>
		<h2 id="{id}-title" class="text-lg font-semibold">{title}</h2>
		<button class="btn-icon" aria-label={t('app.close')} onclick={() => (open = false)}>✕</button>
	</div>
	<div class="max-h-[70vh] overflow-y-auto px-5 py-4">
		{@render children()}
	</div>
</dialog>
