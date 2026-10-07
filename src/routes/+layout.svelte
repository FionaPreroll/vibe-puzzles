<script lang="ts">
	import './layout.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import { setNight, theme } from '#lib/client/settings.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		document.documentElement.classList.toggle('dark', theme.night);
	});

	const nav = [
		{ href: resolve('/'), label: 'Games', match: (p: string) => p === resolve('/') },
		{
			href: resolve('/scores'),
			label: 'Scores',
			match: (p: string) => p.startsWith(resolve('/scores'))
		},
		{
			href: resolve('/player'),
			label: 'Player',
			match: (p: string) => p.startsWith(resolve('/player'))
		}
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header
	class="border-b border-stone-200 bg-white/80 backdrop-blur dark:border-stone-800 dark:bg-stone-900/80"
>
	<div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
		<a href={resolve('/')} class="text-lg font-bold tracking-tight">Vibe Puzzles</a>
		<nav class="flex gap-1 text-sm" aria-label="Main">
			{#each nav as item (item.href)}
				{@const active = item.match(page.url.pathname)}
				<a
					href={item.href}
					class="rounded-md px-2.5 py-1 hover:bg-stone-100 dark:hover:bg-stone-800 {active
						? 'font-semibold'
						: ''}"
					aria-current={active ? 'page' : undefined}>{item.label}</a
				>
			{/each}
		</nav>
		<button
			class="btn-icon ml-auto"
			aria-label={theme.night ? 'Switch to day mode' : 'Switch to night mode'}
			title="Night mode"
			onclick={() => setNight(!theme.night)}>{theme.night ? '☀︎' : '☾'}</button
		>
	</div>
</header>

<main class="mx-auto max-w-7xl px-4 py-6">
	{@render children()}
</main>
