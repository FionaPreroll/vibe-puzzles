<script lang="ts">
	import type { Message } from '../../client/session/messages';
	import { t } from '../../i18n/index.svelte';
	import { messageClass } from './messageStyle';

	/**
	 * Phones show messages as a toast over the board, so they never push the layout around. Errors
	 * stay until tapped away, hints until the next move; a hint sits below the board, so it does not
	 * hide the cells it points at.
	 */
	let {
		phone,
		message,
		hint,
		teaser,
		onshowhint
	}: {
		/** The phone layout, where messages show here rather than in the top bar. */
		phone: boolean;
		message: Message | null;
		/** A hint is on the board. */
		hint: boolean;
		/** The hint shows only where to look: the toast offers the step itself. */
		teaser: boolean;
		onshowhint: () => void;
	} = $props();

	let open = $state(false);

	$effect(() => {
		const shown = message;
		if (!shown) return void (open = false);
		open = true;
		if (shown.kind === 'error' || hint) return;
		const timer = setTimeout(() => (open = false), 4000);
		return () => clearTimeout(timer);
	});
</script>

{#if message && open && phone}
	<div class="absolute inset-x-0 z-10 flex justify-center {hint ? 'top-full mt-1' : 'top-2'}">
		<div
			class="flex max-w-[90%] items-start gap-2 rounded-md px-3 py-1.5 text-sm shadow-lg {messageClass(
				message.kind
			)}"
		>
			<div class="grid justify-items-start gap-1">
				<button class="text-left" title={t('game.dismiss')} onclick={() => (open = false)}
					>{message.text}</button
				>
				{#if teaser}
					<button class="font-semibold underline" onclick={onshowhint}>{t('game.hintShow')}</button>
				{/if}
			</div>
			<button
				class="opacity-60"
				title={t('game.dismiss')}
				aria-label={t('game.dismiss')}
				onclick={() => (open = false)}>✕</button
			>
		</div>
	</div>
{/if}
