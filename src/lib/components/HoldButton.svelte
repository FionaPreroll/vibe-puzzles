<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A button that repeats its action while held: after 500 ms, then every 150 ms. */
	let {
		action,
		disabled = false,
		label,
		children
	}: { action: () => void; disabled?: boolean; label: string; children: Snippet } = $props();

	let timer: ReturnType<typeof setTimeout> | null = null;

	function start(e: PointerEvent) {
		if (disabled || e.button !== 0) return;
		action();
		const repeat = () => {
			action();
			timer = setTimeout(repeat, 150);
		};
		timer = setTimeout(repeat, 500);
	}

	function stop() {
		if (timer) clearTimeout(timer);
		timer = null;
	}
</script>

<button
	class="btn"
	aria-label={label}
	title={label}
	{disabled}
	onpointerdown={start}
	onpointerup={stop}
	onpointerleave={stop}
	onpointercancel={stop}
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), action())}
>
	{@render children()}
</button>
