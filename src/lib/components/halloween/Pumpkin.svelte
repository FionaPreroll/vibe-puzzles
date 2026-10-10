<script lang="ts">
	/**
	 * A pumpkin. With a face it is a jack-o'-lantern, which glows at night as if a candle burned
	 * inside it; `face="night"` shows the face only then.
	 */
	let {
		face = 'none',
		deep = false,
		class: className = ''
	}: { face?: 'none' | 'always' | 'night'; deep?: boolean; class?: string } = $props();
</script>

<svg viewBox="0 0 84 76" class="{face === 'none' ? '' : 'jack-lit'} {className}" aria-hidden="true">
	<path
		d="M42 16 C42 9 45 5 51 3"
		fill="none"
		stroke="#4d7c0f"
		stroke-width="5"
		stroke-linecap="round"
	/>
	<ellipse cx="25" cy="46" rx="23" ry="27" fill={deep ? '#c2410c' : '#ea580c'} />
	<ellipse cx="59" cy="46" rx="23" ry="27" fill={deep ? '#c2410c' : '#ea580c'} />
	<ellipse cx="42" cy="46" rx="19" ry="29" fill={deep ? '#ea580c' : '#f97316'} />
	{#if face !== 'none'}
		<g class="jack-face {face === 'night' ? 'only-night' : ''}">
			<path d="M27 41 L33 31 L39 41 Z M45 41 L51 31 L57 41 Z" />
			<path d="M25 51 Q42 68 59 51 L55 53 L51 50 L47 55 L42 51 L37 55 L33 50 L29 53 Z" />
		</g>
	{/if}
</svg>
