<script lang="ts">
	import './layout.css';
	// Headings of the Halloween look; browsers load each font only once a page uses it.
	import '@fontsource/cinzel/latin-600.css';
	import '@fontsource/fredoka/latin-600.css';
	import { resolve } from '$app/paths';
	import { page, updated } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Bunting from '#lib/components/halloween/Bunting.svelte';
	import HalloweenLogo from '#lib/components/halloween/Logo.svelte';
	import { followSystemTheme, setLook, setNight, theme } from '#lib/client/settings.svelte.ts';
	import { paletteCss } from '#lib/core/palette.ts';
	import { LOOK_CHOICES, seasonalLook, type LookChoice } from '#lib/core/theme.ts';
	import { i18n, initLocale, LOCALES, setLocale, t, type Locale } from '#lib/i18n/index.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	if (typeof window !== 'undefined') initLocale();

	/** Browsers that support installing the app fire this event; we offer a button for it. */
	interface InstallPrompt extends Event {
		prompt(): Promise<void>;
	}
	let install = $state<InstallPrompt | null>(null);
	/** A newer version is online; hidden for this page view once dismissed. */
	let updateDismissed = $state(false);

	$effect(() => {
		const offer = (e: Event) => {
			e.preventDefault();
			install = e as InstallPrompt;
		};
		const installed = () => (install = null);
		window.addEventListener('beforeinstallprompt', offer);
		window.addEventListener('appinstalled', installed);
		return () => {
			window.removeEventListener('beforeinstallprompt', offer);
			window.removeEventListener('appinstalled', installed);
		};
	});

	$effect(() => {
		document.documentElement.classList.toggle('dark', theme.night);
	});
	$effect(followSystemTheme);
	$effect(() => {
		if (theme.look === 'halloween') document.documentElement.dataset.theme = theme.look;
		else delete document.documentElement.dataset.theme;
	});

	const nav = $derived([
		{ href: resolve('/'), label: t('nav.games'), match: (p: string) => p === resolve('/') },
		{
			href: resolve('/scores'),
			label: t('nav.scores'),
			match: (p: string) => p.startsWith(resolve('/scores'))
		},
		{
			href: resolve('/player'),
			label: t('nav.player'),
			match: (p: string) => p.startsWith(resolve('/player'))
		}
	]);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- The board colours as CSS variables, built from a constant in palette.ts -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<style>${paletteCss()}</style>`}
</svelte:head>

<header
	class="relative border-b border-stone-200 bg-white/80 backdrop-blur dark:border-stone-800 dark:bg-stone-900/80"
>
	<div class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4">
		<a
			href={resolve('/')}
			class="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight whitespace-nowrap"
		>
			<img src={favicon} alt="" class="classic-only size-6" />
			<HalloweenLogo class="halloween-only size-6" />
			<span class="font-display hidden sm:inline">{t('app.name')}</span>
		</a>
		<nav class="flex min-w-0 gap-0.5 text-sm sm:gap-1" aria-label="Main">
			{#each nav as item (item.href)}
				{@const active = item.match(page.url.pathname)}
				<a
					href={item.href}
					class="rounded-md px-2 py-1 whitespace-nowrap hover:bg-stone-100 sm:px-2.5 dark:hover:bg-stone-800 {active
						? 'font-semibold'
						: ''}"
					aria-current={active ? 'page' : undefined}>{item.label}</a
				>
			{/each}
		</nav>
		{#if install}
			<button
				class="btn-sm ml-auto gap-1"
				aria-label={t('pwa.install')}
				title={t('pwa.install')}
				onclick={async () => {
					await install?.prompt();
					install = null;
				}}
				><span aria-hidden="true">⤓</span><span class="hidden sm:inline">{t('pwa.install')}</span
				></button
			>
		{/if}
		<select
			class="{install
				? 'sm:ml-0'
				: ''} ml-auto rounded-md bg-transparent px-1 py-1 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
			aria-label={t('app.language')}
			value={i18n.locale}
			onchange={(e) => setLocale(e.currentTarget.value as Locale)}
		>
			{#each LOCALES as l (l.id)}<option value={l.id} title={l.label}>{l.id.toUpperCase()}</option
				>{/each}
		</select>
		<button
			class="btn-icon shrink-0"
			aria-label={theme.night ? t('nav.dayMode') : t('nav.nightMode')}
			title={theme.night ? t('nav.dayMode') : t('nav.nightMode')}
			onclick={() => setNight(!theme.night)}>{theme.night ? '☀︎' : '☾'}</button
		>
	</div>
	<!-- Hangs into the space above the page's content, so nothing moves -->
	<div class="absolute inset-x-0 top-full"><Bunting /></div>
</header>

<main class="mx-auto max-w-7xl px-4 py-6">
	{@render children()}
</main>

<footer
	class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-6 text-xs text-stone-500 dark:text-stone-400"
>
	<span>
		<a class="hover:underline" href={resolve('/about')}>{t('about.link')}</a>
		· v{__BUILD__.version} ({__BUILD__.commit.slice(0, 7)})
	</span>
	<label class="flex items-center gap-1">
		{t('look.label')}
		<select
			class="rounded-md bg-transparent px-1 py-1 hover:bg-stone-100 dark:hover:bg-stone-800"
			value={theme.lookChoice}
			onchange={(e) => setLook(e.currentTarget.value as LookChoice)}
		>
			{#each LOOK_CHOICES as choice (choice)}
				<option value={choice}
					>{choice === 'auto'
						? t('look.auto', { look: t(`look.${seasonalLook(new Date())}`) })
						: t(`look.${choice}`)}</option
				>
			{/each}
		</select>
	</label>
</footer>

<ConfirmDialog />

{#if updated.current && !updateDismissed}
	<div
		class="popover fixed inset-x-0 top-3 z-50 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-3 text-sm"
		role="status"
	>
		<span>{t('update.available')}</span>
		<button class="btn btn-primary btn-sm" onclick={() => location.reload()}
			>{t('update.reload')}</button
		>
		<button
			class="btn-icon size-7"
			aria-label={t('update.dismiss')}
			title={t('update.dismiss')}
			onclick={() => (updateDismissed = true)}>✕</button
		>
	</div>
{/if}
