<svelte:options namespace="svg" />

<script lang="ts" module>
	/** Thickness of the dashed outlines: it grows with the board, so they are seen at a glance. */
	export const spotlightWidth = (cellSize: number) => Math.max(3, cellSize * 0.06);
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		cellSize,
		colour,
		background,
		mistake = false,
		children
	}: {
		cellSize: number;
		/** The dashes: the cursor colour, or the error colour for wrong marks. */
		colour: string;
		/** The board's own background, for the band beneath the dashes. */
		background: string;
		mistake?: boolean;
		/** The outlines' shapes, without stroke or fill: drawn once as the band, once dashed. */
		children: Snippet;
	} = $props();

	const width = $derived(spotlightWidth(cellSize));
</script>

<!-- What a hint or a tutorial step points at: thick dashes on a band of the board's background,
     so that they stand out from the tint beneath them, from lines and from pipes, in either theme.
     Both layers breathe together (see `.spotlight` in layout.css). -->
<g
	class="spotlight-halo"
	fill="none"
	stroke={background}
	stroke-width={width + 3}
	aria-hidden="true"
>
	{@render children()}
</g>
<g
	class="spotlight"
	data-mistake={mistake || undefined}
	fill="none"
	stroke={colour}
	stroke-width={width}
	stroke-dasharray="{width * 1.6} {width * 1.4}"
	aria-hidden="true"
>
	{@render children()}
</g>
