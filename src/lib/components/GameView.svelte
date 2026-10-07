<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { replaceState } from '$app/navigation';
	import { currentPlayer, pullSave, pushSave, serverAvailable } from '../client/api';
	import {
		cleanupSpecialSaves,
		clearOldSaves,
		GameSession,
		MAX_CHECKPOINTS
	} from '../client/session.svelte';
	import {
		GameSettings,
		loadTool,
		loadTouchMode,
		saveTool,
		saveTouchMode,
		type StoredSettings
	} from '../client/settings.svelte';
	import { getStats } from '../client/stats';
	import { load, save, setQuotaHandler } from '../client/storage';
	import { formatDuration } from '../core/time';
	import type { GameModule, TouchMode } from '../core/types';
	import { periodKey } from '../core/variants';
	import HoldButton from './HoldButton.svelte';
	import SettingsDialog from './SettingsDialog.svelte';

	let { game }: { game: GameModule } = $props();

	const settings = untrack(() => new GameSettings(game.id, game.settings));
	const session = untrack(() => new GameSession(game, settings));
	const Board = $derived(game.board);
	const isTouch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;

	let tool = $state(untrack(() => loadTool(game.id, game.defaultTool(isTouch))));
	let previousTool = $state(untrack(() => game.defaultTool(isTouch)));
	let toolOption = $state(untrack(() => game.toolOptions?.default ?? 0));
	let showSwatches = $state(false);
	let touchMode = $state<TouchMode>(loadTouchMode());
	let showSettings = $state(false);
	let rulesHidden = $state(load<boolean>('rulesHidden', false));
	let panelCollapsed = $state(false);
	let now = $state(Date.now());
	let showZoom = $state(false);
	let share = $state<{ link: string; image: string | null } | null>(null);
	let idInput = $state('');
	let newBusy = $state(false);
	let boardArea: HTMLDivElement | undefined = $state();
	let hasServer = $state(false);

	const variant = $derived(session.variant);
	const zoomKey = $derived(`zoom:${game.id}:${variant.key}`);
	let zoom = $derived(load<number>(zoomKey, 1));
	const cellSize = $derived(Math.round(36 * zoom));

	function setZoom(z: number) {
		zoom = Math.min(4, Math.max(0.15, z));
		save(zoomKey, zoom);
	}

	function fitZoom() {
		if (!boardArea || !session.puzzle) return;
		const p = session.puzzle as { width: number };
		const available = boardArea.parentElement!.clientWidth;
		const target = Math.max(320, Math.min(available * 0.9, available));
		setZoom(target / (36 * (p.width + 1)));
	}

	function setTool(t: string) {
		if (t !== tool) previousTool = tool;
		tool = t;
		saveTool(game.id, t);
	}

	function setTouchMode(mode: TouchMode) {
		touchMode = mode;
		saveTouchMode(mode);
	}

	function variantUrl(key: string, id?: number) {
		const q = new URLSearchParams({ v: key });
		if (id != null) q.set('id', String(id));
		return `${resolve('/[game]', { game: game.id })}?${q}`;
	}

	async function openVariant(key: string, puzzleId?: number) {
		share = null;
		await session.open(key, { puzzleId });
		replaceState(variantUrl(session.variant.key), {});
	}

	async function newPuzzle() {
		if (newBusy) return;
		newBusy = true;
		share = null;
		try {
			await session.newPuzzle();
		} finally {
			newBusy = false;
		}
	}

	function openById() {
		const id = Number(idInput.replace(/[^0-9]/g, ''));
		if (!id) return;
		idInput = '';
		openVariant(variant.key, id);
	}

	function startOver() {
		if (confirm('Are you sure? This clears the board and restarts the timer.')) session.startOver();
	}

	async function makeShare() {
		if (!session.puzzle || !session.state) return;
		const q = new URLSearchParams({
			id: String(session.puzzleId),
			s: game.encodeState(session.state)
		});
		const link = `${location.origin}${resolve('/[game]', { game: game.id })}?${q}`;
		share = { link, image: null };
		share.image = await screenshot();
	}

	/** Render the board SVG into a PNG data URL. */
	async function screenshot(): Promise<string | null> {
		const svg = boardArea?.querySelector('svg');
		if (!svg) return null;
		const clone = svg.cloneNode(true) as SVGSVGElement;
		clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		const url = URL.createObjectURL(new Blob([clone.outerHTML], { type: 'image/svg+xml' }));
		try {
			const img = new Image();
			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = reject;
				img.src = url;
			});
			const canvas = document.createElement('canvas');
			canvas.width = svg.width.baseVal.value;
			canvas.height = svg.height.baseVal.value;
			const ctx = canvas.getContext('2d')!;
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0);
			return canvas.toDataURL('image/png');
		} catch {
			return null;
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	// ---- Lifecycle ----------------------------------------------------------------------------

	onMount(() => {
		cleanupSpecialSaves();
		setQuotaHandler(() => {
			if (confirm('Your browser storage is full. Clear old saved games?')) clearOldSaves();
		});
		const params = new URL(location.href).searchParams;
		const id = Number(params.get('id')) || undefined;
		session
			.open(params.get('v') ?? game.variants[0].key, {
				puzzleId: id,
				shared: params.get('s') ?? undefined
			})
			.then(() => {
				if (params.has('s') || params.has('id')) replaceState(variantUrl(session.variant.key), {});
			});

		const activity = () =>
			session.setActive(document.visibilityState === 'visible' && document.hasFocus());
		const visibility = () => {
			activity();
			if (document.visibilityState === 'visible') session.refreshFromServer();
			else session.flush();
		};
		const tick = setInterval(() => (now = Date.now()), 500);
		document.addEventListener('visibilitychange', visibility);
		window.addEventListener('focus', activity);
		window.addEventListener('blur', activity);
		window.addEventListener('pagehide', () => session.flush());
		activity();

		serverAvailable().then(async (ok) => {
			hasServer = ok;
			if (!ok || !currentPlayer()) return;
			const remote = await pullSave<StoredSettings>(`settings:${game.id}`);
			if (remote) settings.merge(remote.data);
		});

		return () => {
			clearInterval(tick);
			document.removeEventListener('visibilitychange', visibility);
			window.removeEventListener('focus', activity);
			window.removeEventListener('blur', activity);
			session.flush();
		};
	});

	// Push setting changes for other devices.
	$effect(() => {
		JSON.stringify(settings.values);
		if (!hasServer || !currentPlayer() || !settings.updatedAt) return;
		const data = settings.syncable();
		const t = setTimeout(() => pushSave(`settings:${game.id}`, data, data.updatedAt), 1500);
		return () => clearTimeout(t);
	});

	// ---- Keyboard shortcuts --------------------------------------------------------------------

	function onkeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
		if (document.querySelector('dialog[open]')) return;
		const mod = e.ctrlKey || e.metaKey;
		const key = e.key.toLowerCase();
		if (mod && key === 's') {
			e.preventDefault();
			if (e.shiftKey) session.addCheckpoint();
			else session.saveCheckpoint();
		} else if ((key === 'z' && e.shiftKey) || (key === 'x' && !mod) || (mod && key === 'y')) {
			e.preventDefault();
			session.redo();
		} else if (key === 'z') {
			e.preventDefault();
			session.undo();
		} else if (e.key === 'Enter' && !mod) {
			if ((t?.tagName ?? '') === 'BUTTON') return;
			e.preventDefault();
			session.submit();
		} else if ((e.key === '=' || e.key === '+') && !mod && !e.altKey) {
			e.preventDefault();
			newPuzzle();
		} else if (e.key === ']') {
			if (game.toolOptions)
				setTool(tool === game.toolOptions.tool ? previousTool : game.toolOptions.tool);
		} else if (!mod && !e.altKey && !settings.values.hideControls) {
			const t2 = game.tools.find((x) => x.key === e.key);
			if (t2) return setTool(t2.id);
			const opt = game.toolOptions?.values.find((x) => x.key === e.key);
			if (opt) {
				toolOption = opt.value;
				setTool(game.toolOptions!.tool);
			}
		}
	}

	// Middle mouse button pans the board area.
	let pan: { x: number; y: number } | null = null;
	function onpanstart(e: PointerEvent) {
		if (e.button !== 1) return;
		e.preventDefault();
		pan = { x: e.clientX, y: e.clientY };
	}
	function onpanmove(e: PointerEvent) {
		if (!pan || !boardArea) return;
		boardArea.scrollLeft -= e.clientX - pan.x;
		window.scrollBy(0, -(e.clientY - pan.y));
		pan = { x: e.clientX, y: e.clientY };
	}

	const clock = $derived(
		settings.values.personalTimer ? session.personal(now) : session.elapsed(now)
	);

	function marker(key: string) {
		const v = game.variants.find((x) => x.key === key)!;
		const stats = getStats(game.id, key);
		if (v.special) return stats.lastPeriod === periodKey(v.special) ? '✓' : '';
		return stats.streak >= 100 ? '★' : '';
	}
</script>

<svelte:window {onkeydown} onpointermove={onpanmove} onpointerup={() => (pan = null)} />

<svelte:head>
	<title>{game.name} · {variant.label} · Vibe Puzzles</title>
</svelte:head>

<div class="screen-only flex flex-col gap-6 lg:flex-row lg:items-start">
	<!-- Side panel -->
	<aside
		class="panel w-full shrink-0 lg:sticky lg:top-4 {panelCollapsed ? 'lg:w-14' : 'lg:w-72'}"
		aria-label="{game.name} menu"
	>
		<div class="flex items-center justify-between gap-2">
			{#if !panelCollapsed}
				<h1 class="text-2xl font-bold tracking-tight">
					<span aria-hidden="true">{game.icon}</span>
					{game.name}
				</h1>
			{/if}
			<button
				class="btn-icon hidden lg:inline-flex"
				aria-label={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
				onclick={() => (panelCollapsed = !panelCollapsed)}>{panelCollapsed ? '»' : '«'}</button
			>
		</div>
		{#if !panelCollapsed}
			<section class="mt-4">
				<div class="flex items-center justify-between">
					<h2 class="section-title">Rules</h2>
					<button
						class="link text-sm"
						onclick={() => {
							rulesHidden = !rulesHidden;
							save('rulesHidden', rulesHidden);
						}}>{rulesHidden ? 'Show' : 'Hide'}</button
					>
				</div>
				{#if !rulesHidden}
					<ol class="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
						{#each game.rules as rule, i (i)}<li>{rule}</li>{/each}
					</ol>
					{#each game.notes as note, i (i)}
						<p class="mt-2 text-xs text-stone-500 dark:text-stone-400">{note}</p>
					{/each}
				{/if}
			</section>

			<nav class="mt-5" aria-label="Puzzle types">
				<h2 class="section-title">Puzzle type</h2>
				<ul class="mt-2 grid grid-cols-2 gap-1 text-sm lg:grid-cols-1">
					{#each game.variants as v (v.key)}
						<li>
							<button
								class="w-full rounded-md px-2 py-1 text-left hover:bg-stone-100 dark:hover:bg-stone-800 {v.key ===
								variant.key
									? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
									: ''}"
								onclick={() => openVariant(v.key)}
							>
								{v.label}
								<span class="text-amber-500">{marker(v.key)}</span>
							</button>
						</li>
					{/each}
				</ul>
			</nav>

			<form class="mt-5 flex gap-2" onsubmit={(e) => (e.preventDefault(), openById())}>
				<input
					class="input min-w-0 flex-1"
					inputmode="numeric"
					placeholder="Puzzle ID"
					aria-label="Open puzzle by ID"
					bind:value={idInput}
				/>
				<button class="btn" type="submit">Open</button>
			</form>
			<p class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
				<a class="link" href="{resolve('/scores')}?game={game.id}&v={variant.key}"
					>Hall of fame & statistics</a
				>
			</p>
		{/if}
	</aside>

	<!-- Game column -->
	<section class="min-w-0 flex-1">
		<div
			class="flex flex-wrap items-center gap-2 {settings.values.stickyToolbar
				? 'sticky top-0 z-10 bg-stone-50/95 py-2 backdrop-blur dark:bg-stone-950/95'
				: ''}"
		>
			<div class="relative">
				<button class="btn" onclick={() => (showZoom = !showZoom)} aria-expanded={showZoom}
					>Zoom</button
				>
				{#if showZoom}
					<div class="popover absolute top-full left-0 z-20 mt-1 flex w-72 items-center gap-2">
						<input
							type="range"
							min="15"
							max="400"
							value={Math.round(zoom * 100)}
							oninput={(e) => setZoom(Number(e.currentTarget.value) / 100)}
							class="flex-1 accent-indigo-600"
							aria-label="Zoom"
						/>
						<button class="btn-sm" onclick={() => setZoom(1)} title="Reset to 100%"
							>{Math.round(zoom * 100)}%</button
						>
						<button class="btn-sm" onclick={fitZoom}>Fit</button>
					</div>
				{/if}
			</div>
			<button
				class="btn"
				onclick={() => (showSettings = true)}
				aria-label="Settings"
				title="Settings">⚙︎</button
			>
			{#if !settings.values.hideTimer}
				<span
					class="min-w-20 rounded-md bg-white px-3 py-1.5 text-center font-mono tabular-nums shadow-sm dark:bg-stone-800"
					aria-label="Timer"
				>
					{formatDuration(clock)}
				</span>
				{#if settings.values.personalTimer && !session.solved}
					<button class="btn" onclick={() => session.setManualPause(!session.manualPause)}>
						{session.manualPause ? 'Resume' : 'Pause'}
					</button>
				{/if}
			{/if}
			<HoldButton
				label="Undo"
				action={() => session.undo()}
				disabled={session.past.length === 0 || session.readonly}>↶</HoldButton
			>
			<HoldButton
				label="Redo"
				action={() => session.redo()}
				disabled={session.future.length === 0 || session.readonly}>↷</HoldButton
			>
		</div>

		{#if session.message}
			<p
				class="mt-3 rounded-lg px-4 py-2 text-sm {session.message.kind === 'success'
					? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
					: session.message.kind === 'error'
						? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
						: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200'}"
				role="status"
			>
				{session.message.text}
			</p>
		{/if}

		<div class="relative mt-3">
			<div
				bind:this={boardArea}
				class="overflow-x-auto py-2"
				role="presentation"
				onpointerdown={onpanstart}
			>
				{#if session.puzzle && session.state}
					<div class="mx-auto w-fit {session.paused ? 'invisible' : ''}">
						<Board
							puzzle={session.puzzle}
							state={session.state}
							settings={settings.values}
							{tool}
							{toolOption}
							{cellSize}
							readonly={session.readonly}
							lastChange={session.lastChange}
							keyboard={true}
							{touchMode}
							onmove={(next, changed) => session.move(next, changed)}
						/>
					</div>
				{/if}
			</div>
			{#if session.loading}
				<div class="absolute inset-0 grid min-h-48 place-items-center text-stone-500">
					Creating puzzle…
				</div>
			{:else if session.paused}
				<button
					class="absolute inset-0 grid place-items-center text-lg font-medium"
					onclick={() => session.setManualPause(false)}
				>
					Paused — click to resume
				</button>
			{/if}
		</div>

		{#if !settings.values.hideControls}
			<div class="mt-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Tools">
				{#each game.tools as t (t.id)}
					<button
						class="btn {tool === t.id ? 'btn-active' : ''}"
						aria-pressed={tool === t.id}
						title="{t.label} ({t.key})"
						onclick={() => {
							if (game.toolOptions?.tool === t.id && tool === t.id) showSwatches = !showSwatches;
							setTool(t.id);
						}}
					>
						{t.label}
						{#if game.toolOptions?.tool === t.id}
							<span
								class="inline-block size-3 rounded-full border border-stone-400"
								style:background={game.toolOptions.values.find((o) => o.value === toolOption)
									?.color}
							></span>
						{/if}
					</button>
				{/each}
				{#if game.toolOptions && showSwatches}
					{#each game.toolOptions.values as o (o.value)}
						<button
							class="size-8 rounded-full border-2 {toolOption === o.value
								? 'border-stone-900 dark:border-white'
								: 'border-transparent'}"
							style:background={o.color}
							title="{o.label} ({o.key})"
							aria-label="Colour {o.label}"
							onclick={() => {
								toolOption = o.value;
								setTool(game.toolOptions!.tool);
							}}
						></button>
					{/each}
				{/if}
				{#if isTouch}
					<label class="ml-auto flex items-center gap-1 text-sm">
						Touch
						<select
							class="input py-1"
							value={touchMode}
							onchange={(e) => setTouchMode(e.currentTarget.value as TouchMode)}
						>
							<option value="auto">Auto</option>
							<option value="draw">Always draw</option>
							<option value="pan">Always pan</option>
						</select>
					</label>
				{/if}
			</div>
		{/if}

		{#if settings.values.showCheckpoints}
			<div class="mt-3 flex flex-wrap items-center gap-2" aria-label="Checkpoints">
				<button class="btn-sm" onclick={() => session.saveCheckpoint()} title="Ctrl+S">Save</button>
				<button
					class="btn-sm"
					onclick={() => session.addCheckpoint()}
					disabled={session.checkpoints.length >= MAX_CHECKPOINTS}
					title="Ctrl+Shift+S">Add</button
				>
				{#each session.checkpoints as _, i (i)}
					<span class="relative">
						<button
							class="btn-sm min-w-9 {session.currentCheckpoint === i ? 'btn-active' : ''}"
							onclick={() => session.loadCheckpoint(i)}
							oncontextmenu={(e) => (e.preventDefault(), session.deleteCheckpoint(i))}
							title="Load checkpoint {i + 1} (right click deletes)">{i + 1}</button
						>
						<button
							class="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-stone-300 text-[10px] leading-none dark:bg-stone-600"
							aria-label="Delete checkpoint {i + 1}"
							onclick={() => confirm(`Delete checkpoint ${i + 1}?`) && session.deleteCheckpoint(i)}
							>×</button
						>
					</span>
				{/each}
			</div>
		{/if}

		<p class="mt-4 text-sm text-stone-600 dark:text-stone-400">
			{variant.label} Puzzle ID:
			<span class="font-mono select-all">{session.puzzleId.toLocaleString('en-US')}</span>
		</p>

		<div class="mt-3 flex flex-wrap gap-2">
			<button
				class="btn btn-primary"
				onclick={() => session.submit()}
				disabled={session.solved || session.loading}>Done</button
			>
			<button class="btn" onclick={startOver} disabled={session.loading}>Start Over</button>
			<button class="btn" onclick={() => window.print()}>Print…</button>
			<button class="btn" onclick={makeShare} disabled={session.loading}>Share</button>
			<button class="btn" onclick={newPuzzle} disabled={newBusy || session.loading}
				>New Puzzle</button
			>
		</div>

		{#if share}
			<div class="panel mt-3 text-sm">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 space-y-2">
						<p>
							Link to your progress:
							<a class="link break-all" href={share.link}>{share.link}</a>
						</p>
						{#if share.image}
							<p>
								<a class="link" href={share.image} download="{game.id}-{session.puzzleId}.png"
									>Screenshot (PNG)</a
								>
							</p>
						{/if}
					</div>
					<button class="btn-icon" aria-label="Close share panel" onclick={() => (share = null)}
						>✕</button
					>
				</div>
			</div>
		{/if}
	</section>
</div>

<!-- Printed: the empty puzzle only -->
{#if session.puzzle && session.state}
	<div class="print-only">
		<p class="mb-2 text-sm">{game.name} · {variant.label} · Puzzle ID {session.puzzleId}</p>
		<Board
			puzzle={session.puzzle}
			state={session.state}
			settings={settings.values}
			{tool}
			{toolOption}
			cellSize={Math.min(40, Math.floor(640 / ((session.puzzle as { width: number }).width + 1)))}
			readonly={true}
			lastChange={new Set()}
			blank={true}
			{touchMode}
			onmove={() => {}}
		/>
	</div>
{/if}

<SettingsDialog bind:open={showSettings} {settings} />
