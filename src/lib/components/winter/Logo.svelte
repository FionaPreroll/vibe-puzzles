<script lang="ts">
	/** The app's logo in the winter look: snow on its top and a snowflake, by day and by night. */
	let { class: className = '' }: { class?: string } = $props();

	const MODES = [
		{
			mode: 'day',
			bg: '#1b6cb8',
			edge: '#1b6cb8',
			grid: '#bde0fb',
			piece: '#ffffff',
			snow: '#ffffff',
			flake: '#ffffff'
		},
		{
			mode: 'night',
			bg: '#0f2743',
			edge: '#2f415a',
			grid: '#2f415a',
			piece: '#e6eef7',
			snow: '#e6eef7',
			flake: '#7ddff5'
		}
	];
</script>

<span class="winter-only inline-flex {className}" aria-hidden="true">
	{#each MODES as c (c.mode)}
		<svg viewBox="0 0 64 64" class="only-{c.mode} size-full overflow-visible">
			<rect
				x="1"
				y="1"
				width="62"
				height="62"
				rx="13"
				fill={c.bg}
				stroke={c.edge}
				stroke-width="2"
			/>
			<g fill="none" stroke={c.grid} stroke-width="2">
				<path d="M12 25h40M12 38h40M25 12v40M38 12v40" />
				<rect x="12" y="12" width="40" height="40" rx="2" />
			</g>
			<path fill={c.piece} d="M12 12h13v26h13v14H12z" opacity=".95" />
			<path
				fill={c.snow}
				d="M3 8 Q8 -1 16 4 Q22 -2 30 3 Q38 -2 46 3 Q54 -1 61 8 L61 6 Q50 10 32 8 Q14 10 3 8 Z"
			/>
			<g transform="translate(45 20)" stroke={c.flake} stroke-width="2.2" stroke-linecap="round">
				{#each [0, 60, 120] as a (a)}<path transform="rotate({a})" d="M0 -7 V7" />{/each}
			</g>
		</svg>
	{/each}
</span>
