<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		BACKUP_PARTS,
		backupGames,
		createBackup,
		mergeBackup,
		parseBackup,
		restoreBackup,
		type Backup,
		type BackupPart
	} from '#lib/client/backup.ts';
	import { backupFromHash, backupLink, qrCode } from '#lib/client/backupLink.ts';
	import { choose } from '#lib/client/confirm.svelte.ts';
	import { downloadFile } from '#lib/client/download.ts';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import type { ChangelogRelease, Inline } from '../../../scripts/changelog';

	const build = __BUILD__;
	const app = { version: build.version, commit: build.commit };
	/** Open: changes not in a version yet and the newest version; the older ones fold away. */
	const open = __CHANGELOG__.slice(0, Math.max(1, __CHANGELOG__.findIndex((r) => r.date) + 1));
	const earlier = __CHANGELOG__.slice(open.length);
	const REPO = 'https://github.com/FionaPreroll/vibe-puzzles';
	const CONTACT = 'fipreroll+app@gmail.com';
	const schemaUrl = asset('backup.schema.json');

	let error = $state('');
	let done = $state('');

	/** Game names for the choice of games; Calcudoku is a mode of Sudoku. */
	const GAME_NAMES: Record<string, string> = { sudoku: 'Sudoku, Calcudoku' };
	const gameName = (id: string) => GAME_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

	/** What the export takes: every part and every game until the player chooses. */
	let parts = $state<BackupPart[]>([...BACKUP_PARTS]);
	let games = $state<string[]>([]);
	let chosenGames = $state<string[]>([]);

	onMount(() => {
		games = backupGames(localStorage);
		chosenGames = [...games];
		void importFromLink();
		const onHash = () => void importFromLink();
		addEventListener('hashchange', onHash);
		return () => removeEventListener('hashchange', onHash);
	});

	/** A link made for the choice `selection` (its JSON): it goes stale once the choice changes. */
	let link = $state<{ selection: string; url: string; qr: ReturnType<typeof qrCode> } | null>(null);
	let linkStatus = $state('');
	const selection = $derived(JSON.stringify([parts, chosenGames]));
	const shownLink = $derived(link?.selection === selection ? link : null);
	const canShare = typeof navigator !== 'undefined' && !!navigator.share;

	async function makeLink() {
		const url = await backupLink(new URL(resolve('/about'), location.href).href, makeBackup());
		link = { selection, url, qr: qrCode(url) };
		linkStatus = '';
	}

	async function shareLink() {
		if (!shownLink) return;
		try {
			await navigator.share({ title: t('about.linkTitle'), url: shownLink.url });
		} catch {
			// The share sheet was closed.
		}
	}

	async function copyLink() {
		if (!shownLink) return;
		try {
			await navigator.clipboard.writeText(shownLink.url);
			linkStatus = t('about.linkCopied');
		} catch {
			linkStatus = t('about.linkCopyFailed');
		}
	}

	/** A link to this page that carries a backup (`backupLink`) offers to import it. */
	async function importFromLink() {
		const parsed = await backupFromHash(location.hash);
		if (!parsed) return;
		// Out of the address bar and the history: a reload does not ask again.
		history.replaceState(history.state, '', location.pathname + location.search);
		error = done = '';
		if (!parsed.ok) return void (error = t('about.linkFailed', { error: parsed.error }));
		await importBackup(parsed.backup);
	}

	function makeBackup() {
		return createBackup(localStorage, app, new URL(schemaUrl, location.href).href, new Date(), {
			parts,
			games: chosenGames
		});
	}

	/** How many entries the file gets, so that an empty choice cannot be exported. */
	const entries = $derived.by(() => {
		if (typeof localStorage === 'undefined') return 0;
		const selection = { parts, games: chosenGames };
		return Object.keys(createBackup(localStorage, app, undefined, undefined, selection).data)
			.length;
	});

	function exportBackup() {
		const backup = makeBackup();
		const blob = new Blob([JSON.stringify(backup, null, '\t')], { type: 'application/json' });
		downloadFile(blob, `vibe-puzzles-backup-${backup.exportedAt.slice(0, 10)}.json`);
	}

	/** A release's heading: its version and day, in the page's language. */
	function releaseTitle(r: ChangelogRelease): string {
		if (!r.date) return t('about.unreleased');
		const date = new Date(`${r.date}T00:00:00Z`).toLocaleDateString(i18n.locale, {
			dateStyle: 'long',
			timeZone: 'UTC'
		});
		return t('about.release', { version: r.version, date });
	}

	async function importFile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		error = done = '';
		const parsed = parseBackup(await file.text());
		if (!parsed.ok) return void (error = t('about.importFailed', { error: parsed.error }));
		await importBackup(parsed.backup);
	}

	/** Ask whether to merge or replace, then do so and reload. */
	async function importBackup(backup: Backup) {
		const count = Object.keys(backup.data).length;
		const choice = await choose({
			title: t('confirm.import.title', { count }),
			text: t('confirm.import.text'),
			confirm: t('confirm.import.ok'),
			other: t('confirm.import.replace'),
			otherDanger: true
		});
		if (!choice) return;
		if (choice === 'other') {
			restoreBackup(localStorage, backup);
			done = t('about.imported', { count });
		} else {
			const changed = mergeBackup(localStorage, backup);
			if (!changed) return void (done = t('about.mergedNothing'));
			done = t('about.merged', { count: changed });
		}
		setTimeout(() => location.reload(), 800);
	}
</script>

{#snippet inline(parts: Inline[])}{#each parts as part, k (k)}{#if part.code}<code
				class="rounded bg-stone-100 px-1 text-xs dark:bg-stone-800">{part.text}</code
			>{:else if part.strong}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}{/snippet}

{#snippet release(r: ChangelogRelease)}
	<h3 class="mt-4 font-semibold">{releaseTitle(r)}</h3>
	{#each r.notes as note, k (k)}
		<p class="mt-1">{@render inline(note)}</p>
	{/each}
	{#each r.sections as section (section.title)}
		<h4
			class="mt-3 text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400"
		>
			{t(`about.changeKind.${section.title.toLowerCase()}`)}
		</h4>
		<ul class="mt-1 list-disc space-y-1 pl-5">
			{#each section.items as item, k (k)}
				<li>{@render inline(item)}</li>
			{/each}
		</ul>
	{/each}
{/snippet}

<svelte:head>
	<title>{t('about.title')} · {t('app.name')}</title>
</svelte:head>

<h1 class="font-display text-3xl font-bold tracking-tight">{t('about.title')}</h1>
<p class="mt-2 text-stone-600 dark:text-stone-400">{t('about.intro')}</p>
<p class="mt-1 text-stone-600 dark:text-stone-400">
	{t('about.contact')} <a class="link in-text" href="mailto:{CONTACT}">{CONTACT}</a>
</p>
<p class="mt-1 text-stone-600 dark:text-stone-400">
	{t('about.inside')} <a class="link in-text" href={resolve('/inside')}>{t('about.insideLink')}</a>
</p>

<div class="mt-6 grid max-w-3xl gap-6">
	<section class="panel">
		<h2 class="section-title">{t('about.build')}</h2>
		<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-stone-500 dark:text-stone-400">{t('about.version')}</dt>
			<dd>{build.version}</dd>
			<dt class="text-stone-500 dark:text-stone-400">{t('about.commit')}</dt>
			<dd class="font-mono">
				{#if /^[0-9a-f]{7,}$/.test(build.commit)}
					<a class="link" href="{REPO}/commit/{build.commit}">{build.commit.slice(0, 7)}</a>
				{:else}
					{build.commit}
				{/if}
			</dd>
			<dt class="text-stone-500 dark:text-stone-400">{t('about.built')}</dt>
			<dd>{new Date(build.date).toLocaleString(i18n.locale)}</dd>
			<dt class="text-stone-500 dark:text-stone-400">{t('about.source')}</dt>
			<dd><a class="link" href={REPO}>GitHub</a></dd>
		</dl>
	</section>

	{#if open.length}
		<section class="panel text-sm" id="changes">
			<h2 class="section-title">{t('about.changes')}</h2>
			<p class="mt-2 text-stone-600 dark:text-stone-400">{t('about.changesNote')}</p>
			{#each open as r (r.version)}
				{@render release(r)}
			{/each}
			{#if earlier.length}
				<details class="mt-4">
					<summary class="cursor-pointer text-stone-600 dark:text-stone-400">
						{t('about.earlier')}
					</summary>
					{#each earlier as r (r.version)}
						{@render release(r)}
					{/each}
				</details>
			{/if}
		</section>
	{/if}

	<section class="panel">
		<h2 class="section-title">{t('about.backup')}</h2>
		<p class="mt-2 text-sm">{t('about.backupNote')}</p>
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<button class="btn" onclick={exportBackup} disabled={!entries}>{t('about.export')}</button>
			<button class="btn" onclick={makeLink} disabled={!entries}>{t('about.makeLink')}</button>
			<label class="btn cursor-pointer">
				{t('about.import')}
				<input type="file" accept="application/json,.json" class="sr-only" onchange={importFile} />
			</label>
			<!-- A static file, not a page: without the reload the router looks for a game of that name. -->
			<a class="link text-sm" href={schemaUrl} data-sveltekit-reload>{t('about.schema')}</a>
		</div>
		<details class="mt-3 text-sm">
			<summary class="cursor-pointer text-stone-600 dark:text-stone-400">
				{t('about.choose')}
			</summary>
			<div class="mt-2 flex flex-wrap gap-x-8 gap-y-3">
				<fieldset>
					<legend class="font-semibold">{t('about.contents')}</legend>
					{#each BACKUP_PARTS as part (part)}
						<label class="mt-1 flex items-center gap-2">
							<input type="checkbox" value={part} bind:group={parts} />
							{t(`about.part.${part}`)}
						</label>
					{/each}
				</fieldset>
				{#if games.length}
					<fieldset>
						<legend class="font-semibold">{t('about.games')}</legend>
						{#each games as game (game)}
							<label class="mt-1 flex items-center gap-2">
								<input type="checkbox" value={game} bind:group={chosenGames} />
								{gameName(game)}
							</label>
						{/each}
					</fieldset>
				{/if}
			</div>
			<p class="mt-2 text-stone-600 dark:text-stone-400" aria-live="polite">
				{t('about.entries', { count: entries })}
			</p>
		</details>
		{#if shownLink}
			<div class="mt-3 flex flex-wrap items-start gap-4 text-sm">
				{#if shownLink.qr}
					<svg
						class="w-48 shrink-0 rounded bg-white"
						viewBox="0 0 {shownLink.qr.size} {shownLink.qr.size}"
						shape-rendering="crispEdges"
						role="img"
						aria-label={t('about.linkQr')}
					>
						<path d={shownLink.qr.path} fill="#000" />
					</svg>
				{/if}
				<div class="min-w-0 flex-1 basis-64">
					<p>
						{shownLink.qr
							? t('about.linkScan')
							: t('about.linkTooLong', { length: shownLink.url.length })}
					</p>
					{#if parts.includes('player')}
						<p class="mt-2 text-amber-700 dark:text-amber-400">{t('about.linkPlayer')}</p>
					{/if}
					<input
						class="mt-2 w-full rounded border border-stone-300 bg-transparent px-2 py-1 font-mono text-xs dark:border-stone-600"
						readonly
						value={shownLink.url}
						aria-label={t('about.linkTitle')}
						onfocus={(e) => e.currentTarget.select()}
					/>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						{#if canShare}
							<button class="btn" onclick={shareLink}>{t('about.shareLink')}</button>
						{/if}
						<button class="btn" onclick={copyLink}>{t('about.copyLink')}</button>
						{#if linkStatus}<span role="status">{linkStatus}</span>{/if}
					</div>
				</div>
			</div>
		{/if}
		{#if error}<p class="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
				{error}
			</p>{/if}
		{#if done}<p class="mt-2 text-sm text-emerald-700 dark:text-emerald-400" role="status">
				{done}
			</p>{/if}
	</section>

	<section class="panel text-sm">
		<h2 class="section-title">{t('about.privacy')}</h2>
		<p class="mt-2">{t('about.privacyLocal')}</p>
		<p class="mt-2">{t('about.privacyServer')}</p>
		<p class="mt-2">{t('about.privacyHost')}</p>
	</section>

	<section class="panel text-sm">
		<h2 class="section-title">{t('about.licenses')}</h2>
		<p class="mt-2">{t('about.licensesNote')}</p>
		<ul class="mt-2 space-y-2">
			{#each __LICENSES__ as l (l.name)}
				<li>
					<a class="link in-text" href={l.url}>{l.name}</a>
					{l.version} · {l.license}
					<details class="mt-1">
						<summary class="cursor-pointer text-stone-600 dark:text-stone-400">
							{t('about.licenseText', { name: l.name })}
						</summary>
						<pre
							class="mt-1 max-h-64 overflow-auto rounded-md bg-stone-100 p-3 text-xs whitespace-pre-wrap dark:bg-stone-800">{l.text}</pre>
					</details>
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-stone-600 dark:text-stone-400">{t('about.puzzleTypes')}</p>
	</section>
</div>
