<script lang="ts">
	import { t } from '../../i18n/index.svelte';
	import Dialog from '../Dialog.svelte';

	/**
	 * The text that shares a solve, when it could neither go to the share sheet nor be copied: shown
	 * selected, to copy by hand or with the button. Open while `text` is set.
	 */
	let {
		text = $bindable(),
		oncopied
	}: {
		text: string | null;
		oncopied: () => void;
	} = $props();

	let field: HTMLTextAreaElement | undefined = $state();

	/** Copies the selected text the old way, which needs no permission. */
	function copy() {
		if (!field) return;
		field.select();
		if (document.execCommand('copy')) {
			text = null;
			oncopied();
		}
	}
</script>

<Dialog
	bind:open={() => text !== null, (open) => !open && (text = null)}
	title={t('game.shareSolve')}
>
	<p class="text-sm text-stone-600 dark:text-stone-300">{t('game.bragManual')}</p>
	<textarea
		bind:this={field}
		readonly
		rows="4"
		class="mt-3 w-full resize-none rounded-lg border border-stone-300 bg-stone-50 p-2 text-sm dark:border-stone-700 dark:bg-stone-950"
		aria-label={t('game.bragText')}
		value={text ?? ''}
		onfocus={(e) => e.currentTarget.select()}
		{@attach (node) => {
			// Selected once the dialog shows, ready to copy.
			if (text) requestAnimationFrame(() => (node.focus(), node.select()));
		}}></textarea>
	<div class="mt-3 flex justify-end">
		<button class="btn btn-primary" onclick={copy}>{t('game.copy')}</button>
	</div>
</Dialog>
