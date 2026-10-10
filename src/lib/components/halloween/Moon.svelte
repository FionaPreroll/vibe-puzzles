<script lang="ts">
	/** A full moon with a soft halo. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg
	viewBox="0 0 132 132"
	class="drop-shadow-[0_0_24px_rgb(244_236_216_/_0.28)] {className}"
	aria-hidden="true"
>
	<circle cx="66" cy="66" r="58" fill="#f4ecd8" />
	<circle cx="46" cy="50" r="10" fill="#e3d8bd" />
	<circle cx="82" cy="84" r="14" fill="#e6dbc2" />
	<circle cx="86" cy="40" r="6" fill="#e3d8bd" />
	<circle cx="40" cy="88" r="5" fill="#e6dbc2" />
</svg>
