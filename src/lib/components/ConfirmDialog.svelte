<script lang="ts">
	import { tick } from 'svelte';
	import { answer, confirmation } from '../client/confirm.svelte';
	import { t } from '../i18n/index.svelte';
	import Dialog from './Dialog.svelte';

	/** The question shown; the layout holds this once for every page. */
	const current = $derived(confirmation.queue[0]);
	let cancelButton: HTMLButtonElement | undefined = $state();
	let okButton: HTMLButtonElement | undefined = $state();

	// Enter agrees, unless the action destroys something: then the safe choice has the focus.
	$effect(() => {
		if (!current) return;
		const target = current.danger ? cancelButton : okButton;
		tick().then(() => target?.focus());
	});
</script>

<Dialog
	bind:open={() => !!current, (open) => !open && answer(false)}
	title={current?.title ?? ''}
	role="alertdialog"
>
	<p class="text-sm">{current?.text}</p>
	<div class="mt-5 flex flex-wrap justify-end gap-2">
		<button class="btn" bind:this={cancelButton} onclick={() => answer(false)}
			>{t('confirm.cancel')}</button
		>
		<button
			class="btn {current?.danger ? 'btn-danger' : 'btn-primary'}"
			bind:this={okButton}
			onclick={() => answer(true)}>{current?.confirm}</button
		>
	</div>
</Dialog>
