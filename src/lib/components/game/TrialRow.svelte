<script lang="ts">
	import type { AnySession } from '../../client/session.svelte';
	import { t } from '../../i18n/index.svelte';

	/** While a trial runs: what it means, and the way out either way. */
	let { session }: { session: AnySession } = $props();
</script>

{#if session.trial && !session.solved}
	<div class="trial-row" role="group" aria-label={t('game.trialRunning')}>
		<span class="px-1">{t('game.trialRunning')}</span>
		<button
			class="trial-btn"
			onclick={() => session.keepTrial()}
			disabled={session.readonly}
			title={t('game.trialKeepTitle')}
		>
			<svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
				<path
					d="m5 12.5 4.5 4.5L19 7.5"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>{t('game.trialKeep')}
		</button>
		<button
			class="trial-btn"
			onclick={() => session.dropTrial()}
			disabled={session.readonly}
			title={t('game.trialDropTitle')}
		>
			<svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
				<path
					d="M6.5 6.5l11 11m0-11-11 11"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
				/>
			</svg>{t('game.trialDrop')}
		</button>
	</div>
{/if}
