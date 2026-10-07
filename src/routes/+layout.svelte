<script lang="ts">
	import './layout.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import { setNight, theme } from '#lib/client/settings.svelte.ts';
	import { i18n, initLocale, LOCALES, setLocale, t, type Locale } from '#lib/i18n/index.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	if (typeof window !== 'undefined') initLocale();

	$effect(() => {
		document.documentElement.classList.toggle('dark', theme.night);
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
</svelte:head>

<header
	class="border-b border-stone-200 bg-white/80 backdrop-blur dark:border-stone-800 dark:bg-stone-900/80"
>
	<div class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4">
		<a
			href={resolve('/')}
			class="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight whitespace-nowrap"
		>
			<img src={favicon} alt="" class="size-6" />
			<span class="hidden sm:inline">{t('app.name')}</span>
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
		<select
			class="ml-auto rounded-md bg-transparent px-1 py-1 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
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
</header>

<main class="mx-auto max-w-7xl px-4 py-6">
	{@render children()}
</main>
