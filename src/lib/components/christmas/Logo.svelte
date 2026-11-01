<script lang="ts">
	/** The app's logo in the Christmas look: red with a gold star by day, fir green by night. */
	let { class: className = '' }: { class?: string } = $props();

	const MODES = [
		{
			mode: 'day',
			bg: '#b3261e',
			edge: '#b3261e',
			grid: '#f6c3c3',
			piece: '#ffffff',
			rim: '#ffffff'
		},
		{
			mode: 'night',
			bg: '#13241b',
			edge: '#34473a',
			grid: '#34473a',
			piece: '#f8f5ec',
			rim: '#f5c451'
		}
	];
</script>

<span class="christmas-only inline-flex {className}" aria-hidden="true">
	{#each MODES as c (c.mode)}
		<svg viewBox="0 0 64 64" class="only-{c.mode} size-full">
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
				d="M45 11 L47.4 16.6 L53.5 17.2 L48.9 21.2 L50.3 27.2 L45 24 L39.7 27.2 L41.1 21.2 L36.5 17.2 L42.6 16.6 Z"
				fill="#f5c451"
				stroke={c.rim}
				stroke-width="1.5"
				stroke-linejoin="round"
			/>
		</svg>
	{/each}
</span>
