<script lang="ts">
	import { resolve } from '$app/paths';
	import { GAMES } from '#lib/games/index.ts';
</script>

<svelte:head>
	<title>Vibe Puzzles</title>
</svelte:head>

<section class="max-w-3xl">
	<h1 class="text-3xl font-bold tracking-tight">Logic puzzles, one click away</h1>
	<p class="mt-2 text-stone-600 dark:text-stone-400">
		Every puzzle has exactly one solution and is generated fresh in your browser. Pick a game to
		start.
	</p>
</section>

<ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each GAMES as game (game.id)}
		<li>
			<a
				href={resolve('/[game]', { game: game.id })}
				class="panel block h-full transition hover:border-indigo-400 hover:shadow-md"
			>
				<div class="flex items-center gap-3">
					<span class="text-3xl" aria-hidden="true">{game.icon}</span>
					<h2 class="text-xl font-semibold">{game.name}</h2>
				</div>
				<p class="mt-2 text-sm text-stone-600 dark:text-stone-400">{game.tagline}</p>
				<p class="mt-3 flex flex-wrap gap-2 text-xs">
					{#each game.variants.filter((v) => v.special) as v (v.key)}
						<span
							class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
							>{v.label.replace('Special ', '')}</span
						>
					{/each}
				</p>
			</a>
		</li>
	{/each}
</ul>
