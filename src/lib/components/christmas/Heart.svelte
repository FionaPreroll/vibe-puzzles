<script lang="ts">
	/** A red heart with white stitching, on a thread (draft C). */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 -8 40 44" class={className} aria-hidden="true">
	<path d="M20 -8 V6" class="stroke-[#a33a32] dark:stroke-[#8b7f71]" stroke-width="1" />
	<path
		d="M20 34 C6 24 1 17 1 11 C1 5 5.5 1 11 1 C15 1 18 3.5 20 7 C22 3.5 25 1 29 1 C34.5 1 39 5 39 11 C39 17 34 24 20 34 Z"
		class="fill-[#b23a3a] dark:fill-[#9b3a30]"
	/>
	<path
		d="M20 29.5 C9 21.5 5 16 5 11.2 C5 7.3 8 4.8 11.3 4.8 C14.6 4.8 17 7 20 11.5 C23 7 25.4 4.8 28.7 4.8 C32 4.8 35 7.3 35 11.2 C35 16 31 21.5 20 29.5 Z"
		fill="none"
		class="stroke-[#f8f5f0] dark:stroke-[#f3d9b0]"
		stroke-width="1"
		stroke-dasharray="2.2 2"
	/>
</svg>
