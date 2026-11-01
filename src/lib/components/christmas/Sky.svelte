<script lang="ts">
	import Aurora from './Aurora.svelte';
	import Snowfall from './Snowfall.svelte';
</script>

<!-- Behind the home page's title in draft A: snow falling, and by night the northern lights and
     stars. -->
<div class="snow-only pointer-events-none absolute -inset-x-4 -inset-y-6" aria-hidden="true">
	<Aurora />
	<svg class="only-night absolute inset-0 size-full">
		<g fill="#e6eef7">
			<circle class="xmas-twinkle" cx="38%" cy="18%" r="1.4" />
			<circle cx="55%" cy="28%" r="1.2" opacity=".7" />
			<circle class="xmas-twinkle" cx="62%" cy="74%" r="1.1" />
			<circle cx="71%" cy="12%" r="1" opacity=".6" />
			<circle cx="96%" cy="20%" r="1.3" opacity=".8" />
			<circle cx="30%" cy="80%" r="0.9" opacity=".5" />
		</g>
	</svg>
	<Snowfall class="text-[#9ec3e6] dark:text-white" />
</div>
