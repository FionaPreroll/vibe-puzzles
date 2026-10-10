<script lang="ts">
	/** A spider on its thread, swinging gently; dark by day, pale with ember eyes by night. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 28 62" class="halloween-swing {className}" aria-hidden="true">
	<path d="M14 0 V40" class="stroke-[#b9a6c9] dark:stroke-[#5a4c73]" stroke-width="1" />
	<g
		fill="none"
		class="stroke-[#2a1b3d] dark:stroke-[#b8aecb]"
		stroke-width="1.6"
		stroke-linecap="round"
	>
		<path d="M10 44 Q4 40 2 44" />
		<path d="M10 47 Q3 46 1 51" />
		<path d="M10 50 Q4 52 3 57" />
		<path d="M18 44 Q24 40 26 44" />
		<path d="M18 47 Q25 46 27 51" />
		<path d="M18 50 Q24 52 25 57" />
	</g>
	<g class="fill-[#2a1b3d] dark:fill-[#b8aecb]">
		<circle cx="14" cy="48" r="6" />
		<circle cx="14" cy="41" r="3.5" />
	</g>
	<g class="fill-white dark:fill-[#f28a2e]">
		<circle cx="12.7" cy="40.6" r="0.9" />
		<circle cx="15.3" cy="40.6" r="0.9" />
	</g>
</svg>
