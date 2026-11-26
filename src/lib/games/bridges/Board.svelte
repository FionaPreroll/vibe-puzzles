<script lang="ts">
	import { boardPad, CELEBRATION_COLOURS, coordinateLabels, labelFontSize } from '../../core/grid';
	import { colours } from '../../core/palette';
	import type { BoardProps, KeyPress } from '../../core/types';
	import { boardInput, interpolate, touchAction, type BoardPoint } from '../../client/boardInput';
	import { KeyCursor } from '../../client/keyCursor.svelte';
	import BoardSpeech from '../../components/game/BoardSpeech.svelte';
	import Spotlight, { spotlightWidth } from '../../components/game/Spotlight.svelte';
	import { t } from '../../i18n/index.svelte';
	import type { BridgesSettingKey } from './settings';
	import { sayCell } from './speech';
	import { linkAt, linkBetween, nextValue, setLinks } from './input';
	import { groupRings, joinedTo } from './draw';
	import {
		analyze,
		bridgesOf,
		CROSS,
		graphOf,
		linkKey,
		type BridgesPuzzle,
		type BridgesState
	} from './rules';

	let {
		puzzle,
		state: board,
		settings,
		tool,
		cellSize,
		readonly,
		lastChange,
		blank = false,
		keys,
		celebrate = false,
		touchMode,
		onmove,
		spotlight,
		mistake,
		area,
		trial
	}: BoardProps<BridgesPuzzle, BridgesState, BridgesSettingKey> = $props();

	const w = $derived(puzzle.width);
	const h = $derived(puzzle.height);
	const g = $derived(graphOf(puzzle));
	const pad = $derived(boardPad(cellSize, settings.showCoordinates && !blank, 3));
	const width = $derived(w * cellSize + 2 * pad);
	const height = $derived(h * cellSize + 2 * pad);
	const errorColour = $derived(settings.blueErrors ? colours.blueError : colours.error);
	const errorFill = $derived(settings.blueErrors ? colours.blueErrorFill : colours.errorFill);

	/**
	 * A move under way, from the pointer or the keys: the links it went along from cell to cell,
	 * all set as the first one decides (`value`). A click without a drag sets the link under the
	 * point where it began (`at`).
	 */
	type Pending = {
		inverse: boolean;
		at: BoardPoint | null;
		/** The cell the move is in. */
		last: number;
		links: number[];
		value: number | null;
	};
	let pending = $state.raw<Pending | null>(null);

	/** `s` with a move applied, and the links it changes. */
	function applyPending(s: BridgesState, p: Pending): { state: BridgesState; changed: number[] } {
		let { links, value } = p;
		if (!links.length) {
			const link = p.at ? linkAt(g, s.links, p.at.x, p.at.y) : -1;
			if (link < 0) return { state: s, changed: [] };
			links = [link];
			value = nextValue(tool, s.links[link], p.inverse);
		}
		const { values, changed } = setLinks(g, s.links, links, value!);
		return { state: changed.length ? { links: values } : s, changed };
	}

	/** The board with the move under way applied, as a preview; no bridges for printing. */
	const shown = $derived.by((): BridgesState => {
		if (blank) return { links: board.links.map(() => 0) };
		return pending?.links.length ? applyPending(board, pending).state : board;
	});
	const a = $derived(analyze(puzzle, shown));

	// ---- Moves --------------------------------------------------------------------------------

	function cellAt(x: number, y: number): number {
		const c = Math.min(w - 1, Math.max(0, Math.floor(x)));
		const r = Math.min(h - 1, Math.max(0, Math.floor(y)));
		return r * w + c;
	}

	function begin(cell: number, inverse: boolean, at: BoardPoint | null) {
		if (readonly) return;
		pending = { inverse, at, last: cell, links: [], value: null };
	}

	/** The move went on into cell `to`: the link along the way joins it. */
	function extend(to: number) {
		const p = pending;
		if (!p || to === p.last) return;
		const link = linkBetween(g, p.last, to);
		if (link < 0 || p.links.includes(link)) {
			pending = { ...p, last: to };
			return;
		}
		const value = p.value ?? nextValue(tool, board.links[link], p.inverse);
		pending = { ...p, last: to, links: [...p.links, link], value };
	}

	function commit() {
		const p = pending;
		pending = null;
		if (!p) return;
		const { state, changed } = applyPending(board, p);
		if (changed.length) onmove(state, changed.map(linkKey));
	}

	// ---- Pointer: click or drag from island to island adds a bridge, right click a cross -------

	const input = boardInput(
		{
			start(p, how) {
				if (!how.touch) keyCursor.hide();
				begin(cellAt(p.x, p.y), how.inverse, p);
			},
			drag(to, from) {
				if (!pending) return;
				for (const p of interpolate(from, to, 4)) {
					if (p.x >= 0 && p.y >= 0 && p.x < w && p.y < h) extend(cellAt(p.x, p.y));
				}
			},
			end: commit,
			cancel: () => (pending = null),
			// A finger resting on a link crosses it, as the right button does.
			hold(p) {
				if (readonly || linkAt(g, board.links, p.x, p.y) < 0) return false;
				begin(cellAt(p.x, p.y), true, p);
				commit();
				return true;
			}
		},
		{
			layout: () => ({ width, pad, cellSize }),
			touchMode: () => touchMode,
			enabled: (touch) => !blank && !(touch && readonly)
		}
	);

	// ---- Keyboard: a cursor on the cells ------------------------------------------------------

	/** Space on a cell: what a click in its middle does. */
	function press(cell: number, inverse: boolean) {
		const at = { x: (cell % w) + 0.5, y: Math.floor(cell / w) + 0.5 };
		begin(cell, inverse, at);
		commit();
	}

	const keyCursor = new KeyCursor<number>({
		first: () => g.cells[0],
		step(at, rows, cols) {
			const r = Math.floor(at / w) + rows;
			const c = (at % w) + cols;
			return r < 0 || r >= h || c < 0 || c >= w ? null : r * w + c;
		},
		// Ctrl or ⌘ with the arrows builds bridges on the way, Shift with the arrows crosses.
		shiftDraws: true,
		begin(from, key) {
			if (pending || readonly) return false;
			begin(from, key === 'shift', null);
			return true;
		},
		extend: (_, to) => extend(to),
		commit,
		cancel: () => (pending = null),
		press: (at) => press(at, false)
	});
	const cursor = $derived(keyCursor.at);
	/** For screen readers: the cell under the cursor. */
	const speech = $derived(
		keys && cursor != null && !blank
			? sayCell(puzzle, shown, a, cursor, {
					errors: !!settings.highlightErrors,
					dimSatisfied: !!settings.dimSatisfied
				})
			: ''
	);
	const speechId = $props.id();

	$effect(() =>
		keys?.({
			keydown(e: KeyPress) {
				if (blank) return false;
				const at = keyCursor.at;
				const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
				if (at != null && plain && e.key === ' ' && e.shiftKey) {
					e.preventDefault();
					press(at, true);
					return true;
				}
				return keyCursor.keydown(e);
			},
			keyup: (e: KeyPress) => keyCursor.keyup(e),
			blur: () => keyCursor.blur()
		})
	);

	// ---- Drawing ------------------------------------------------------------------------------

	const px = (col: number) => pad + col * cellSize;
	const py = (row: number) => pad + row * cellSize;
	const cx = (cell: number) => px((cell % w) + 0.5);
	const cy = (cell: number) => py(Math.floor(cell / w) + 0.5);
	const radius = $derived(cellSize * 0.38);
	const bridgeWidth = $derived(Math.max(2, cellSize * 0.07));
	/** Half the gap between the two lines of a double bridge. */
	const gap = $derived(Math.max(3, cellSize * 0.1));
	/** Hint outlines: as thick as `Spotlight` draws them. */
	const spotWidth = $derived(spotlightWidth(cellSize));

	/** A link's ends: the centres of its two islands. */
	function ends(link: number) {
		const [a, b] = [g.cells[g.ends[2 * link]], g.cells[g.ends[2 * link + 1]]];
		return { x1: cx(a), y1: cy(a), x2: cx(b), y2: cy(b), across: !!g.across[link] };
	}

	/** The middle of a link, where its cross goes. */
	function middle(link: number) {
		const e = ends(link);
		return { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 };
	}

	const links = $derived(
		shown.links.flatMap((value, link) => (value ? [{ link, value, key: linkKey(link) }] : []))
	);

	const bridgeColour = (key: string, crossed: boolean) =>
		crossed && settings.highlightErrors
			? errorColour
			: trial?.has(key)
				? colours.trial
				: colours.line;

	/** The islands joined to the last bridge set, with the setting. */
	const joined = $derived(
		!blank && settings.showGroup ? joinedTo(puzzle, a, lastChange) : new Set<number>()
	);

	/** Win animation: rings of islands from the first one along the bridges, in turn colours. */
	const celebration = $derived(
		celebrate && !blank
			? groupRings(puzzle, shown).map(
					(ring) => CELEBRATION_COLOURS[ring % CELEBRATION_COLOURS.length]
				)
			: null
	);

	function islandFill(i: number) {
		if (blank) return colours.surface;
		if (celebration) return celebration[i];
		if (settings.highlightErrors && a.error[i]) return errorFill;
		return joined.has(i) ? colours.sameDigit : colours.surface;
	}

	function islandInk(i: number) {
		if (blank) return colours.ink;
		if (settings.highlightErrors && a.error[i]) return errorColour;
		if (settings.dimSatisfied && a.count[i] === g.clue[i]) return colours.faint;
		return colours.ink;
	}

	/** Where a highlight of `key` goes: an island's circle, or a band along a link. */
	function shapeOf(key: string, grow: number) {
		const n = Number(key.slice(2));
		if (key.startsWith('c:'))
			return { kind: 'circle' as const, x: cx(n), y: cy(n), r: radius + grow };
		const e = ends(n);
		const inset = radius + 2;
		const half = gap + bridgeWidth + grow;
		const [x, y] = e.across ? [e.x1 + inset, e.y1 - half] : [e.x1 - half, e.y1 + inset];
		const [wd, ht] = e.across
			? [e.x2 - e.x1 - 2 * inset, 2 * half]
			: [2 * half, e.y2 - e.y1 - 2 * inset];
		return { kind: 'rect' as const, x, y, w: Math.max(wd, 2), h: Math.max(ht, 2) };
	}
</script>

<!-- Only the svg itself is hit: a touch keeps its target even when the shape under the finger
     is redrawn mid-drag (a removed target would swallow the rest of the gesture). The board the
     keys play is an application to screen readers, which then hand it the arrow keys; Tab brings
     the focus to it. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<svg
	{width}
	{height}
	viewBox="0 0 {width} {height}"
	class="board-focus block touch-manipulation select-none [&_*]:pointer-events-none"
	style:touch-action={touchAction(touchMode)}
	role="application"
	tabindex={keys ? 0 : -1}
	aria-label={t('game.board')}
	aria-describedby={keys ? speechId : undefined}
	{@attach input}
>
	<rect x={px(0)} y={py(0)} width={w * cellSize} height={h * cellSize} fill={colours.surface} />

	<!-- A faint dot in every cell of water, so that rows and columns are easy to follow -->
	<g fill={colours.faint} aria-hidden="true">
		{#each { length: w * h } as _, c (c)}
			{#if g.islandAt[c] < 0}
				<circle cx={cx(c)} cy={cy(c)} r={Math.max(1, cellSize * 0.035)} />
			{/if}
		{/each}
	</g>

	{#if area?.size && !blank}
		<g class="area" fill={colours.cursor} fill-opacity="0.2" aria-hidden="true">
			{#each [...area] as key (key)}
				{@const s = shapeOf(key, 4)}
				{#if s.kind === 'circle'}
					<circle cx={s.x} cy={s.y} r={s.r} />
				{:else}
					<rect x={s.x} y={s.y} width={s.w} height={s.h} rx="3" />
				{/if}
			{/each}
		</g>
	{/if}

	<!-- Bridges and crosses -->
	{#if !blank}
		{#each links as { link, value, key } (key)}
			{@const e = ends(link)}
			{#if value === CROSS}
				{@const m = middle(link)}
				{@const s = cellSize * 0.11}
				<path
					data-cross={link}
					d="M{m.x - s} {m.y - s}l{2 * s} {2 * s}m0 {-2 * s}l{-2 * s} {2 * s}"
					stroke={trial?.has(key) ? colours.trial : colours.cross}
					stroke-width="2"
					stroke-linecap="round"
				/>
			{:else}
				{@const offsets = bridgesOf(value) === 2 ? [-gap, gap] : [0]}
				<g
					data-bridge={link}
					data-value={value}
					data-trial={trial?.has(key) || undefined}
					stroke={bridgeColour(key, a.crossed[link])}
					stroke-width={bridgeWidth}
				>
					{#each offsets as off (off)}
						<line
							x1={e.x1 + (e.across ? 0 : off)}
							y1={e.y1 + (e.across ? off : 0)}
							x2={e.x2 + (e.across ? 0 : off)}
							y2={e.y2 + (e.across ? off : 0)}
						/>
					{/each}
				</g>
			{/if}
		{/each}
	{/if}

	<!-- Islands -->
	<g font-size={cellSize * 0.46} font-weight="600" text-anchor="middle" dominant-baseline="central">
		{#each g.cells as cell, i (cell)}
			{@const error = !blank && settings.highlightErrors && a.error[i]}
			<g data-island={cell} data-error={error || undefined}>
				<circle
					cx={cx(cell)}
					cy={cy(cell)}
					r={radius}
					fill={islandFill(i)}
					stroke={error ? errorColour : colours.line}
					stroke-width={Math.max(1.5, cellSize * 0.04)}
				/>
				<text x={cx(cell)} y={cy(cell)} fill={islandInk(i)}>{g.clue[i]}</text>
			</g>
		{/each}
	</g>

	{#if !blank && settings.highlightLastChange}
		<g fill="none" stroke={colours.recent} stroke-width="1.5">
			{#each [...lastChange] as key (key)}
				{#if key.startsWith('l:')}
					{@const s = shapeOf(key, 2)}
					{#if s.kind === 'rect'}
						<rect x={s.x} y={s.y} width={s.w} height={s.h} rx="3" />
					{/if}
				{/if}
			{/each}
		</g>
	{/if}

	{#if spotlight?.size && !blank}
		<Spotlight
			{cellSize}
			colour={mistake ? errorColour : colours.cursor}
			background={colours.surface}
			{mistake}
		>
			{#each [...spotlight] as key (key)}
				{@const s = shapeOf(key, spotWidth)}
				{#if s.kind === 'circle'}
					<circle cx={s.x} cy={s.y} r={s.r} />
				{:else}
					<rect x={s.x} y={s.y} width={s.w} height={s.h} rx={spotWidth * 1.5} />
				{/if}
			{/each}
		</Spotlight>
	{/if}

	{#if cursor != null && !blank}
		<rect
			x={px(cursor % w) + 1.5}
			y={py(Math.floor(cursor / w)) + 1.5}
			width={cellSize - 3}
			height={cellSize - 3}
			fill="none"
			stroke={colours.cursor}
			stroke-width="3"
			rx="3"
		/>
	{/if}

	{#if settings.showCoordinates && !blank}
		<g
			fill={colours.label}
			font-size={labelFontSize(pad)}
			text-anchor="middle"
			dominant-baseline="central"
		>
			{#each coordinateLabels(w, h, cellSize, pad) as label, k (k)}
				<text x={label.x} y={label.y}>{label.text}</text>
			{/each}
		</g>
	{/if}
</svg>
{#if keys}
	<BoardSpeech id={speechId} game="bridges" text={speech} />
{/if}
