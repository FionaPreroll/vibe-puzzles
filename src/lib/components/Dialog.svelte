<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		children
	}: { open: boolean; title: string; children: Snippet } = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && (open = false)}
	class="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-stone-200 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-black/40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
>
	<div
		class="flex items-center justify-between border-b border-stone-200 px-5 py-3 dark:border-stone-700"
	>
		<h2 class="text-lg font-semibold">{title}</h2>
		<button class="btn-icon" aria-label="Close" onclick={() => (open = false)}>✕</button>
	</div>
	<div class="max-h-[70vh] overflow-y-auto px-5 py-4">
		{@render children()}
	</div>
</dialog>
