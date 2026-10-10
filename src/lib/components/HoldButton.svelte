<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A button that repeats its action while held: after 500 ms, then every 150 ms. `label` is its
	 * tooltip, and its name too unless it shows text of its own (`named` false).
	 */
	let {
		action,
		disabled = false,
		label,
		named = true,
		class: className = 'btn',
		children
	}: {
		action: () => void;
		disabled?: boolean;
		label: string;
		named?: boolean;
		class?: string;
		children: Snippet;
	} = $props();

	let timer: ReturnType<typeof setTimeout> | null = null;

	function start(e: PointerEvent) {
		if (disabled || e.button !== 0) return;
		stop();
		action();
		const repeat = () => {
			action();
			timer = setTimeout(repeat, 150);
		};
		timer = setTimeout(repeat, 500);
		// Once its action disables the button, Svelte no longer hands it the release (unless it
		// lands on the button itself rather than its icon or text), so listen for it on the window.
		window.addEventListener('pointerup', stop, { once: true });
		window.addEventListener('pointercancel', stop, { once: true });
	}

	function stop() {
		if (timer) clearTimeout(timer);
		timer = null;
		window.removeEventListener('pointerup', stop);
		window.removeEventListener('pointercancel', stop);
	}

	// Nothing left to repeat once disabled, nor once gone.
	$effect(() => {
		if (disabled) stop();
	});
	$effect(() => stop);
</script>

<button
	class={className}
	aria-label={named ? label : undefined}
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
