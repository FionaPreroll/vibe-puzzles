<script lang="ts">
	import { onMount } from 'svelte';
	import {
		currentPlayer,
		linkDevice,
		register,
		rename,
		serverAvailable,
		signOut,
		type Player
	} from '#lib/client/api.ts';

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
		serverAvailable().then((ok) => (hasServer = ok));
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
	<title>Player · Vibe Puzzles</title>
</svelte:head>

<h1 class="text-3xl font-bold tracking-tight">Player</h1>

<div class="mt-6 max-w-xl space-y-6">
	{#if hasServer === null}
		<p class="text-stone-500">Checking for the server…</p>
	{:else if !hasServer}
		<section class="panel text-sm text-stone-700 dark:text-stone-300">
			<p>
				This deployment has no server, so games are saved in this browser only and there are no
				online leaderboards. Everything else works as usual.
			</p>
		</section>
	{:else if !player}
		<section class="panel">
			<h2 class="text-lg font-semibold">Pick a name</h2>
			<p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
				Your name appears on the leaderboards. Your games and settings sync to the server so you can
				continue on another device. No email or password needed.
			</p>
			<form
				class="mt-4 flex gap-2"
				onsubmit={(e) => (e.preventDefault(), run(() => register(name)))}
			>
				<input class="input flex-1" maxlength="24" required placeholder="Name" bind:value={name} />
				<button class="btn btn-primary" disabled={busy}>Start</button>
			</form>
		</section>
		<section class="panel">
			<h2 class="text-lg font-semibold">Already playing on another device?</h2>
			<p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
				Enter the sync code shown on that device.
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
				<button class="btn" disabled={busy}>Link device</button>
			</form>
		</section>
	{:else}
		<section class="panel">
			<h2 class="text-lg font-semibold">Name</h2>
			<form class="mt-3 flex gap-2" onsubmit={(e) => (e.preventDefault(), run(() => rename(name)))}>
				<input class="input flex-1" maxlength="24" required bind:value={name} />
				<button class="btn" disabled={busy || name === player.name}>Rename</button>
			</form>
		</section>
		<section class="panel">
			<h2 class="text-lg font-semibold">Sync code</h2>
			<p class="mt-1 text-sm text-stone-600 dark:text-stone-400">
				Enter this code on another device to continue your games there. Keep it private: it is the
				key to your player.
			</p>
			<div class="mt-3 flex items-center gap-2">
				<code class="rounded-md bg-stone-100 px-3 py-2 font-mono dark:bg-stone-800">
					{showCode ? grouped : '••••-••••-••••-••••'}
				</code>
				<button class="btn" onclick={() => (showCode = !showCode)}
					>{showCode ? 'Hide' : 'Show'}</button
				>
			</div>
		</section>
		<button
			class="btn"
			onclick={() => {
				if (confirm('Sign out on this device? Keep your sync code to sign back in.')) {
					signOut();
					player = null;
				}
			}}>Sign out</button
		>
	{/if}
	{#if error}<p class="text-sm text-rose-600">{error}</p>{/if}
</div>
