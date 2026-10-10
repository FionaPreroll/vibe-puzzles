<script lang="ts">
	import { updated } from '$app/state';
	import { currentPlayer, pingServer, setOfflineMode, syncNow } from '../client/api';
	import { trapFocus } from '../client/focus';
	import { net, setUpdateCheck } from '../client/network.svelte';
	import { i18n, t } from '../i18n/index.svelte';

	/**
	 * The connection button in the header and its menu: whether the server answers and how fast,
	 * offline mode, "Sync now" and the update check. Small, but always there to switch quickly,
	 * e.g. on a train.
	 */

	let { class: className = '' }: { class?: string } = $props();
	const uid = $props.id();

	let open = $state(false);
	let box: HTMLDivElement | undefined = $state();
	let hasPlayer = $state(false);
	let syncFailed = $state(false);
	let updateNote = $state('');
	let checking = $state(false);

	const server = $derived(net.hasServer && net.status !== 'none');
	const status = $derived(
		net.offline
			? t('net.offline')
			: net.status === 'online' || net.status === 'none'
				? t('net.online')
				: t(`net.${net.status}`)
	);
	const latency = $derived(
		!net.offline && net.status === 'online' && net.latencyMs != null
			? t('net.latency', { ms: net.latencyMs })
			: ''
	);
	/** Next to the icon on wider screens. */
	const short = $derived(
		net.offline ? t('net.offline') : net.status === 'unreachable' ? t('net.unreachable') : latency
	);
	const dot = $derived(
		net.offline || net.status === 'checking' || net.status === 'none'
			? 'bg-stone-400'
			: net.status === 'online'
				? 'bg-emerald-500'
				: 'bg-amber-500'
	);
	const label = $derived(t('net.label', { status: latency ? `${status}, ${latency}` : status }));

	const clock = (ms: number) =>
		new Date(ms).toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit' });

	function toggle() {
		open = !open;
		if (open) {
			hasPlayer = !!currentPlayer();
			syncFailed = false;
			updateNote = '';
			void pingServer();
		}
	}

	async function sync() {
		syncFailed = !(await syncNow());
	}

	async function checkUpdate() {
		checking = true;
		updateNote = '';
		try {
			if (!(await updated.check())) updateNote = t('net.upToDate');
		} catch {
			updateNote = t('net.checkFailed');
		} finally {
			checking = false;
		}
	}
</script>

<svelte:window
	onpointerdown={(e) => {
		if (open && !box?.contains(e.target as Node)) open = false;
	}}
/>

<div class="relative shrink-0 {className}" bind:this={box}>
	<button
		class="btn-icon w-auto gap-1 px-1.5"
		aria-label={label}
		title={label}
		aria-expanded={open}
		aria-haspopup="dialog"
		onclick={toggle}
	>
		<span class="relative">
			<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
				<path
					d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.1 4.5 4.5 0 0 0 7 18Z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linejoin="round"
				/>
				{#if net.offline}
					<path d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
				{/if}
			</svg>
			{#if server || net.offline}
				<span
					class="absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-white dark:ring-stone-900 {dot}"
				></span>
			{/if}
		</span>
		{#if short}<span class="hidden text-xs tabular-nums sm:inline">{short}</span>{/if}
		{#if net.pending && server}<span class="text-xs tabular-nums" aria-hidden="true"
				>↑{net.pending}</span
			>{/if}
	</button>
	{#if open}
		<div
			class="popover fixed inset-x-4 top-14 z-40 space-y-3 text-sm sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-1 sm:w-72"
			role="dialog"
			aria-label={t('net.menu')}
			{@attach (node) => trapFocus(node, () => (open = false))}
		>
			<div>
				<p class="flex items-center gap-2 font-medium">
					<span class="size-2 shrink-0 rounded-full {dot}"></span>
					<span>{status}{latency ? ` · ${latency}` : ''}</span>
				</p>
				{#if server && net.lastContact}
					<p class="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
						{t('net.lastContact', { time: clock(net.lastContact) })}
					</p>
				{/if}
				{#if !server}
					<p class="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{t('net.noneText')}</p>
				{/if}
			</div>

			<div class="flex items-start gap-2">
				<input
					id="{uid}-offline"
					type="checkbox"
					class="mt-0.5 accent-indigo-600"
					aria-describedby="{uid}-offline-text"
					checked={net.offline}
					onchange={(e) => setOfflineMode(e.currentTarget.checked)}
				/>
				<div>
					<label class="font-medium" for="{uid}-offline">{t('net.offlineMode')}</label>
					<p id="{uid}-offline-text" class="text-xs text-stone-500 dark:text-stone-400">
						{t('net.offlineModeText')}{server ? ` ${t('net.offlineModeSync')}` : ''}
					</p>
				</div>
			</div>

			{#if server}
				<div class="space-y-1 border-t border-stone-200 pt-3 dark:border-stone-700">
					{#if hasPlayer}
						<button class="btn-sm" disabled={net.syncing} onclick={sync}
							>{net.syncing ? t('net.syncing') : t('net.syncNow')}</button
						>
						{#if syncFailed}
							<p class="text-xs text-amber-700 dark:text-amber-400">{t('net.syncFailed')}</p>
						{/if}
						{#if net.pending}
							<p class="text-xs text-stone-500 dark:text-stone-400">
								{net.pending === 1 ? t('net.pendingOne') : t('net.pending', { count: net.pending })}
							</p>
						{/if}
						{#if net.lastSync}
							<p class="text-xs text-stone-500 dark:text-stone-400">
								{t('net.lastSync', { time: clock(net.lastSync) })}
							</p>
						{/if}
					{:else}
						<p class="text-xs text-stone-500 dark:text-stone-400">{t('net.noPlayer')}</p>
					{/if}
				</div>
			{/if}

			<div class="space-y-1 border-t border-stone-200 pt-3 dark:border-stone-700">
				<div class="flex items-start gap-2">
					<input
						id="{uid}-updates"
						type="checkbox"
						class="mt-0.5 accent-indigo-600"
						aria-describedby="{uid}-updates-text"
						checked={net.updateCheck}
						onchange={(e) => setUpdateCheck(e.currentTarget.checked)}
					/>
					<div>
						<label class="font-medium" for="{uid}-updates">{t('net.updateCheck')}</label>
						<p id="{uid}-updates-text" class="text-xs text-stone-500 dark:text-stone-400">
							{t('net.updateCheckText')}
						</p>
					</div>
				</div>
				{#if updated.current}
					<p class="flex items-center gap-2 text-xs">
						<span>{t('update.available')}</span>
						<button class="btn-sm" onclick={() => location.reload()}>{t('update.reload')}</button>
					</p>
				{:else}
					<button class="btn-sm" disabled={checking} onclick={checkUpdate}
						>{t('net.checkNow')}</button
					>
					{#if updateNote}
						<p class="text-xs text-stone-500 dark:text-stone-400">{updateNote}</p>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>
