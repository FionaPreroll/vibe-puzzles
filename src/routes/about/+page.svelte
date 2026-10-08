<script lang="ts">
	import { asset } from '$app/paths';
	import { createBackup, parseBackup, restoreBackup } from '#lib/client/backup.ts';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';

	const build = __BUILD__;
	const REPO = 'https://github.com/FionaPreroll/vibe-puzzles';
	const schemaUrl = asset('backup.schema.json');

	let error = $state('');
	let done = $state('');

	function exportBackup() {
		const backup = createBackup(
			localStorage,
			{ version: build.version, commit: build.commit },
			new URL(schemaUrl, location.href).href
		);
		const blob = new Blob([JSON.stringify(backup, null, '\t')], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `vibe-puzzles-backup-${backup.exportedAt.slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	async function importBackup(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		error = done = '';
		const parsed = parseBackup(await file.text());
		if (!parsed.ok) return void (error = t('about.importFailed', { error: parsed.error }));
		const count = Object.keys(parsed.backup.data).length;
		if (!confirm(t('about.confirmImport', { count }))) return;
		restoreBackup(localStorage, parsed.backup);
		done = t('about.imported', { count });
		setTimeout(() => location.reload(), 800);
	}
</script>

<svelte:head>
	<title>{t('about.title')} · {t('app.name')}</title>
</svelte:head>

<h1 class="text-3xl font-bold tracking-tight">{t('about.title')}</h1>
<p class="mt-2 text-stone-600 dark:text-stone-400">{t('about.intro')}</p>

<div class="mt-6 grid max-w-3xl gap-6">
	<section class="panel">
		<h2 class="section-title">{t('about.build')}</h2>
		<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-stone-500">{t('about.version')}</dt>
			<dd>{build.version}</dd>
			<dt class="text-stone-500">{t('about.commit')}</dt>
			<dd class="font-mono">
				{#if /^[0-9a-f]{7,}$/.test(build.commit)}
					<a class="link" href="{REPO}/commit/{build.commit}">{build.commit.slice(0, 7)}</a>
				{:else}
					{build.commit}
				{/if}
			</dd>
			<dt class="text-stone-500">{t('about.built')}</dt>
			<dd>{new Date(build.date).toLocaleString(i18n.locale)}</dd>
			<dt class="text-stone-500">{t('about.source')}</dt>
			<dd><a class="link" href={REPO}>GitHub</a></dd>
		</dl>
	</section>

	<section class="panel">
		<h2 class="section-title">{t('about.backup')}</h2>
		<p class="mt-2 text-sm">{t('about.backupNote')}</p>
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<button class="btn" onclick={exportBackup}>{t('about.export')}</button>
			<label class="btn cursor-pointer">
				{t('about.import')}
				<input
					type="file"
					accept="application/json,.json"
					class="sr-only"
					onchange={importBackup}
				/>
			</label>
			<!-- A static file, not a page: without the reload the router looks for a game of that name. -->
			<a class="link text-sm" href={schemaUrl} data-sveltekit-reload>{t('about.schema')}</a>
		</div>
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
					<a class="link" href={l.url}>{l.name}</a>
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
