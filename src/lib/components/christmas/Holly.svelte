<script lang="ts">
	/** A sprig of holly: two leaves and three berries. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 56 36" class={className} aria-hidden="true">
	<g class="fill-[#1f6f3f] dark:fill-[#2f8a52]">
		<path d="M28 20 Q22 8 4 6 Q8 9 6 12 Q10 12 10 16 Q14 14 16 18 Q19 15 22 19 Q24 17 28 20 Z" />
		<path d="M28 20 Q34 8 52 6 Q48 9 50 12 Q46 12 46 16 Q42 14 40 18 Q37 15 34 19 Q32 17 28 20 Z" />
	</g>
	<g fill="none" class="stroke-[#14532d] dark:stroke-[#1d6b3d]" stroke-width="0.8">
		<path d="M27 19 Q16 11 7 8" />
		<path d="M29 19 Q40 11 49 8" />
	</g>
	<g fill="#c81e1e">
		<circle cx="24" cy="24" r="4.2" />
		<circle cx="32" cy="24" r="4.2" />
		<circle cx="28" cy="30" r="4.2" />
	</g>
	<g fill="#fff" opacity=".5">
		<circle cx="22.8" cy="22.6" r="1" />
		<circle cx="30.8" cy="22.6" r="1" />
		<circle cx="26.8" cy="28.6" r="1" />
	</g>
</svg>
