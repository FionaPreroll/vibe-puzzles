<script lang="ts">
	import type { Message } from '../../client/session/messages';
	import { t } from '../../i18n/index.svelte';
	import { messageClass } from './messageStyle';

	/**
	 * A hint's text on wide screens, right below the play bar with its Hint button and as wide as
	 * the board, so that a long one reads in a few lines and covers neither the board nor the bar
	 * above it. It lies over the rows below, out of the flow, so the board keeps its size; clicks
	 * go through to those rows, only its own buttons take them. In the widescreen panel it is part
	 * of the panel instead (`floating` false).
	 */
	let {
		message,
		teaser,
		floating = true,
		onshowhint,
		ondismisshint
	}: {
		message: Message;
		/** The hint shows only where to look: the note offers the step itself. */
		teaser: boolean;
		/** Over the rows below the play bar, rather than in the flow. */
		floating?: boolean;
		onshowhint: () => void;
		/** Takes the hint off the board, with its highlight. */
		ondismisshint: () => void;
	} = $props();
</script>

<p
	class="hint-note rounded-xl px-3 py-2 text-sm {floating
		? 'pointer-events-none absolute inset-x-0 top-full z-20 mx-auto mt-2 w-fit max-w-full text-center shadow-lg *:pointer-events-auto'
		: ''} {messageClass(message.kind)}"
>
	{message.text}
	{#if teaser}
		<button class="ml-1 font-semibold underline" onclick={onshowhint}>{t('game.hintShow')}</button>
	{/if}
	<!-- Wrong marks stay until they are changed: this takes them away sooner -->
	<button
		class="ml-1 opacity-60 hover:opacity-100"
		title={t('game.dismiss')}
		aria-label={t('game.dismiss')}
		onclick={ondismisshint}>✕</button
	>
</p>
