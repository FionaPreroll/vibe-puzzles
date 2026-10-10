<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto, replaceState } from '$app/navigation';
	import { currentPlayer, onSync, pullSave, pushSave, watchServer } from '../client/api';
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
	import { decodePuzzleId, parsePuzzleId } from '../core/variants';
	import { CELEBRATION_COLOURS } from '../core/grid';
	import { lightColours } from '../core/palette';
	import type { TouchMode } from '../core/types';
	import type { AnyGame } from '../games';
	import { t, tList, toolHint, toolLabel, variantLabel } from '../i18n/index.svelte';
	import HalloweenBat from './halloween/Bat.svelte';
	import HalloweenBurst from './halloween/Burst.svelte';
	import HalloweenCandle from './halloween/Candle.svelte';
	import HalloweenCandyCorn from './halloween/CandyCorn.svelte';
	import HalloweenCobweb from './halloween/Cobweb.svelte';
	import HalloweenPumpkin from './halloween/Pumpkin.svelte';
	import HalloweenSpider from './halloween/Spider.svelte';
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
	/** Height of the play bar, ID line and buttons below the board. */
	let belowHeight = $state(0);
	/** Page offset of the board's top edge, without the board's own surface around it. */
	let boardTop = $state(200);
	/** Width of the board with its surface: the rows above and below it are no wider. */
	let stageWidth = $state(0);
	/** Padding of the board's surface (p-2, lg:p-3), which the board's size leaves room for. */
	const stagePad = $derived(wide ? 12 : 8);
	/** Everything on the page below the board area: tools, buttons, paddings and the footer. */
	let afterBoard = $state(120);
	let pageRoot: HTMLDivElement | undefined = $state();
	/** Height of the phones' fixed tool bar (0 where it is hidden). */
	let barHeight = $state(0);
	let gameColumn: HTMLElement | undefined = $state();

	function measure() {
		if (!boardArea || !pageRoot || !gameColumn) return;
		// The scroll container's py-1 sits above the board's surface.
		boardTop = boardArea.getBoundingClientRect().top + window.scrollY + 4;
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
		const chrome = boardTop + 4 + afterBoard + 2 * stagePad;
		const byWidth = (areaWidth - 2 * stagePad) / (p.width + margin);
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
		const digits = idInput.replace(/[^0-9]/g, '');
		if (!digits) return;
		const id = parsePuzzleId(digits, game.variants.length);
		if (!id) {
			session.message = { kind: 'error', text: t('game.unknownId') };
			return;
		}
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
		// The board itself, not a decoration around it.
		const svg = boardArea?.querySelector<SVGSVGElement>('svg[role="grid"]');
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
		const id = parsePuzzleId(params.get('id'), game.variants.length);
		const start = async () => {
			let variantKey = params.get('v') ?? game.variants[0].key;
			let opts: OpenOptions = { puzzleId: id, shared: params.get('s') ?? undefined };
			// A link must not silently take the place of an unfinished game of its type.
			if (id && session.replacesGame(variantKey, opts) && !(await askReplace())) {
				variantKey = game.variants[decodePuzzleId(id).variantIndex]?.key ?? variantKey;
				opts = {};
			}
			await session.open(variantKey, opts);
			if (params.has('id') && !id && !session.message) {
				session.message = { kind: 'error', text: t('game.unknownId') };
			}
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

		const pullSettings = async () => {
			const remote = await pullSave<StoredSettings>(settingsKey(game.id));
			if (remote) settings.merge(remote.data);
		};
		// The server can also answer only later, e.g. when the device was offline at the start.
		let answered = false;
		const stopWatching = watchServer(async (ok) => {
			if (answered && ok === hasServer) return;
			const back = answered && ok;
			answered = true;
			hasServer = ok;
			if (!ok || !currentPlayer()) return;
			if (back) session.refreshFromServer();
			await pullSettings();
		});
		// "Sync now", also in offline mode.
		const stopSync = onSync(() => Promise.all([session.refreshFromServer(), pullSettings()]));

		return () => {
			stopWatching();
			stopSync();
			clearInterval(tick);
			media.removeEventListener('change', layout);
			document.removeEventListener('visibilitychange', visibility);
			window.removeEventListener('focus', activity);
			window.removeEventListener('blur', activity);
			window.removeEventListener('pagehide', pagehide);
			session.flush();
		};
	});

	// Push setting changes for other devices; without a connection they wait in the outbox.
	$effect(() => {
		JSON.stringify(settings.values);
		if (!currentPlayer() || !settings.updatedAt) return;
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
	/** Halloween: room beside the board for decorations, which must not make the page scroll. */
	const decorBeside = $derived(wide && areaWidth - stageWidth >= 2 * 96);
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

{#snippet toolButtons()}
	{#each game.tools as tl (tl.id)}
		{@const name = toolLabel(game.id, tl)}
		{@const hint = toolHint(game.id, tl.id)}
		{@const swatch =
			game.toolOptions?.tool === tl.id
				? game.toolOptions.values.find((o) => o.value === toolOption)?.color
				: undefined}
		<button
			class="play-btn {tool === tl.id ? 'play-btn-active' : ''}"
			aria-pressed={tool === tl.id}
			title="{name} ({tl.key}){hint ? `: ${hint}` : ''}"
			onclick={() => {
				if (game.toolOptions?.tool === tl.id && tool === tl.id) showSwatches = !showSwatches;
				else if (game.toolOptions?.tool === tl.id && !wide) showSwatches = true;
				setTool(tl.id);
			}}
		>
			{#if swatch}
				<span class="size-5 rounded-full border border-stone-400" style:background={swatch}></span>
			{:else}
				<span class="text-lg leading-5" aria-hidden="true">{tl.icon}</span>
			{/if}
			{name}
		</button>
	{/each}
{/snippet}

<!-- Undo, redo, the tools and the hint: below the board on wide screens, at the bottom on phones -->
{#snippet playButtons()}
	<HoldButton
		class="play-btn"
		named={false}
		label="{t('game.undo')} (Z)"
		action={() => session.undo()}
		disabled={session.past.length === 0 || session.readonly}
	>
		<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
			<path
				d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>{t('game.undoShort')}
	</HoldButton>
	<HoldButton
		class="play-btn"
		named={false}
		label="{t('game.redo')} (X)"
		action={() => session.redo()}
		disabled={session.future.length === 0 || session.readonly}
	>
		<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
			<path
				d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>{t('game.redoShort')}
	</HoldButton>
	{#if showTools}
		<span class="play-sep" aria-hidden="true"></span>
		<div class="flex flex-[999] lg:gap-0.5" role="toolbar" aria-label={t('game.tools')}>
			{@render toolButtons()}
		</div>
	{/if}
	{#if session.canHint}
		<span class="play-sep" aria-hidden="true"></span>
		<!-- Stays once solved, greyed out, so nothing around it moves -->
		<button
			class="play-btn"
			onclick={() => session.showHint()}
			disabled={session.readonly || session.solved}
			title={t('game.hintTitle')}
		>
			<svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
				<path
					d="M10 2.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5h5c0-.6.2-1.1.7-1.5a5.5 5.5 0 0 0-3.2-10ZM8 16.5h4M8.8 18.5h2.4"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>{t('game.hint')}
		</button>
	{/if}
{/snippet}

<!-- Halloween: cobwebs on the board's surface; beside it, where there is room, a spider, a bat,
     a jack-o'-lantern and a candle. None of it takes a click. -->
{#snippet stageDecor()}
	<div class="halloween-only pointer-events-none" aria-hidden="true">
		<HalloweenCobweb class="absolute top-0 right-0 w-14 lg:w-16" />
		<HalloweenCobweb class="absolute bottom-0 left-0 w-10 rotate-180 lg:w-12" />
		{#if decorBeside}
			<HalloweenSpider class="absolute top-0 right-full mr-8 w-8" />
			<HalloweenBat
				eyes
				class="halloween-bob absolute top-10 left-full ml-8 w-16 text-[#7c3aed] dark:text-[#8b5cf6]"
			/>
			<div class="absolute right-full bottom-0 mr-6 flex items-end gap-1">
				<HalloweenCandyCorn class="w-4" />
				<HalloweenPumpkin face="night" class="w-16" />
			</div>
			<div class="absolute bottom-0 left-full ml-8 flex items-end gap-2">
				<HalloweenCandle class="w-5" />
				<HalloweenCandle class="w-3.5" />
			</div>
		{/if}
	</div>
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
		<!-- The top bar: on phones the game and its type (opening the drawer), then the clock, the
		     message on wide screens, and zoom, settings and shortcuts as icons -->
		<div
			bind:offsetHeight={toolbarHeight}
			class="stage-column flex min-h-11 items-center gap-1 {settings.values.stickyToolbar
				? 'sticky top-0 z-10 bg-stone-50/95 py-1 backdrop-blur dark:bg-stone-950/95'
				: ''}"
			style:--stage="{stageWidth}px"
		>
			<button
				class="-ml-1 flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-stone-100 lg:hidden dark:hover:bg-stone-800"
				onclick={() => (menuOpen = true)}
				aria-label={t('game.openMenu')}
				aria-expanded={menuOpen}
			>
				<svg viewBox="0 0 24 24" class="size-5 shrink-0 text-stone-500" aria-hidden="true">
					<path
						d="M4 6h16M4 12h16M4 18h16"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
				<span class="min-w-0 leading-tight">
					<span class="block truncate font-semibold"
						><span aria-hidden="true">{game.icon}</span> {game.name}</span
					>
					<span class="block truncate text-xs text-stone-500 dark:text-stone-400">{label}</span>
				</span>
			</button>
			<span class="flex-1 lg:hidden"></span>
			{#if !settings.values.hideTimer}
				<span
					class="shrink-0 px-1 font-mono text-lg text-stone-700 tabular-nums dark:text-stone-200"
					aria-label={t('game.timer')}
				>
					<!-- Milliseconds only once solved: a running clock should not make anyone nervous -->
					{formatDuration(clock, session.solved)}
				</span>
				{#if settings.values.personalTimer && !session.solved}
					<button class="btn-sm" onclick={() => session.setManualPause(!session.manualPause)}>
						{session.manualPause ? t('game.resume') : t('game.pause')}
					</button>
				{/if}
			{/if}
			<!-- In the top bar on wide screens, so a message never pushes the board down -->
			{#if session.message && wide}
				<p class="ml-2 min-w-0 rounded-full px-3 py-1 text-sm {messageClass(session.message.kind)}">
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
			<span class="hidden flex-1 lg:block"></span>
			<div class="relative -mr-1.5" bind:this={zoomBox}>
				<button
					class="btn-icon size-11 lg:size-10"
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
					</svg>
				</button>
				{#if showZoom}
					<div
						class="popover absolute top-full right-0 z-20 mt-1 flex w-72 items-center gap-2"
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
				class="btn-icon size-11 lg:size-10"
				onclick={() => (showSettings = true)}
				aria-label={t('game.settings')}
				title={t('game.settings')}
			>
				<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
					<!-- A cog: teeth from a dashed ring, a ring and a hole -->
					<g fill="none" stroke="currentColor">
						<circle cx="12" cy="12" r="8.6" stroke-width="3.2" stroke-dasharray="3.38 3.38" />
						<circle cx="12" cy="12" r="6" stroke-width="2" />
						<circle cx="12" cy="12" r="2" stroke-width="2" />
					</g>
				</svg>
			</button>
			{#if !isTouch}
				<button
					class="btn-icon hidden size-10 lg:inline-flex"
					onclick={() => (showShortcuts = true)}
					aria-label={t('shortcuts.title')}
					title={t('shortcuts.open')}
				>
					<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
						<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
							<rect x="2.5" y="6" width="19" height="12" rx="2" />
							<path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9" />
						</g>
					</svg>
				</button>
			{/if}
		</div>

		<!-- Room around the board on phones, so a quick swipe does not hit a button -->
		<div class="relative mt-5 lg:mt-4" bind:clientWidth={areaWidth}>
			<div
				bind:this={boardArea}
				class="overflow-x-auto py-1"
				role="presentation"
				onpointerdown={onpanstart}
			>
				{#if session.puzzle && session.state}
					<div class="board-stage" bind:offsetWidth={stageWidth}>
						{@render stageDecor()}
						<div
							class="relative z-10 w-fit rounded-sm {session.paused ? 'invisible' : ''} {celebrate
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

		<div bind:offsetHeight={belowHeight} class="stage-column" style:--stage="{stageWidth}px">
			<!-- Wide screens: the play bar right below the board, no wider than it needs -->
			<div class="mt-4 hidden flex-col items-center gap-2 lg:flex">
				<div class="play-bar flex w-max">{@render playButtons()}</div>
				{@render swatchRow()}
			</div>
			<!-- Phones: the play bar fixed at the bottom, in reach of the thumb -->
			<div
				bind:offsetHeight={barHeight}
				class="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden dark:border-stone-800 dark:bg-stone-900/95"
			>
				{#if game.toolOptions && showSwatches}
					<div class="mb-1.5 flex justify-center">{@render swatchRow()}</div>
				{/if}
				<div class="mx-auto flex max-w-md items-center">{@render playButtons()}</div>
			</div>

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

			<!-- The puzzle's ID, then at most three buttons: one stands out only when it is the way
			     on ("Done" without automatic submitting, "Share success" once solved) -->
			<div
				class="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-3 lg:mt-4 lg:justify-between"
			>
				<p
					class="w-full text-center text-xs text-stone-500 lg:w-auto lg:text-left lg:text-sm dark:text-stone-400"
				>
					{t('game.puzzleId')}:
					{#if session.puzzleId}
						<span class="font-mono select-all">{session.puzzleId.toLocaleString('en-US')}</span>
						{#if session.source === 'bank'}
							<span class="hidden text-stone-400 sm:inline">({t('game.fromBank')})</span>
						{/if}
					{:else}
						<span title={t('game.idHiddenTitle')}>{t('game.idHidden')}</span>
					{/if}
				</p>
				<div class="flex flex-wrap items-end justify-center gap-2">
					<!-- Halloween on phones: a jack-o'-lantern and candles beside the buttons -->
					<HalloweenPumpkin face="night" class="halloween-only mr-2 w-10 lg:hidden" />
					{#if !session.solved && !settings.values.autoSubmit}
						<button
							class="btn btn-primary max-lg:min-h-11"
							onclick={() => session.submit()}
							disabled={session.loading}>{t('game.done')}</button
						>
					{/if}
					{#if session.solved && session.puzzleId}
						<button class="btn btn-primary next-up max-lg:min-h-11" onclick={shareSolve}
							>{t('game.shareSolve')}</button
						>
					{/if}
					<button
						class="btn max-lg:min-h-11"
						onclick={newPuzzle}
						disabled={newBusy || session.loading}>{t('game.newPuzzle')}</button
					>
					<div class="relative">
						<button
							class="btn max-lg:min-h-11"
							onclick={() => (moreOpen = !moreOpen)}
							aria-expanded={moreOpen}
							aria-label={t('game.more')}
							title={t('game.more')}
						>
							<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
								<circle cx="5" cy="12" r="1.8" />
								<circle cx="12" cy="12" r="1.8" />
								<circle cx="19" cy="12" r="1.8" />
							</svg>
						</button>
						{#if moreOpen}
							<button
								class="fixed inset-0 z-20 cursor-default"
								tabindex="-1"
								aria-hidden="true"
								onclick={() => (moreOpen = false)}
							></button>
							<div
								class="popover absolute right-0 bottom-full z-30 mb-1 flex w-56 flex-col p-1"
								role="group"
								aria-label={t('game.more')}
								{@attach (node) => trapFocus(node, () => (moreOpen = false))}
							>
								<button
									class="menu-item"
									onclick={() => ((moreOpen = false), makeShare())}
									disabled={session.loading || !session.puzzleId}>{t('game.share')}</button
								>
								<button class="menu-item" onclick={() => ((moreOpen = false), window.print())}
									>{t('game.print')}</button
								>
								<hr class="mx-2 my-1 border-stone-200 dark:border-stone-700" />
								<button
									class="menu-item text-rose-700 dark:text-rose-400"
									onclick={() => ((moreOpen = false), startOver())}
									disabled={session.loading}>{t('game.startOver')}</button
								>
							</div>
						{/if}
					</div>
					<span class="halloween-only ml-2 flex items-end gap-1.5 lg:hidden" aria-hidden="true">
						<HalloweenCandle class="w-4" />
						<HalloweenCandle class="w-3" />
					</span>
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
						<button
							class="btn-icon"
							aria-label={t('game.closeShare')}
							onclick={() => (share = null)}>✕</button
						>
					</div>
				</div>
			{/if}
		</div>
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
