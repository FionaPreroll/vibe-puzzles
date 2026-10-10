<script lang="ts">
	import { onMount } from 'svelte';
	import {
		currentPlayer,
		linkDevice,
		register,
		rename,
		signOut,
		watchServer,
		type Player
	} from '#lib/client/api.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { ask } from '#lib/client/confirm.svelte.ts';

	let hasServer = $state<boolean | null>(null);
	let player = $state<Player | null>(null);
	let name = $state('');
	let code = $state('');
	let error = $state('');
	let busy = $state(false);
	let showCode = $state(false);

	onMount(() => {
		player = currentPlayer();
		name = player?.name ?? '';
		return watchServer((ok) => (hasServer = ok));
	});

	async function run(action: () => Promise<Player | void>) {
		busy = true;
		error = '';
		try {
			const p = await action();
			if (p) {
				player = p;
				name = p.name;
			}
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	const grouped = $derived(player ? player.token.match(/.{1,4}/g)!.join('-') : '');
</script>

<svelte:head>
	<title>{t('player.title')} · {t('app.name')}</title>
</svelte:head>

<h1 class="font-display text-3xl font-bold tracking-tight">{t('player.title')}</h1>

<div class="mt-6 max-w-xl space-y-6">
	{#if hasServer === null}
		<p class="text-stone-500">{t('player.checking')}</p>
	{:else if !hasServer}
		<section class="panel text-sm text-stone-700 dark:text-stone-300">
			<p>{t('player.noServer')}</p>
		</section>
	{:else if !player}
		<section class="panel">
			<h2 class="text-lg font-semibold">{t('player.pickName')}</h2>
			<p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
				{t('player.pickNameText')}
			</p>
			<form
				class="mt-4 flex gap-2"
				onsubmit={(e) => (e.preventDefault(), run(() => register(name)))}
			>
				<input
					class="input flex-1"
					maxlength="24"
					required
					placeholder={t('player.name')}
					bind:value={name}
				/>
				<button class="btn btn-primary" disabled={busy}>{t('player.start')}</button>
			</form>
		</section>
		<section class="panel">
			<h2 class="text-lg font-semibold">{t('player.otherDevice')}</h2>
			<p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
				{t('player.otherDeviceText')}
			</p>
			<form
				class="mt-4 flex gap-2"
				onsubmit={(e) => (e.preventDefault(), run(() => linkDevice(code)))}
			>
				<input
					class="input flex-1 font-mono"
					required
					placeholder="xxxx-xxxx-xxxx-xxxx"
					bind:value={code}
				/>
				<button class="btn" disabled={busy}>{t('player.link')}</button>
			</form>
		</section>
	{:else}
		<section class="panel">
			<h2 class="text-lg font-semibold">{t('player.name')}</h2>
			<form class="mt-3 flex gap-2" onsubmit={(e) => (e.preventDefault(), run(() => rename(name)))}>
				<input class="input flex-1" maxlength="24" required bind:value={name} />
				<button class="btn" disabled={busy || name === player.name}>{t('player.rename')}</button>
			</form>
		</section>
		<section class="panel">
			<h2 class="text-lg font-semibold">{t('player.syncCode')}</h2>
			<p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
				{t('player.syncCodeText')}
			</p>
			<div class="mt-3 flex items-center gap-2">
				<code class="rounded-md bg-stone-100 px-3 py-2 font-mono dark:bg-stone-800">
					{showCode ? grouped : '••••-••••-••••-••••'}
				</code>
				<button class="btn" onclick={() => (showCode = !showCode)}
					>{showCode ? t('player.hide') : t('player.show')}</button
				>
			</div>
		</section>
		<button
			class="btn"
			onclick={async () => {
				const question = {
					title: t('confirm.signOut.title'),
					text: t('confirm.signOut.text'),
					confirm: t('confirm.signOut.ok'),
					danger: true
				};
				if (await ask(question)) {
					signOut();
					player = null;
				}
			}}>{t('player.signOut')}</button
		>
	{/if}
	{#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
</div>
