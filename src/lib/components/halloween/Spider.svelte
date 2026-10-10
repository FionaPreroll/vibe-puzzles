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
		<!-- Eight legs, four on each side -->
		<path d="M10 43 Q4 38 2 41" />
		<path d="M10 46 Q3 44 1 48" />
		<path d="M10 49 Q3 50 1 55" />
		<path d="M10 52 Q5 55 4 60" />
		<path d="M18 43 Q24 38 26 41" />
		<path d="M18 46 Q25 44 27 48" />
		<path d="M18 49 Q25 50 27 55" />
		<path d="M18 52 Q23 55 24 60" />
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
