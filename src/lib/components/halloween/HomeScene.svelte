<script lang="ts">
	import Bat from './Bat.svelte';
	import Candle from './Candle.svelte';
	import Moon from './Moon.svelte';
	import Pumpkin from './Pumpkin.svelte';
</script>

<!--
	The home page's Halloween scene, next to the title: pumpkins by day; by night the same
	pumpkins, lit by candles, under a full moon with bats. Phones get a small one in the corner.
-->
<div class="halloween-only pointer-events-none shrink-0 select-none" aria-hidden="true">
	<div class="absolute -top-1 right-0 h-20 w-24 sm:hidden">
		<Pumpkin face="always" class="only-day halloween-bob absolute top-1 right-0 w-14" />
		<Moon class="only-night absolute top-0 right-0 size-14" />
		<div class="only-night halloween-drift absolute top-7 right-8">
			<Bat class="halloween-flap w-7 text-[#0e0a17]" />
		</div>
		<Pumpkin face="always" class="only-night absolute bottom-0 left-1 w-11" />
	</div>

	<div class="relative hidden h-36 w-72 sm:block">
		<Moon class="only-night absolute top-0 right-10 size-28" />
		<div class="only-night halloween-drift absolute top-11 right-24">
			<Bat class="halloween-flap w-12 text-[#0e0a17]" />
		</div>
		<div class="only-night halloween-drift-slow absolute top-2 right-2">
			<Bat class="halloween-flap w-8 text-[#4a3d6b]" />
		</div>
		<div class="only-night halloween-drift-slow absolute top-14 left-6">
			<Bat class="halloween-flap w-9 text-[#4a3d6b]" />
		</div>
		<div class="absolute right-2 bottom-0 flex items-end gap-1">
			<Pumpkin face="night" class="w-12" />
			<Pumpkin face="always" class="halloween-bob w-24" />
			<Pumpkin face="night" deep class="w-14" />
			<Candle class="only-night mb-0.5 ml-1 w-4" />
		</div>
	</div>
</div>
