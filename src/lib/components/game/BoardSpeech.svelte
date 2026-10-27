<script lang="ts">
	import { controlsKeys, t } from '../../i18n/index.svelte';
	import { modifierName } from './shortcuts';

	/**
	 * What a screen reader says about the board the keys play: how to play it with the keys, read
	 * when the board gets the focus (the board's `aria-describedby` names `id`), and `text`, the
	 * place of the keyboard cursor, read out whenever it changes. The live region is there before
	 * its first text: screen readers only follow regions they already know.
	 */
	let { id, game, text }: { id: string; game: string; text: string } = $props();

	const mod = typeof navigator !== 'undefined' ? modifierName(navigator.userAgent) : 'Ctrl';
	// Sudoku names its keys in its text for the mouse.
	const help = $derived(controlsKeys(game, mod) || t(`games.${game}.controlsMouse`));
</script>

<p {id} hidden>{help}</p>
<p class="sr-only" aria-live="polite" aria-atomic="true" data-testid="board-speech">{text}</p>
