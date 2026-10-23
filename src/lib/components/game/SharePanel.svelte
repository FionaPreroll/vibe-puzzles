<script lang="ts">
	import { t } from '../../i18n/index.svelte';

	/** A link to the board as it is, and once rendered a picture of it to download. */
	let {
		link,
		image,
		filename,
		onclose
	}: {
		link: string;
		/** PNG data URL; null while it renders or if it could not be made. */
		image: string | null;
		filename: string;
		onclose: () => void;
	} = $props();
</script>

<div class="panel mt-3 text-sm">
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0 space-y-2">
			<p>
				{t('game.shareLink')}
				<a class="link in-text break-all" href={link}>{link}</a>
			</p>
			{#if image}
				<p>
					<a class="link" href={image} download={filename}>{t('game.screenshot')}</a>
				</p>
			{/if}
		</div>
		<button class="btn-icon" aria-label={t('game.closeShare')} onclick={onclose}>✕</button>
	</div>
</div>
