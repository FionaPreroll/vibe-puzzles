<script lang="ts">
	import Snowfall from './Snowfall.svelte';
</script>

<!-- Behind the home page's title in the winter look: snow falling; by night also the northern
     lights and stars. -->
<div class="winter-only pointer-events-none absolute -inset-x-4 -inset-y-6" aria-hidden="true">
	<div class="only-night absolute inset-x-0 -top-4 h-40 overflow-hidden">
		<div
			class="winter-aurora absolute top-4 right-[6%] h-16 w-[55%] rounded-[50%] bg-[linear-gradient(90deg,transparent,rgb(45_212_191/0.45),rgb(134_239_172/0.35),rgb(139_92_246/0.35),transparent)]"
		></div>
		<div
			class="winter-aurora absolute top-12 right-[22%] h-10 w-[40%] rounded-[50%] bg-[linear-gradient(90deg,transparent,rgb(94_234_212/0.3),rgb(167_139_250/0.3),transparent)] [animation-delay:-6s]"
		></div>
	</div>
	<svg class="only-night absolute inset-0 size-full">
		<g fill="#e6eef7">
			<circle class="winter-twinkle" cx="38%" cy="18%" r="1.4" />
			<circle cx="55%" cy="28%" r="1.2" opacity=".7" />
			<circle class="winter-twinkle" cx="62%" cy="74%" r="1.1" />
			<circle cx="71%" cy="12%" r="1" opacity=".6" />
			<circle cx="96%" cy="20%" r="1.3" opacity=".8" />
			<circle cx="30%" cy="80%" r="0.9" opacity=".5" />
		</g>
	</svg>
	<Snowfall class="text-[#9ec3e6] dark:text-white" />
</div>
