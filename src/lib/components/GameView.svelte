<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto, replaceState } from '$app/navigation';
	import { currentPlayer, pullSave, pushSave, watchServer } from '../client/api';
	import {
		cleanupSpecialSaves,
		freeSaveSpace,
		GameSession,
		MAX_CHECKPOINTS,
		type OpenOptions
	} from '../client/session.svelte';
	import {
		GameSettings,
		loadTool,
		loadTouchMode,
		saveTool,
		saveTouchMode,
		theme,
		type StoredSettings
	} from '../client/settings.svelte';
	import { load, save, setQuotaHandler } from '../client/storage';
	import {
		boardZoomKey,
		KEY,
		settingsKey,
		tutorialDoneKey,
		tutorialSeenKey
	} from '../client/storageKeys';
	import { ask } from '../client/confirm.svelte';
	import { trapFocus } from '../client/focus';
	import { isTyping, KeyDispatcher } from '../client/keys';
	import { formatDuration } from '../core/time';
	import { decodePuzzleId } from '../core/variants';
	import { CELEBRATION_COLOURS } from '../core/grid';
	import { lightColours } from '../core/palette';
	import type { TouchMode } from '../core/types';
	import type { AnyGame } from '../games';
	import { t, tList, toolHint, toolLabel, variantLabel } from '../i18n/index.svelte';
	import HalloweenBurst from './halloween/Burst.svelte';
	import HoldButton from './HoldButton.svelte';
	import SettingsDialog from './SettingsDialog.svelte';
	import ShortcutsDialog from './ShortcutsDialog.svelte';
	import VariantPicker from './VariantPicker.svelte';

	let { game }: { game: AnyGame } = $props();

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
	let showShortcuts = $state(false);
	let rulesHidden = $state(load<boolean>(KEY.rulesHidden, false));
	let panelCollapsed = $state(false);
	/** Phone layout: the side panel opens as a drawer. */
	let menuOpen = $state(false);
	let now = $state(Date.now());
	let showZoom = $state(false);
	/** The zoom button and its popover; a press anywhere else closes the popover. */
	let zoomBox: HTMLDivElement | undefined = $state();
	let moreOpen = $state(false);
	/**
	 * Phones show messages as a toast over the board, so they never push the layout around.
	 * Errors stay until tapped away, hints until the next move; a hint sits below the board, so
	 * it does not hide the cells it points at.
	 */
	let toast = $state(false);
	/** The side panel, which keeps the focus while it is open as a drawer on phones. */
	let aside: HTMLElement | undefined = $state();
	let share = $state<{ link: string; image: string | null } | null>(null);
	let idInput = $state('');
	let newBusy = $state(false);
	let boardArea: HTMLDivElement | undefined = $state();
	let hasServer = $state(false);
	let celebrate = $state(false);

	// ---- Board size ----------------------------------------------------------------------------

	let areaWidth = $state(0);
	let viewportHeight = $state(800);
	let wide = $state(true);
	let toolbarHeight = $state(0);
	/** Marks the end of the toolbar; unlike the toolbar itself it never sticks. */
	let toolbarEnd: HTMLDivElement | undefined = $state();
	/** Height of the tools, ID line and buttons below the board. */
	let belowHeight = $state(0);
	/** Page offset of the board area's top, measured from the toolbar. */
	let boardTop = $state(200);
	/** Everything on the page below the board area: tools, buttons, paddings and the footer. */
	let afterBoard = $state(120);
	let pageRoot: HTMLDivElement | undefined = $state();
	/** Height of the phones' fixed tool bar (0 where it is hidden). */
	let barHeight = $state(0);
	let gameColumn: HTMLElement | undefined = $state();

	function measure() {
		if (!toolbarEnd || !boardArea || !pageRoot || !gameColumn) return;
		// Board area: mt-3 plus the scroll container's py-1.
		boardTop = toolbarEnd.getBoundingClientRect().top + window.scrollY + 16;
		// Up to the page's end, but not where a longer side panel reaches beyond the game column.
		const root = pageRoot.getBoundingClientRect().bottom;
		const rootContent = root - parseFloat(getComputedStyle(pageRoot).paddingBottom);
		const column = gameColumn.getBoundingClientRect().bottom;
		afterBoard =
			document.body.getBoundingClientRect().bottom -
			boardArea.getBoundingClientRect().bottom -
			Math.max(0, rootContent - column);
	}

	$effect(() => {
		// Re-measure when anything around the board changes size.
		void [viewportHeight, wide, toolbarHeight, areaWidth, belowHeight, barHeight];
		measure();
	});

	// The page ends below the phones' fixed tool bar, so that nothing stays hidden under it: not
	// the buttons below the board, nor the footer of the layout.
	$effect(() => {
		document.body.style.paddingBottom = barHeight ? `${barHeight}px` : '';
		return () => void (document.body.style.paddingBottom = '');
	});

	onMount(() => {
		// The page's own parts (footer, banners) can change size too.
		const observer = new ResizeObserver(() => measure());
		observer.observe(document.body);
		return () => observer.disconnect();
	});

	const variant = $derived(session.variant);
	const zoomKey = $derived(boardZoomKey(game.id, variant.key));
	/** Zoom relative to the automatic size (1 = fit the screen). */
	let zoom = $derived(load<number>(zoomKey, 1));

	/** Largest cell size that shows the whole board without scrolling. */
	const fitCell = $derived.by(() => {
		const p = session.puzzle;
		if (!p || !areaWidth) return 36;
		// The boards' padding in cells: up to 0.2 per side (Pinwheel), more with coordinates.
		const margin = settings.values.showCoordinates ? 1.3 : 0.4;
		// Everything above and below the board (on phones that includes the room kept free for the
		// fixed tool bar).
		const chrome = boardTop + 4 + afterBoard;
		const byWidth = areaWidth / (p.width + margin);
		const byHeight =
			Math.max(240, viewportHeight - chrome) / (p.height + margin + (game.padRows ?? 0));
		return Math.max(16, Math.min(96, Math.floor(Math.min(byWidth, byHeight))));
	});
	const cellSize = $derived(Math.max(8, Math.round(fitCell * zoom)));

	function setZoom(z: number) {
		zoom = Math.min(3, Math.max(0.3, z));
		save(zoomKey, zoom);
	}

	// ---- Actions -------------------------------------------------------------------------------

	function setTool(id: string) {
		if (id !== tool) previousTool = tool;
		tool = id;
		saveTool(game.id, id);
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
		menuOpen = false;
		await session.open(key, { puzzleId });
		replaceState(variantUrl(session.variant.key), {});
	}

	/** Ask before an action that throws an unfinished game away. */
	const askReplace = () => ask(confirmQuestion('replace', true));

	/** A question from the `confirm` texts. */
	function confirmQuestion(key: string, danger = false, values: Record<string, number> = {}) {
		return {
			title: t(`confirm.${key}.title`, values),
			text: t(`confirm.${key}.text`, values),
			confirm: t(`confirm.${key}.ok`, values),
			danger
		};
	}

	async function newPuzzle() {
		if (newBusy) return;
		newBusy = true;
		try {
			if (session.newPuzzleDiscards && !(await ask(confirmQuestion('newPuzzle', true)))) return;
			share = null;
			const before = session.variant.key;
			await session.newPuzzle();
			// A special type continues with a regular one.
			if (session.variant.key !== before) replaceState(variantUrl(session.variant.key), {});
		} finally {
			newBusy = false;
		}
	}

	async function openById() {
		const id = Number(idInput.replace(/[^0-9]/g, ''));
		if (!id) return;
		if (session.replacesGame(variant.key, { puzzleId: id }) && !(await askReplace())) return;
		idInput = '';
		openVariant(variant.key, id);
	}

	async function startOver() {
		if (await ask(confirmQuestion('startOver', true))) session.startOver();
	}

	async function deleteCheckpoint(i: number) {
		if (await ask(confirmQuestion('deleteCheckpoint', true, { n: i + 1 })))
			session.deleteCheckpoint(i);
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

	/** Share the solve, e.g. to a messenger; without the Web Share API the text is copied. */
	async function shareSolve() {
		if (!session.puzzleId) return;
		const url = `${location.origin}${resolve('/[game]', { game: game.id })}?id=${session.puzzleId}`;
		const hints = session.hints;
		const text = t(hints === 0 ? 'game.brag' : hints === 1 ? 'game.bragHint' : 'game.bragHints', {
			game: game.name,
			variant: label,
			id: session.puzzleId.toLocaleString('en-US'),
			time: formatDuration(clock, true),
			count: hints
		});
		if (navigator.share) {
			try {
				await navigator.share({ title: `${game.name} · ${t('app.name')}`, text, url });
			} catch {
				// The share sheet was closed.
			}
			return;
		}
		try {
			await navigator.clipboard.writeText(`${text} ${url}`);
			session.message = { kind: 'info', text: t('game.bragCopied') };
		} catch {
			session.message = { kind: 'info', text: `${text} ${url}` };
		}
	}

	/** Render the board SVG into a PNG data URL, in the light colours whatever the theme. */
	async function screenshot(): Promise<string | null> {
		const svg = boardArea?.querySelector('svg');
		if (!svg) return null;
		// Sizes from now: opening the share panel can shrink the board before the image loads.
		const width = svg.width.baseVal.value;
		const height = svg.height.baseVal.value;
		const clone = svg.cloneNode(true) as SVGSVGElement;
		clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		const markup = lightColours(clone.outerHTML);
		const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
		try {
			const img = new Image();
			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = reject;
				img.src = url;
			});
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
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
		// Storage full: solved games go first; unfinished ones only if the player agrees (asked once).
		// The write that ran out of room fails while the question is open; once the player agrees,
		// the game is saved again, which makes the room.
		let agreed: boolean | null = null;
		let asked = false;
		setQuotaHandler(() =>
			freeSaveSpace(session.slot, () => {
				if (!asked) {
					asked = true;
					ask(confirmQuestion('storageFull', true)).then((ok) => {
						agreed = ok;
						if (ok) session.flush();
					});
				}
				return agreed === true;
			})
		);
		const params = new URL(location.href).searchParams;
		// The very first visit of a game starts with its tutorial.
		if (game.tutorial && params.size === 0 && !load<boolean>(tutorialSeenKey(game.id), false)) {
			save(tutorialSeenKey(game.id), true);
			if (!load<boolean>(tutorialDoneKey(game.id), false)) {
				goto(resolve('/[game]/tutorial', { game: game.id }), { replaceState: true });
				return;
			}
		}
		const id = Number(params.get('id')) || undefined;
		const start = async () => {
			let variantKey = params.get('v') ?? game.variants[0].key;
			let opts: OpenOptions = { puzzleId: id, shared: params.get('s') ?? undefined };
			// A link must not silently take the place of an unfinished game of its type.
			if (id && session.replacesGame(variantKey, opts) && !(await askReplace())) {
				variantKey = game.variants[decodePuzzleId(id).variantIndex]?.key ?? variantKey;
				opts = {};
			}
			await session.open(variantKey, opts);
			if (params.has('s') || params.has('id')) replaceState(variantUrl(session.variant.key), {});
		};
		start();

		const media = matchMedia('(min-width: 1024px)');
		const layout = () => {
			wide = media.matches;
			if (wide) menuOpen = false;
		};
		layout();
		media.addEventListener('change', layout);

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
		const pagehide = () => session.flush();
		window.addEventListener('pagehide', pagehide);
		activity();

		// The server can also answer only later, e.g. when the device was offline at the start.
		let answered = false;
		const stopWatching = watchServer(async (ok) => {
			if (answered && ok === hasServer) return;
			const back = answered && ok;
			answered = true;
			hasServer = ok;
			if (!ok || !currentPlayer()) return;
			if (back) session.refreshFromServer();
			const remote = await pullSave<StoredSettings>(settingsKey(game.id));
			if (remote) settings.merge(remote.data);
		});

		return () => {
			stopWatching();
			clearInterval(tick);
			media.removeEventListener('change', layout);
			document.removeEventListener('visibilitychange', visibility);
			window.removeEventListener('focus', activity);
			window.removeEventListener('blur', activity);
			window.removeEventListener('pagehide', pagehide);
			session.flush();
		};
	});

	// Push setting changes for other devices.
	$effect(() => {
		JSON.stringify(settings.values);
		if (!hasServer || !currentPlayer() || !settings.updatedAt) return;
		const data = settings.syncable();
		const t = setTimeout(() => pushSave(settingsKey(game.id), data, data.updatedAt), 1500);
		return () => clearTimeout(t);
	});

	// A short celebration when the puzzle gets solved while playing (not when opening a solved one).
	let wasSolved = false;
	$effect(() => {
		const solved = session.solved;
		const loading = session.loading;
		if (solved && !wasSolved && !loading && settings.values.solvedAnimation) {
			celebrate = true;
			const timer = setTimeout(() => (celebrate = false), 1800);
			wasSolved = solved;
			// A new puzzle (or anything else ending the solved state) also ends the celebration.
			return () => {
				clearTimeout(timer);
				celebrate = false;
			};
		}
		wasSolved = solved;
	});

	$effect(() => {
		const message = session.message;
		if (!message) return void (toast = false);
		toast = true;
		if (message.kind === 'error' || session.hint) return;
		const timer = setTimeout(() => (toast = false), 4000);
		return () => clearTimeout(timer);
	});

	// The phone drawer keeps the keyboard focus while it is open and gives it back when closed.
	$effect(() => {
		if (menuOpen && !wide && aside) return trapFocus(aside, () => (menuOpen = false));
	});

	// ---- Keyboard shortcuts --------------------------------------------------------------------

	/** The page's shortcuts, for the keys the board leaves (see `keys` below). */
	function shortcuts(e: KeyboardEvent) {
		// Before the input check: the zoom slider has focus while its popover is open.
		if (e.key === 'Escape' && showZoom) return void (showZoom = false);
		if (isTyping(e)) return;
		const target = e.target as HTMLElement | null;
		if (document.querySelector('dialog[open]')) return;
		if (e.key === 'Escape' && menuOpen) return void (menuOpen = false);
		if (e.key === '?') return void (showShortcuts = true);
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
			if ((target?.tagName ?? '') === 'BUTTON') return;
			e.preventDefault();
			session.submit();
		} else if ((e.key === '=' || e.key === '+') && !mod && !e.altKey) {
			e.preventDefault();
			newPuzzle();
		} else if (key === 'h' && !mod && !e.altKey && session.canHint) {
			e.preventDefault();
			session.showHint();
		} else if (e.key === ']') {
			if (game.toolOptions)
				setTool(tool === game.toolOptions.tool ? previousTool : game.toolOptions.tool);
		} else if (!mod && !e.altKey && !settings.values.hideControls) {
			const found = game.tools.find((x) => x.key === e.key);
			if (found) return setTool(found.id);
			const opt = game.toolOptions?.values.find((x) => x.key === e.key);
			if (opt) {
				toolOption = opt.value;
				setTool(game.toolOptions!.tool);
			}
		}
	}

	/** The one keyboard listener: the board gets each key first, then the shortcuts above. */
	const keys = new KeyDispatcher(shortcuts);

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

	function messageClass(kind: string) {
		if (kind === 'success')
			return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200';
		if (kind === 'error') return 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200';
		return 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200';
	}

	const clock = $derived(
		settings.values.personalTimer ? session.personal(now) : session.elapsed(now)
	);
	const swatchNames = $derived(tList('swatch'));
	const showTools = $derived(!settings.values.hideControls);
	/** Desktop: tools join the sticky top bar when that setting is on, else they sit below the board. */
	const toolsOnTop = $derived(!!settings.values.stickyToolbar);
	const label = $derived(variantLabel(variant));
	// A hint's first look tints only where to look; the next press points at the step itself.
	const hintSpotlight = $derived(
		session.hint && session.hintFull ? new Set(session.hint.spotlight) : undefined
	);
	const hintArea = $derived(session.hint?.area ? new Set(session.hint.area) : undefined);
	/** The hint shows only where to look: the message offers the step itself. */
	const teaser = $derived(!!session.hint && !session.hintFull);
	// Turning hints off in the settings also takes a hint on the board away.
	$effect(() => {
		if (!session.canHint) untrack(() => session.dismissHint());
	});
	// A setting that counts as a hint (painting wrong digits red) counts once it is on in a game.
	$effect(() => {
		if (session.assistOn && session.puzzle && !session.loading && !session.solved) {
			untrack(() => session.noteAssist());
		}
	});
</script>

<svelte:window
	onkeydown={keys.keydown}
	onkeyup={keys.keyup}
	onblur={keys.blur}
	onpointerdown={(e) => {
		if (showZoom && !zoomBox?.contains(e.target as Node)) showZoom = false;
	}}
	onpointermove={onpanmove}
	onpointerup={() => (pan = null)}
	bind:innerHeight={viewportHeight}
/>

<svelte:head>
	<!-- The prerendered page cannot know which puzzle a link opens (link previews in messengers
	     show this title), so the puzzle type joins the title once a puzzle is loaded. -->
	<title>{session.puzzle ? `${game.name} · ${label}` : game.name} · {t('app.name')}</title>
</svelte:head>

{#snippet toolButtons(compact: boolean)}
	{#each game.tools as tl (tl.id)}
		{@const name = toolLabel(game.id, tl)}
		{@const hint = toolHint(game.id, tl.id)}
		{@const swatch =
			game.toolOptions?.tool === tl.id
				? game.toolOptions.values.find((o) => o.value === toolOption)?.color
				: undefined}
		<button
			class={compact
				? `flex min-w-14 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-xs ${tool === tl.id ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100' : 'text-stone-600 dark:text-stone-300'}`
				: `btn ${tool === tl.id ? 'btn-active' : ''}`}
			aria-pressed={tool === tl.id}
			title="{name} ({tl.key}){hint ? `: ${hint}` : ''}"
			onclick={() => {
				if (game.toolOptions?.tool === tl.id && tool === tl.id) showSwatches = !showSwatches;
				else if (game.toolOptions?.tool === tl.id && compact) showSwatches = true;
				setTool(tl.id);
			}}
		>
			{#if swatch}
				<span
					class="inline-block {compact
						? 'size-5'
						: 'size-3'} rounded-full border border-stone-400 align-middle"
					style:background={swatch}
				></span>
			{:else}
				<span class={compact ? 'text-lg leading-5' : ''} aria-hidden="true">{tl.icon}</span>
			{/if}
			{name}
		</button>
	{/each}
{/snippet}

{#snippet swatchRow()}
	{#if game.toolOptions && showSwatches}
		<div class="flex flex-wrap items-center gap-2">
			{#each game.toolOptions.values as o (o.value)}
				<button
					class="size-8 rounded-full border-2 {toolOption === o.value
						? 'border-stone-900 dark:border-white'
						: 'border-transparent'}"
					style:background={o.color}
					title="{swatchNames[o.value] ?? o.label} ({o.key})"
					aria-label={t('game.colour', { name: swatchNames[o.value] ?? o.label })}
					onclick={() => {
						toolOption = o.value;
						setTool(game.toolOptions!.tool);
					}}
				></button>
			{/each}
		</div>
	{/if}
{/snippet}

<div bind:this={pageRoot} class="screen-only flex flex-col gap-6 lg:flex-row lg:items-start">
	<!-- Side panel: a column on wide screens, a drawer on phones -->
	{#if menuOpen}
		<button
			class="fixed inset-0 z-30 bg-black/40 lg:hidden"
			aria-label={t('game.closeMenu')}
			onclick={() => (menuOpen = false)}
		></button>
	{/if}
	<aside
		bind:this={aside}
		class="panel shrink-0 lg:sticky lg:top-4 lg:block {panelCollapsed
			? 'lg:w-14'
			: 'lg:w-72'} lg:rounded-xl {menuOpen
			? 'fixed inset-y-0 left-0 z-40 block w-[min(22rem,88vw)] overflow-y-auto rounded-none'
			: 'hidden'}"
		aria-label={t('game.menu', { game: game.name })}
	>
		<div class="flex items-center justify-between gap-2">
			{#if !panelCollapsed}
				<h1 class="font-display text-2xl font-bold tracking-tight">
					<span aria-hidden="true">{game.icon}</span>
					{game.name}
				</h1>
			{/if}
			<button
				class="btn-icon hidden lg:inline-flex"
				aria-label={panelCollapsed ? t('game.expandPanel') : t('game.collapsePanel')}
				onclick={() => (panelCollapsed = !panelCollapsed)}>{panelCollapsed ? '»' : '«'}</button
			>
			<button
				class="btn-icon lg:hidden"
				aria-label={t('game.closeMenu')}
				onclick={() => (menuOpen = false)}>✕</button
			>
		</div>
		{#if !panelCollapsed}
			<nav class="mt-4" aria-label={t('game.puzzleType')}>
				<h2 class="section-title">{t('game.puzzleType')}</h2>
				<div class="mt-1">
					<VariantPicker {game} current={variant.key} onpick={(key) => openVariant(key)} />
				</div>
			</nav>

			<section class="mt-5">
				<div class="flex items-center justify-between">
					<h2 class="section-title">{t('game.rules')}</h2>
					<button
						class="link text-sm"
						onclick={() => {
							rulesHidden = !rulesHidden;
							save(KEY.rulesHidden, rulesHidden);
						}}>{rulesHidden ? t('game.show') : t('game.hide')}</button
					>
				</div>
				{#if !rulesHidden}
					<ol class="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
						{#each tList(variant.mode ? `games.${game.id}.modes.${variant.mode}.rules` : `games.${game.id}.rules`) as rule, i (i)}<li
							>
								{rule}
							</li>{/each}
					</ol>
					{#each tList(`games.${game.id}.notes`) as note, i (i)}
						<p class="mt-2 text-xs text-stone-500 dark:text-stone-400">{note}</p>
					{/each}
					<h3 class="section-title mt-3">{t('game.controls')}</h3>
					<p class="mt-1 text-xs text-stone-500 dark:text-stone-400">
						{t(`games.${game.id}.${isTouch ? 'controlsTouch' : 'controlsMouse'}`)}
					</p>
					{#if !isTouch}
						<button class="link mt-1 text-xs" onclick={() => (showShortcuts = true)}
							>{t('shortcuts.open')}</button
						>
					{/if}
				{/if}
			</section>

			<form class="mt-5 flex gap-2" onsubmit={(e) => (e.preventDefault(), openById())}>
				<input
					class="input min-w-0 flex-1"
					inputmode="numeric"
					placeholder={t('game.puzzleId')}
					aria-label={t('game.openById')}
					bind:value={idInput}
				/>
				<button class="btn" type="submit">{t('game.open')}</button>
			</form>
			<p class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
				<a class="link" href="{resolve('/scores')}?game={game.id}&v={variant.key}"
					>{t('game.scoresLink')}</a
				>
				{#if variant.mode && game.modeTutorials?.[variant.mode]}
					<a
						class="link"
						href={resolve('/[game]/tutorial/[mode]', { game: game.id, mode: variant.mode })}
						>{t('game.tutorial')}</a
					>
				{:else if game.tutorial}
					<a class="link" href={resolve('/[game]/tutorial', { game: game.id })}
						>{t('game.tutorial')}</a
					>
				{/if}
			</p>
		{/if}
	</aside>

	<!-- Game column -->
	<section bind:this={gameColumn} class="min-w-0 flex-1">
		<!-- Phone: game and puzzle type, opens the drawer -->
		<button
			class="mb-2 flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left shadow-sm lg:hidden dark:border-stone-800 dark:bg-stone-900"
			onclick={() => (menuOpen = true)}
			aria-label={t('game.openMenu')}
			aria-expanded={menuOpen}
		>
			<span class="text-xl" aria-hidden="true">{game.icon}</span>
			<span class="font-semibold">{game.name}</span>
			<span class="text-stone-500 dark:text-stone-400">· {label}</span>
			<span class="ml-auto text-stone-400" aria-hidden="true">☰</span>
		</button>

		<div
			bind:offsetHeight={toolbarHeight}
			class="flex flex-wrap items-center gap-1.5 sm:gap-2 {settings.values.stickyToolbar
				? 'sticky top-0 z-10 bg-stone-50/95 py-2 backdrop-blur dark:bg-stone-950/95'
				: ''}"
		>
			<div class="relative" bind:this={zoomBox}>
				<button
					class="btn"
					onclick={() => (showZoom = !showZoom)}
					aria-expanded={showZoom}
					aria-label={t('game.zoom')}
					title={t('game.zoom')}
				>
					<!-- A magnifier with a plus: the "⌕" glyph alone was too small to recognise on phones -->
					<svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
						<circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2" />
						<path
							d="M12.5 12.5 17 17M6 8.5h5M8.5 6v5"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg><span class="hidden sm:inline">{t('game.zoom')}</span>
				</button>
				{#if showZoom}
					<div
						class="popover absolute top-full left-0 z-20 mt-1 flex w-72 items-center gap-2"
						{@attach (node) => trapFocus(node, () => (showZoom = false))}
					>
						<input
							type="range"
							min="30"
							max="300"
							value={Math.round(zoom * 100)}
							oninput={(e) => setZoom(Number(e.currentTarget.value) / 100)}
							class="flex-1 accent-indigo-600"
							aria-label={t('game.zoom')}
						/>
						<button class="btn-sm" onclick={() => setZoom(1)} title={t('game.resetZoom')}
							>{zoom === 1 ? t('game.fit') : `${Math.round(zoom * 100)}%`}</button
						>
					</div>
				{/if}
			</div>
			<button
				class="btn"
				onclick={() => (showSettings = true)}
				aria-label={t('game.settings')}
				title={t('game.settings')}>⚙︎</button
			>
			{#if !settings.values.hideTimer}
				<span
					class="min-w-20 rounded-md bg-white px-3 py-1.5 text-center font-mono tabular-nums shadow-sm dark:bg-stone-800"
					aria-label={t('game.timer')}
				>
					<!-- Milliseconds only once solved: a running clock should not make anyone nervous -->
					{formatDuration(clock, session.solved)}
				</span>
				{#if settings.values.personalTimer && !session.solved}
					<button class="btn" onclick={() => session.setManualPause(!session.manualPause)}>
						{session.manualPause ? t('game.resume') : t('game.pause')}
					</button>
				{/if}
			{/if}
			<HoldButton
				label={t('game.undo')}
				action={() => session.undo()}
				disabled={session.past.length === 0 || session.readonly}>↶</HoldButton
			>
			<HoldButton
				label={t('game.redo')}
				action={() => session.redo()}
				disabled={session.future.length === 0 || session.readonly}>↷</HoldButton
			>
			<!-- Gone once solved, which also leaves room for the longer final time on phones. Below
			     360px the row has no room for it: it sits in the "more" menu there -->
			{#if session.canHint && !session.solved}
				<button
					class="btn max-[359px]:hidden max-sm:px-2"
					onclick={() => session.showHint()}
					disabled={session.readonly}
					aria-label={t('game.hint')}
					title={t('game.hintTitle')}
				>
					<!-- A light bulb -->
					<svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
						<path
							d="M10 2.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5h5c0-.6.2-1.1.7-1.5a5.5 5.5 0 0 0-3.2-10ZM8 16.5h4M8.8 18.5h2.4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg><span class="hidden sm:inline">{t('game.hint')}</span>
				</button>
			{/if}
			{#if showTools && toolsOnTop}
				<div
					class="hidden flex-wrap items-center gap-2 lg:flex"
					role="toolbar"
					aria-label={t('game.tools')}
				>
					{@render toolButtons(false)}
					{@render swatchRow()}
				</div>
			{/if}
			<!-- In the toolbar row, so a message never pushes the board down -->
			{#if session.message && wide}
				<p class="rounded-md px-3 py-1.5 text-sm {messageClass(session.message.kind)}">
					{session.message.text}
					{#if teaser}
						<button class="ml-1 font-semibold underline" onclick={() => session.showHint()}
							>{t('game.hintShow')}</button
						>
					{/if}
				</p>
			{/if}
			<!-- Always in the page: screen readers miss live regions added together with their text -->
			<p class="sr-only" role="status">{session.message?.text ?? ''}</p>
		</div>

		<div bind:this={toolbarEnd}></div>

		<div class="relative mt-3" bind:clientWidth={areaWidth}>
			<div
				bind:this={boardArea}
				class="overflow-x-auto py-1"
				role="presentation"
				onpointerdown={onpanstart}
			>
				{#if session.puzzle && session.state}
					<div
						class="relative mx-auto w-fit rounded-sm {session.paused ? 'invisible' : ''} {celebrate
							? 'solved-glow'
							: ''}"
					>
						<Board
							puzzle={session.puzzle}
							state={session.state}
							settings={settings.values}
							{tool}
							{toolOption}
							{cellSize}
							readonly={session.readonly}
							lastChange={session.lastChange}
							spotlight={hintSpotlight}
							area={hintArea}
							keys={keys.attach}
							ontool={showTools ? setTool : undefined}
							{celebrate}
							{touchMode}
							onmove={(next, changed) => session.move(next, changed)}
						/>
						{#if celebrate && theme.look === 'halloween'}
							<HalloweenBurst night={theme.night} />
						{:else if celebrate}
							<!-- Clipped to the board so the sparkles never resize the page -->
							<div
								class="solved-burst pointer-events-none absolute inset-0 overflow-hidden"
								aria-hidden="true"
							>
								<!-- Confetti raining down, sparkles bursting from the middle -->
								{#each Array.from({ length: 36 }, (_, i) => i) as i (i)}
									<i
										class="confetti"
										style:--x="{(i * 37) % 100}%"
										style:--c={CELEBRATION_COLOURS[i % CELEBRATION_COLOURS.length]}
										style:--d="{(i % 6) * 70}ms"
										style:--dx="{((i * 53) % 81) - 40}px"
										style:--turn="{((i * 97) % 5) + 1}turn"
										style:--r={i % 3 === 0 ? '50%' : '2px'}
									></i>
								{/each}
								{#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
									<span
										style:--a="{i * 30}deg"
										style:--d="{(i % 3) * 60}ms"
										style:--c={CELEBRATION_COLOURS[(i * 3) % CELEBRATION_COLOURS.length]}>✦</span
									>
								{/each}
							</div>
						{/if}
					</div>
				{:else if !session.loading}
					<!-- Creating the puzzle failed; the message says why -->
					<div class="grid min-h-48 place-items-center content-center gap-3 text-stone-500">
						<p>{t('game.notCreated')}</p>
						<button class="btn" onclick={() => session.retry()}>{t('game.retry')}</button>
					</div>
				{/if}
			</div>
			{#if session.message && toast && !wide}
				<div
					class="absolute inset-x-0 z-10 flex justify-center {session.hint
						? 'top-full mt-1'
						: 'top-2'}"
				>
					<div
						class="flex max-w-[90%] items-start gap-2 rounded-md px-3 py-1.5 text-sm shadow-lg {messageClass(
							session.message.kind
						)}"
					>
						<div class="grid justify-items-start gap-1">
							<button class="text-left" title={t('game.dismiss')} onclick={() => (toast = false)}
								>{session.message.text}</button
							>
							{#if teaser}
								<button class="font-semibold underline" onclick={() => session.showHint()}
									>{t('game.hintShow')}</button
								>
							{/if}
						</div>
						<button
							class="opacity-60"
							title={t('game.dismiss')}
							aria-label={t('game.dismiss')}
							onclick={() => (toast = false)}>✕</button
						>
					</div>
				</div>
			{/if}
			{#if session.loading}
				<div class="absolute inset-0 grid min-h-48 place-items-center text-stone-500">
					{t('game.creating')}
				</div>
			{:else if session.paused}
				<button
					class="absolute inset-0 grid place-items-center text-lg font-medium"
					onclick={() => session.setManualPause(false)}
				>
					{t('game.paused')}
				</button>
			{/if}
		</div>

		<div bind:offsetHeight={belowHeight}>
			{#if showTools}
				<!-- Wide screens: tools below the board, unless they sit in the sticky bar -->
				{#if !toolsOnTop}
					<div
						class="mt-3 hidden flex-wrap items-center gap-2 lg:flex"
						role="toolbar"
						aria-label={t('game.tools')}
					>
						{@render toolButtons(false)}
						{@render swatchRow()}
					</div>
				{/if}
				<!-- Phones: a fixed bar at the bottom, in reach of the thumb -->
				<div
					bind:offsetHeight={barHeight}
					class="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden dark:border-stone-800 dark:bg-stone-900/95"
				>
					{#if game.toolOptions && showSwatches}
						<div class="mb-1.5 flex justify-center">{@render swatchRow()}</div>
					{/if}
					<div class="mx-auto flex max-w-md gap-1" role="toolbar" aria-label={t('game.tools')}>
						{@render toolButtons(true)}
					</div>
				</div>
			{/if}

			{#if settings.values.showCheckpoints}
				<div
					class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3 lg:gap-x-2.5"
					role="group"
					aria-label={t('game.checkpoints')}
				>
					<button class="btn-sm" onclick={() => session.saveCheckpoint()} title="Ctrl+S"
						>{t('game.save')}</button
					>
					<button
						class="btn-sm"
						onclick={() => session.addCheckpoint()}
						disabled={session.checkpoints.length >= MAX_CHECKPOINTS}
						title="Ctrl+Shift+S">{t('game.add')}</button
					>
					{#each session.checkpoints as _, i (i)}
						<span class="relative">
							<button
								class="btn-sm min-w-9 {session.currentCheckpoint === i ? 'btn-active' : ''}"
								onclick={() => session.loadCheckpoint(i)}
								oncontextmenu={(e) => (e.preventDefault(), deleteCheckpoint(i))}
								title={t('game.loadCheckpoint', { n: i + 1 })}>{i + 1}</button
							>
							<!-- The badge stays small, the button around it is a 32 px target on phones -->
							<button
								class="group absolute -top-4 -right-4 grid size-8 place-items-center lg:-top-3 lg:-right-3 lg:size-6"
								aria-label={t('game.deleteCheckpoint', { n: i + 1 })}
								title={t('game.deleteCheckpoint', { n: i + 1 })}
								onclick={() => deleteCheckpoint(i)}
								><span
									class="grid size-5 place-items-center rounded-full bg-stone-300 text-xs leading-none group-hover:bg-rose-500 group-hover:text-white lg:size-4 lg:text-[10px] dark:bg-stone-600"
									aria-hidden="true">×</span
								></button
							>
						</span>
					{/each}
				</div>
			{/if}

			<p class="mt-4 text-xs text-stone-600 sm:text-sm dark:text-stone-400">
				{t('game.idLine', { variant: label })}:
				{#if session.puzzleId}
					<span class="font-mono select-all">{session.puzzleId.toLocaleString('en-US')}</span>
					{#if session.source === 'bank'}
						<span class="hidden text-stone-500 sm:inline">({t('game.fromBank')})</span>
					{/if}
				{:else}
					<span title={t('game.idHiddenTitle')}>{t('game.idHidden')}</span>
				{/if}
			</p>

			<!-- Most used first; on narrow screens the rare actions sit in a "more" menu -->
			{#snippet rareActions(menu: boolean)}
				{@const cls = menu ? 'menu-item' : 'btn hidden lg:inline-flex'}
				{#if menu && session.canHint && !session.solved}
					<button
						class="menu-item min-[360px]:hidden"
						onclick={() => ((moreOpen = false), session.showHint())}
						disabled={session.readonly}>{t('game.hint')}</button
					>
				{/if}
				<button
					class={cls}
					onclick={() => ((moreOpen = false), startOver())}
					disabled={session.loading}>{t('game.startOver')}</button
				>
				<button
					class={cls}
					onclick={() => ((moreOpen = false), makeShare())}
					disabled={session.loading || !session.puzzleId}>{t('game.share')}</button
				>
				<button class={cls} onclick={() => ((moreOpen = false), window.print())}
					>{t('game.print')}</button
				>
			{/snippet}
			<div class="mt-3 flex flex-wrap gap-2">
				<!-- Once solved, "New puzzle" takes over as the main action and "Share success" takes
				     the place of "Done", so the row keeps its size and the board does not move -->
				{#if !session.solved}
					<button
						class="btn btn-primary"
						onclick={() => session.submit()}
						disabled={session.loading}>{t('game.done')}</button
					>
				{/if}
				<button
					class="btn {session.solved ? 'btn-primary next-up' : ''}"
					onclick={newPuzzle}
					disabled={newBusy || session.loading}>{t('game.newPuzzle')}</button
				>
				{#if session.solved && session.puzzleId}
					<button class="btn" onclick={shareSolve}>{t('game.shareSolve')}</button>
				{/if}
				{@render rareActions(false)}
				<div class="relative lg:hidden">
					<button
						class="btn"
						onclick={() => (moreOpen = !moreOpen)}
						aria-expanded={moreOpen}
						aria-label={t('game.more')}
						title={t('game.more')}>⋯</button
					>
					{#if moreOpen}
						<button
							class="fixed inset-0 z-20 cursor-default"
							tabindex="-1"
							aria-hidden="true"
							onclick={() => (moreOpen = false)}
						></button>
						<div
							class="popover absolute right-0 bottom-full z-30 mb-1 flex w-48 flex-col p-1"
							role="group"
							aria-label={t('game.more')}
							{@attach (node) => trapFocus(node, () => (moreOpen = false))}
						>
							{@render rareActions(true)}
						</div>
					{/if}
				</div>
			</div>
		</div>

		{#if share}
			<div class="panel mt-3 text-sm">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 space-y-2">
						<p>
							{t('game.shareLink')}
							<a class="link break-all" href={share.link}>{share.link}</a>
						</p>
						{#if share.image}
							<p>
								<a class="link" href={share.image} download="{game.id}-{session.puzzleId}.png"
									>{t('game.screenshot')}</a
								>
							</p>
						{/if}
					</div>
					<button class="btn-icon" aria-label={t('game.closeShare')} onclick={() => (share = null)}
						>✕</button
					>
				</div>
			</div>
		{/if}
	</section>
</div>

<!-- Printed: the empty puzzle only, in the light colours -->
{#if session.puzzle && session.state}
	<div class="print-only board-light">
		<p class="mb-2 text-sm">
			{game.name} · {label}{session.puzzleId ? ` · ${t('game.puzzleId')} ${session.puzzleId}` : ''}
		</p>
		<Board
			puzzle={session.puzzle}
			state={session.state}
			settings={settings.values}
			{tool}
			{toolOption}
			cellSize={Math.min(40, Math.floor(640 / (session.puzzle.width + 1)))}
			readonly={true}
			lastChange={new Set()}
			blank={true}
			{touchMode}
			onmove={() => {}}
		/>
	</div>
{/if}

<ShortcutsDialog bind:open={showShortcuts} {game} tools={showTools} hint={session.canHint} />

<SettingsDialog
	bind:open={showSettings}
	{settings}
	touchMode={isTouch && showTools ? touchMode : undefined}
	ontouchmode={setTouchMode}
/>
