<script lang="ts">
	/** The app's logo in the Halloween look: a pumpkin on purple by day, a moon by night. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<span class="inline-flex {className}" aria-hidden="true">
	<svg viewBox="0 0 64 64" class="only-day size-full">
		<rect width="64" height="64" rx="14" fill="#6d28d9" />
		<g fill="none" stroke="#ddd6fe" stroke-width="2">
			<path d="M12 25h40M12 38h40M25 12v40M38 12v40" />
			<rect x="12" y="12" width="40" height="40" rx="2" />
		</g>
		<path fill="#ffffff" d="M12 12h13v26h13v14H12z" opacity=".95" />
		<path d="M45 15v-5" stroke="#4d7c0f" stroke-width="3" stroke-linecap="round" />
		<ellipse cx="45" cy="21" rx="8" ry="6.5" fill="#f97316" stroke="#ffffff" stroke-width="2" />
		<path d="M45 15.5v11" stroke="#c2410c" stroke-width="1.4" />
	</svg>
	<svg viewBox="0 0 64 64" class="only-night size-full">
		<rect
			x="1"
			y="1"
			width="62"
			height="62"
			rx="13"
			fill="#1e1538"
			stroke="#3b2d5c"
			stroke-width="2"
		/>
		<g fill="none" stroke="#4b3b70" stroke-width="2">
			<path d="M12 25h40M12 38h40M25 12v40M38 12v40" />
			<rect x="12" y="12" width="40" height="40" rx="2" />
		</g>
		<path fill="#eee8f7" d="M12 12h13v26h13v14H12z" opacity=".95" />
		<circle cx="45" cy="19" r="6" fill="#f4ecd8" />
		<circle cx="47.5" cy="17.5" r="5" fill="#1e1538" />
	</svg>
</span>
