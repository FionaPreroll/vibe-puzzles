<script lang="ts">
	/** The app's logo in a Christmas draft, by day and by night. */
	let { look, class: className = '' }: { look: 'snow' | 'market' | 'nordic'; class?: string } =
		$props();

	const COLOURS = {
		snow: {
			day: { bg: '#1b6cb8', edge: '#1b6cb8', grid: '#bde0fb', piece: '#ffffff' },
			night: { bg: '#0f2743', edge: '#2f415a', grid: '#2f415a', piece: '#e6eef7' }
		},
		market: {
			day: { bg: '#b3261e', edge: '#b3261e', grid: '#f6c3c3', piece: '#ffffff' },
			night: { bg: '#13241b', edge: '#34473a', grid: '#34473a', piece: '#f8f5ec' }
		},
		nordic: {
			day: { bg: '#2f5d4a', edge: '#2f5d4a', grid: '#b9d7c5', piece: '#f8f5f0' },
			night: { bg: '#1b1714', edge: '#3d3631', grid: '#3d3631', piece: '#f2ebe1' }
		}
	};
</script>

<span class="{look}-only inline-flex {className}" aria-hidden="true">
	{#each ['day', 'night'] as const as mode (mode)}
		{@const c = COLOURS[look][mode]}
		<svg viewBox="0 0 64 64" class="only-{mode} size-full overflow-visible">
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
			{#if look === 'snow'}
				<g fill={mode === 'day' ? '#ffffff' : '#e6eef7'}>
					<path
						d="M3 8 Q8 -1 16 4 Q22 -2 30 3 Q38 -2 46 3 Q54 -1 61 8 L61 6 Q50 10 32 8 Q14 10 3 8 Z"
					/>
				</g>
				<g
					transform="translate(45 20)"
					stroke={mode === 'day' ? '#ffffff' : '#7ddff5'}
					stroke-width="2.2"
					stroke-linecap="round"
				>
					{#each [0, 60, 120] as a (a)}<path transform="rotate({a})" d="M0 -7 V7" />{/each}
				</g>
			{:else if look === 'market'}
				<path
					d="M45 11 L47.4 16.6 L53.5 17.2 L48.9 21.2 L50.3 27.2 L45 24 L39.7 27.2 L41.1 21.2 L36.5 17.2 L42.6 16.6 Z"
					fill="#f5c451"
					stroke={mode === 'day' ? '#ffffff' : '#f5c451'}
					stroke-width="1.5"
					stroke-linejoin="round"
				/>
			{:else}
				{#if mode === 'day'}
					<path
						d="M45 27 C39 23 37 20 37 17.4 C37 14.8 39 13 41.4 13 C43 13 44.2 14 45 15.4 C45.8 14 47 13 48.6 13 C51 13 53 14.8 53 17.4 C53 20 51 23 45 27 Z"
						fill="#c0443a"
						stroke="#ffffff"
						stroke-width="1.5"
					/>
				{:else}
					<rect x="42" y="18" width="6" height="11" rx="1" fill="#efe4d0" />
					<path d="M45 8 C47.5 11.5 48 13.5 45 16 C42 13.5 42.5 11.5 45 8 Z" fill="#f6b04d" />
				{/if}
			{/if}
		</svg>
	{/each}
</span>
