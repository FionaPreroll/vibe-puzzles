<script lang="ts">
	import CandyCane from './CandyCane.svelte';
	import ChristmasTree from './ChristmasTree.svelte';
	import Gift from './Gift.svelte';

	/** The home page's Christmas scene next to the title: a decorated tree with presents. */
</script>

<div class="christmas-only pointer-events-none shrink-0 select-none" aria-hidden="true">
	<!-- Phones: a small one in the corner -->
	<div class="absolute -top-1 right-0 h-20 w-24 sm:hidden">
		<ChristmasTree class="absolute right-3 bottom-0 w-12" />
		<Gift colour="#1f6f3f" ribbon="#c81e1e" class="absolute right-0 bottom-0 w-6" />
		<Gift class="absolute bottom-0 left-4 w-7" />
	</div>
	<div class="relative hidden h-36 w-72 sm:block">
		<ChristmasTree class="absolute right-20 bottom-0 w-24" />
		<Gift class="absolute right-[10.5rem] bottom-0 w-12" />
		<Gift colour="#1f6f3f" ribbon="#c81e1e" class="absolute right-[13.5rem] bottom-0 w-8" />
		<Gift colour="#2563eb" ribbon="#e5e7eb" class="absolute right-10 bottom-0 w-10" />
		<Gift colour="#d9a63a" ribbon="#b3261e" class="absolute right-3 bottom-0 w-7" />
		<CandyCane class="absolute right-0 bottom-0 w-4 rotate-12" />
	</div>
</div>
