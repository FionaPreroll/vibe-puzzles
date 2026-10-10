<script lang="ts">
	/** A cobweb for a top right corner. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg
	viewBox="0 0 64 64"
	fill="none"
	stroke-width="0.9"
	class="stroke-[#cdb6dc] dark:stroke-[#54467a] {className}"
	aria-hidden="true"
>
	<path d="M64 0 L8 4 M64 0 L20 30 M64 0 L40 52 M64 0 L60 62" />
	<path d="M45.5 1.3 Q50 4.8 49.5 9.9 Q54.5 11.5 56.1 17.2 Q60.1 16 62.7 20.5" />
	<path d="M29.3 2.5 Q37.6 9 36.7 18.6 Q46.1 21.6 49.1 32.2 Q56.6 30 61.5 38.4" />
	<path d="M13.6 3.6 Q25.8 13 24.4 27 Q38 31.4 42.4 46.8 Q53.3 43.6 60.4 55.8" />
</svg>
