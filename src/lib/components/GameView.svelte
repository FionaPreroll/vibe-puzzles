<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto, replaceState } from '$app/navigation';
	import { ask } from '../client/confirm.svelte';
	import { isTyping, KeyDispatcher } from '../client/keys';
	import { GameSession } from '../client/session.svelte';
	import { message } from '../client/session/messages';
	import { cleanupSpecialSaves } from '../client/session/saves';
	import {
		GameSettings,
		loadLayout,
		loadTouchMode,
		saveLayout,
		saveTouchMode
	} from '../client/settings.svelte';
	import { load, save } from '../client/storage';
	import { boardZoomKey, KEY } from '../client/storageKeys';
	import type { PageLayout, TouchMode } from '../core/types';
	import { parsePlayableId } from '../core/variants';
	import type { AnyGame } from '../games';
	import { t, variantLabel } from '../i18n/index.svelte';
	import { BoardFit } from './game/boardFit.svelte';
	import { CelebrationTimer } from './game/celebration.svelte';
	import { clampZoom, storedZoom, zoomedCellSize } from './game/boardFit';
	import { pushSettingsSoon, watchPage } from './game/lifecycle';
	import { question } from './game/questions';
	import { Sharing } from './game/sharing.svelte';
	import { findShortcut, type ShortcutAction } from './game/shortcuts';
	import { firstVisitTutorial, freeSpaceWhenFull, openFromAddress } from './game/startup';
	import { ToolState } from './game/tools.svelte';
	import BelowBoard from './game/BelowBoard.svelte';
	import BoardStage from './game/BoardStage.svelte';
	import BragDialog from './game/BragDialog.svelte';
	import PrintBoard from './game/PrintBoard.svelte';
	import SidePanel from './game/SidePanel.svelte';
	import TopBar from './game/TopBar.svelte';
	import WidePanel from './game/WidePanel.svelte';
	import SettingsDialog from './SettingsDialog.svelte';
	import ShortcutsDialog from './ShortcutsDialog.svelte';

	/**
	 * The game page. It holds the game's session, settings, tools and the measured layout, and
	 * composes the parts in `game/`: components that draw, and modules that do the work which can be
	 * tested on its own.
	 */
	let { game }: { game: AnyGame } = $props();

	const settings = untrack(() => new GameSettings(game.id, game.settings));
	const session = untrack(() => new GameSession(game, settings));
	const isTouch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
	const tools = untrack(() => new ToolState(game, isTouch));
	const fit = new BoardFit();
	fit.pageLayout = loadLayout();
	const sharing = untrack(() => new Sharing(game, session));
	/** The one keyboard listener: the board gets each key first, then the page's shortcuts. */
	const keys = new KeyDispatcher(shortcuts);

	let touchMode = $state<TouchMode>(loadTouchMode());
	let showSettings = $state(false);
	let showShortcuts = $state(false);
	/** Phone layout: the side panel opens as a drawer. */
	let menuOpen = $state(false);
	let zoomOpen = $state(false);
	/** The widescreen panel is folded into a strip. */
	let panelCollapsed = $state(load<boolean>(KEY.panelCollapsed, false));
	let now = $state(Date.now());
	let newBusy = $state(false);
	const celebrate = new CelebrationTimer();

	const variant = $derived(session.variant);
	/** The special puzzle on the board is from a period that is over: a new one is out. */
	const newPeriod = $derived(session.periodOver(now));
	// Said once per game on the board, when it happens (e.g. at midnight UTC for the daily).
	let periodNoted = '';
	$effect(() => {
		const kind = newPeriod;
		if (!kind) return;
		untrack(() => {
			if (periodNoted === session.slot) return;
			periodNoted = session.slot;
			session.message = message('info', () => t(`game.newPeriod.${kind}`));
		});
	});
	const label = $derived(variantLabel(variant));
	const showTools = $derived(!settings.values.hideControls);
	const clock = $derived(
		settings.values.personalTimer ? session.personal(now) : session.elapsed(now)
	);
	const zoomKey = $derived(boardZoomKey(game.id, variant.key));
	/** Zoom relative to the automatic size (1 = fit the screen). */
	let zoom = $derived(storedZoom(load<unknown>(zoomKey, 1)));
	const fitCell = $derived(
		fit.fitCell(session.puzzle, game.padRows, settings.values.showCoordinates)
	);
	const cellSize = $derived(zoomedCellSize(fitCell, zoom));

	function setZoom(z: number) {
		zoom = clampZoom(z);
		save(zoomKey, zoom);
	}

	function setTouchMode(mode: TouchMode) {
		touchMode = mode;
		saveTouchMode(mode);
	}

	function setLayout(layout: PageLayout) {
		fit.pageLayout = layout;
		saveLayout(layout);
	}

	// ---- Actions -------------------------------------------------------------------------------

	function variantUrl(key: string) {
		return `${resolve('/[game]', { game: game.id })}?${new URLSearchParams({ v: key })}`;
	}

	async function openVariant(key: string, puzzleId?: number) {
		sharing.board = null;
		menuOpen = false;
		await session.open(key, { puzzleId });
		replaceState(variantUrl(session.variant.key), {});
	}

	async function newPuzzle() {
		if (newBusy) return;
		newBusy = true;
		try {
			if (session.newPuzzleDiscards && !(await ask(question('newPuzzle', true)))) return;
			sharing.board = null;
			const before = session.variant.key;
			await session.newPuzzle();
			// A special type continues with a regular one.
			if (session.variant.key !== before) replaceState(variantUrl(session.variant.key), {});
		} finally {
			newBusy = false;
		}
	}

	/** Open the puzzle with the ID typed in the side panel; true once it opens. */
	async function openById(text: string): Promise<boolean> {
		const digits = text.replace(/[^0-9]/g, '');
		if (!digits) return false;
		const id = parsePlayableId(digits, game.variants);
		if (!id) {
			session.message = message('error', () => t('game.unknownId'));
			return false;
		}
		if (session.replacesGame(variant.key, { puzzleId: id })) {
			if (!(await ask(question('replace', true)))) return false;
		}
		openVariant(variant.key, id);
		return true;
	}

	/** The board itself, not a decoration around it. */
	const boardSvg = () => fit.boardArea?.querySelector<SVGSVGElement>('svg[role="grid"]');

	async function startOver() {
		if (await ask(question('startOver', true))) session.startOver();
	}

	// ---- Keyboard shortcuts --------------------------------------------------------------------

	const actions: Record<ShortcutAction, () => void> = {
		undo: () => session.undo(),
		redo: () => session.redo(),
		done: () => session.submit(),
		newPuzzle,
		hint: () => session.showHint(),
		save: () => session.saveCheckpoint(),
		add: () => session.addCheckpoint(),
		trial: () => (session.trial ? session.keepTrial() : session.startTrial()),
		trialDrop: () => session.dropTrial(),
		colourTool: () => tools.toggleColour(),
		escape: () => {},
		help: () => (showShortcuts = true)
	};

	/** The page's shortcuts (`game/shortcuts.ts`) and the tool keys, for keys the board leaves. */
	function shortcuts(e: KeyboardEvent) {
		// Before the input check: the zoom slider has focus while its popover is open.
		if (e.key === 'Escape' && zoomOpen) return void (zoomOpen = false);
		if (isTyping(e) || document.querySelector('dialog[open]')) return;
		if (e.key === 'Escape' && menuOpen) return void (menuOpen = false);
		const found = findShortcut(e, {
			hint: session.canHint,
			colourTool: !!game.toolOptions && showTools
		});
		if (found) {
			if (found.preventDefault) e.preventDefault();
			return actions[found.action]();
		}
		if (!e.ctrlKey && !e.metaKey && !e.altKey && showTools) tools.key(e.key);
	}

	// ---- Lifecycle ----------------------------------------------------------------------------

	onMount(() => {
		cleanupSpecialSaves();
		freeSpaceWhenFull(session, () => ask(question('storageFull', true)));
		const params = new URL(location.href).searchParams;
		if (firstVisitTutorial(game.id, !!game.tutorial, params)) {
			goto(resolve('/[game]/tutorial', { game: game.id }), { replaceState: true });
			return;
		}
		openFromAddress(session, game.variants, params, () => ask(question('replace', true))).then(
			(leave) => {
				if (leave) replaceState(variantUrl(session.variant.key), {});
			}
		);

		const stopLayout = fit.observe((wide) => wide && (menuOpen = false));
		const tick = setInterval(() => (now = Date.now()), 500);
		const stopWatching = watchPage(session, settings);
		return () => {
			stopWatching();
			clearInterval(tick);
			stopLayout();
		};
	});

	// Widescreen takes the screen's full width (`layout.css`).
	$effect(() => {
		document.body.classList.toggle('widescreen', fit.widescreen);
		return () => document.body.classList.remove('widescreen');
	});

	// Re-measure when anything around the board changes size.
	$effect(() => {
		void fit.layout;
		fit.measure();
	});

	// Push setting changes for other devices; without a connection they wait in the outbox.
	$effect(() => {
		JSON.stringify(settings.values);
		return pushSettingsSoon(settings);
	});

	// The short celebration when the puzzle gets solved.
	$effect(() => celebrate.follow(session.solved, session.loading, settings.values.solvedAnimation));

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
	bind:innerHeight={fit.viewportHeight}
/>

<svelte:head>
	<!-- The prerendered page cannot know which puzzle a link opens (link previews in messengers
	     show this title), so the puzzle type joins the title once a puzzle is loaded. -->
	<title>{session.puzzle ? `${game.name} · ${label}` : game.name} · {t('app.name')}</title>
</svelte:head>

{#snippet boardStage()}
	<BoardStage
		{game}
		{session}
		settings={settings.values}
		{fit}
		{tools}
		{cellSize}
		{zoom}
		onzoom={setZoom}
		{touchMode}
		celebrate={celebrate.on}
		{showTools}
		keys={keys.attach}
	/>
{/snippet}

{#if fit.widescreen}
	{@const side = fit.pageLayout === 'left' ? 'left' : 'right'}
	{#snippet panel()}
		<WidePanel
			{game}
			{variant}
			{label}
			{session}
			settings={settings.values}
			{clock}
			{isTouch}
			{side}
			maxHeight={fit.panelHeight}
			{zoom}
			{tools}
			{showTools}
			shared={sharing.solveShared}
			{newPeriod}
			{newBusy}
			share={sharing.board}
			bind:collapsed={panelCollapsed}
			bind:zoomOpen
			oncollapse={() => save(KEY.panelCollapsed, panelCollapsed)}
			onzoom={setZoom}
			onsettings={() => (showSettings = true)}
			onshortcuts={() => (showShortcuts = true)}
			onpick={(key) => openVariant(key)}
			onopenid={openById}
			onnew={newPuzzle}
			onsharesolve={() => sharing.shareSolve(label, clock)}
			onshare={() => sharing.shareBoard(boardSvg())}
			onstartover={startOver}
			oncloseshare={() => (sharing.board = null)}
		/>
	{/snippet}
	<!-- Widescreen: the board alone in its column, the panel beside it on the side picked -->
	<div bind:this={fit.pageRoot} class="screen-only flex items-start gap-6">
		{#if side === 'left'}{@render panel()}{/if}
		<section bind:this={fit.gameColumn} class="min-w-0 flex-1">
			{@render boardStage()}
		</section>
		{#if side === 'right'}{@render panel()}{/if}
	</div>
{:else}
	<div bind:this={fit.pageRoot} class="screen-only flex flex-col gap-6 lg:flex-row lg:items-start">
		<SidePanel
			{game}
			{variant}
			{isTouch}
			wide={fit.wide}
			bind:open={menuOpen}
			onpick={(key) => openVariant(key)}
			onopenid={openById}
			onshortcuts={() => (showShortcuts = true)}
		/>

		<section bind:this={fit.gameColumn} class="min-w-0 flex-1">
			<TopBar
				{game}
				{label}
				{session}
				settings={settings.values}
				{clock}
				wide={fit.wide}
				{isTouch}
				stageWidth={fit.stageWidth}
				{zoom}
				{menuOpen}
				bind:height={fit.toolbarHeight}
				bind:zoomOpen
				onzoom={setZoom}
				onmenu={() => (menuOpen = true)}
				onsettings={() => (showSettings = true)}
				onshortcuts={() => (showShortcuts = true)}
			/>

			{@render boardStage()}

			<BelowBoard
				{game}
				{session}
				settings={settings.values}
				{fit}
				{tools}
				{showTools}
				shared={sharing.solveShared}
				{newPeriod}
				{newBusy}
				share={sharing.board}
				onnew={newPuzzle}
				onsharesolve={() => sharing.shareSolve(label, clock)}
				onshare={() => sharing.shareBoard(boardSvg())}
				onstartover={startOver}
				oncloseshare={() => (sharing.board = null)}
			/>
		</section>
	</div>
{/if}

<PrintBoard
	{game}
	{session}
	settings={settings.values}
	{label}
	tool={tools.tool}
	toolOption={tools.option}
	{touchMode}
/>

<ShortcutsDialog bind:open={showShortcuts} {game} tools={showTools} hint={session.canHint} />
<BragDialog bind:text={sharing.manualText} oncopied={() => sharing.copied()} />
<SettingsDialog
	bind:open={showSettings}
	{settings}
	mode={variant.mode}
	touchMode={isTouch && showTools ? touchMode : undefined}
	ontouchmode={setTouchMode}
	layout={fit.wide ? fit.pageLayout : undefined}
	onlayout={setLayout}
/>
