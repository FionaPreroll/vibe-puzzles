<script lang="ts">
	/** A snowman with a top hat and a red scarf. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 64 92" class={className} aria-hidden="true">
	<g
		class="stroke-[#6b4a2e] dark:stroke-[#8b6a4e]"
		stroke-width="2"
		stroke-linecap="round"
		fill="none"
	>
		<path d="M18 44 L4 34 M8 37 L5 30" />
		<path d="M46 44 L60 34 M56 37 L59 30" />
	</g>
	<g
		class="fill-white stroke-[#bcd3ea] dark:fill-[#e6eef7] dark:stroke-[#7489a2]"
		stroke-width="1.5"
	>
		<circle cx="32" cy="70" r="20" />
		<circle cx="32" cy="42" r="14" />
		<circle cx="32" cy="21" r="10.5" />
	</g>
	<g class="fill-[#22364b] dark:fill-[#0a1726]">
		<rect x="22" y="2" width="20" height="11" rx="1.5" />
		<rect x="18" y="11.5" width="28" height="3.2" rx="1.6" />
		<circle cx="28.5" cy="19" r="1.3" />
		<circle cx="35.5" cy="19" r="1.3" />
		<circle cx="32" cy="40" r="1.4" />
		<circle cx="32" cy="47" r="1.4" />
		<circle cx="32" cy="64" r="1.6" />
	</g>
	<rect x="22" y="9" width="20" height="2.6" fill="#dc2626" />
	<path d="M32 22 L41 24 L32 25.2 Z" fill="#f97316" />
	<path d="M23 30 Q32 35 41 30 L41 34.5 Q32 38.5 23 34.5 Z" fill="#dc2626" />
	<path d="M36 34 L39 47 L34.5 47 L33 35 Z" fill="#b91c1c" />
</svg>
