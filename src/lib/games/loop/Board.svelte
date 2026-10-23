<script lang="ts">
	import { boardPad, celebrationFills, coordinateLabels, labelFontSize } from '../../core/grid';
	import { colours } from '../../core/palette';
	import type { Dot } from '../../core/path';
	import type { BoardProps, KeyPress } from '../../core/types';
	import { boardInput, touchAction } from '../../client/boardInput';
	import { EdgeInput, parseEdge, type Edge, type EdgeMove } from '../../client/edgeInput';
	import { KeyCursor } from '../../client/keyCursor.svelte';
	import { nextMark } from '../../client/marks';
	import { t } from '../../i18n/index.svelte';
	import type { LoopSettingKey } from './settings';
	import { sayDot } from './speech';
	import BoardSpeech from '../../components/game/BoardSpeech.svelte';
	import {
		analyze,
		clueAt,
		CROSS,
		hIndex,
		LINE,
		OPEN,
		vIndex,
		type LoopPuzzle,
		type LoopState
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
	}: BoardProps<LoopPuzzle, LoopState, LoopSettingKey> = $props();

	const w = $derived(puzzle.width);
	const h = $derived(puzzle.height);
	const pad = $derived(boardPad(cellSize, settings.showCoordinates && !blank, cellSize * 0.2));
	const width = $derived(w * cellSize + 2 * pad);
	const height = $derived(h * cellSize + 2 * pad);
	const errorColour = $derived(settings.blueErrors ? colours.blueErrorCell : colours.errorCell);
	/** Wrong marks a hint points at. */
	const mistakeColour = $derived(settings.blueErrors ? colours.blueError : colours.error);

	/** The move under way, from the pointer or the keys. */
	let pending = $state.raw<EdgeMove | null>(null);

	const getEdge = (s: LoopState, e: Edge) =>
		e.kind === 'h' ? s.h[hIndex(puzzle, e.i, e.j)] : s.v[vIndex(puzzle, e.i, e.j)];
	const onBoard = (e: Edge) =>
		e.kind === 'h'
			? e.i >= 0 && e.i <= h && e.j >= 0 && e.j < w
			: e.i >= 0 && e.i < h && e.j >= 0 && e.j <= w;

	const edges = new EdgeInput({
		size: () => ({ width: w, height: h }),
		continuous: () => settings.continuousLine,
		statusOf: (e, inverse) => nextMark(tool, getEdge(board, e), inverse)
	});

	/** The board with the pending move applied, as a preview. */
	const shown = $derived.by((): LoopState => {
		if (blank) return { h: board.h.map(() => OPEN), v: board.v.map(() => OPEN) };
		return pending ? applyPending(board, pending).state : board;
	});
	const a = $derived(analyze(puzzle, shown));

	// ---- Applying moves -------------------------------------------------------------------------

	function applyPending(s: LoopState, p: EdgeMove): { state: LoopState; changed: string[] } {
		const changed: string[] = [];
		if (p.status == null) return { state: s, changed };
		const next: LoopState = { h: s.h.slice(), v: s.v.slice() };
		for (const key of edges.edgesOf(p)) {
			const e = parseEdge(key);
			if (!onBoard(e)) continue;
			const values = e.kind === 'h' ? next.h : next.v;
			const index = e.kind === 'h' ? hIndex(puzzle, e.i, e.j) : vIndex(puzzle, e.i, e.j);
			if (values[index] !== p.status) changed.push(key);
			values[index] = p.status;
		}
		return { state: next, changed };
	}

	function commit() {
		const p = pending;
		pending = null;
		if (!p) return;
		const { state: next, changed } = applyPending(board, p);
		if (changed.length) onmove(next, changed);
	}

	// ---- Pointer --------------------------------------------------------------------------------

	const input = boardInput(
		{
			start(p, how) {
				if (!how.touch) keyCursor.hide();
				if (!readonly) pending = edges.begin(p.x, p.y, how.inverse);
			},
			drag(to, from) {
				if (pending) pending = edges.drag(pending, from, to);
			},
			end: commit,
			cancel: () => (pending = null)
		},
		{
			layout: () => ({ width, pad, cellSize }),
			touchMode: () => touchMode,
			enabled: (touch) => !blank && !(touch && readonly)
		}
	);

	// ---- Keyboard: cursor on dots ---------------------------------------------------------------

	const keyCursor = new KeyCursor<Dot>({
		...edges.dots,
		begin(from) {
			if (pending || readonly) return false;
			pending = edges.beginAt(from, false);
			return true;
		},
		extend(from, to) {
			if (pending) pending = edges.step(pending, from, to);
		},
		commit,
		cancel: () => (pending = null)
	});
	const cursor = $derived(keyCursor.at);
	/** For screen readers: the dot under the cursor. */
	const speech = $derived(
		keys && cursor && !blank
			? sayDot(puzzle, shown, a, cursor, {
					errors: !!settings.highlightErrors,
					dimSatisfied: !!settings.dimSatisfiedClues
				})
			: ''
	);
	const speechId = $props.id();

	$effect(() =>
		keys?.({
			keydown: (e: KeyPress) => !blank && keyCursor.keydown(e),
			keyup: (e: KeyPress) => keyCursor.keyup(e),
			blur: () => keyCursor.blur()
		})
	);

	// ---- Drawing helpers ------------------------------------------------------------------------

	const px = (j: number) => pad + j * cellSize;
	const py = (i: number) => pad + i * cellSize;
	const lineWidth = $derived(Math.max(3, cellSize * 0.1));

	const edgeList = $derived.by(() => {
		const out: { key: string; e: Edge; value: number }[] = [];
		for (let i = 0; i <= h; i++)
			for (let j = 0; j < w; j++)
				out.push({
					key: `h:${i}:${j}`,
					e: { kind: 'h', i, j },
					value: shown.h[hIndex(puzzle, i, j)]
				});
		for (let i = 0; i < h; i++)
			for (let j = 0; j <= w; j++)
				out.push({
					key: `v:${i}:${j}`,
					e: { kind: 'v', i, j },
					value: shown.v[vIndex(puzzle, i, j)]
				});
		return out;
	});

	function edgePath(e: Edge) {
		return e.kind === 'h'
			? `M${px(e.j)} ${py(e.i)}H${px(e.j + 1)}`
			: `M${px(e.j)} ${py(e.i)}V${py(e.i + 1)}`;
	}

	function edgeMid(e: Edge) {
		return e.kind === 'h' ? { x: px(e.j + 0.5), y: py(e.i) } : { x: px(e.j), y: py(e.i + 0.5) };
	}

	function clueColour(c: number) {
		if (blank) return colours.ink;
		if (settings.highlightErrors && a.clueError[c]) return colours.error;
		if (settings.dimSatisfiedClues && a.count[c] === clueAt(puzzle, c)) return colours.faint;
		return colours.ink;
	}

	/** Win animation: the cells inside and outside the loop in their own colours for a moment. */
	const celebrationFill = $derived.by(() => {
		if (!celebrate || blank) return null;
		const region = Array.from({ length: w * h }, (_, c) => c);
		const find = (x: number): number => (region[x] === x ? x : (region[x] = find(region[x])));
		for (let i = 1; i < h; i++)
			for (let j = 0; j < w; j++)
				if (shown.h[hIndex(puzzle, i, j)] !== LINE) region[find((i - 1) * w + j)] = find(i * w + j);
		for (let i = 0; i < h; i++)
			for (let j = 1; j < w; j++)
				if (shown.v[vIndex(puzzle, i, j)] !== LINE) region[find(i * w + j - 1)] = find(i * w + j);
		return celebrationFills(
			region.map((_, c) => find(c)),
			w,
			h
		);
	});
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
	class="board-focus block select-none [&_*]:pointer-events-none"
	style:touch-action={touchAction(touchMode)}
	role="application"
	tabindex={keys ? 0 : -1}
	aria-label={t('game.board')}
	aria-describedby={keys ? speechId : undefined}
	{@attach input}
>
	<rect x={px(0)} y={py(0)} width={w * cellSize} height={h * cellSize} fill={colours.paper} />

	{#if celebrationFill}
		<g class="celebrate-regions" aria-hidden="true">
			{#each celebrationFill as fill, i (i)}
				<rect x={px(i % w)} y={py(Math.floor(i / w))} width={cellSize} height={cellSize} {fill} />
			{/each}
		</g>
	{/if}

	{#if area?.size && !blank}
		<g class="area" fill={colours.cursor} fill-opacity="0.2" aria-hidden="true">
			{#each [...area] as key (key)}
				{#if key.startsWith('c:')}
					{@const i = Number(key.slice(2))}
					<rect x={px(i % w)} y={py(Math.floor(i / w))} width={cellSize} height={cellSize} />
				{:else if key.startsWith('d:')}
					{@const k = Number(key.slice(2))}
					<circle cx={px(k % (w + 1))} cy={py(Math.floor(k / (w + 1)))} r={cellSize * 0.22} />
				{:else}
					<path
						d={edgePath(parseEdge(key))}
						stroke={colours.cursor}
						stroke-opacity="0.35"
						stroke-width={cellSize * 0.3}
						stroke-linecap="round"
					/>
				{/if}
			{/each}
		</g>
	{/if}

	<!-- Clues -->
	<g font-size={cellSize * 0.5} font-weight="600" text-anchor="middle" dominant-baseline="central">
		{#each puzzle.clues as clue, c (c)}
			{#if clue !== '.'}
				<text
					data-clue={c}
					x={px((c % w) + 0.5)}
					y={py(Math.floor(c / w) + 0.5)}
					fill={clueColour(c)}>{clue}</text
				>
			{/if}
		{/each}
	</g>

	<!-- Lines and crosses -->
	{#if !blank}
		{#each edgeList as { key, e, value } (key)}
			{#if value === LINE}
				<path
					data-line={key}
					data-trial={trial?.has(key) || undefined}
					d={edgePath(e)}
					stroke={trial?.has(key) ? colours.trial : colours.line}
					stroke-width={lineWidth}
					stroke-linecap="round"
				/>
			{:else if value === CROSS}
				{@const m = edgeMid(e)}
				{@const s = cellSize * 0.09}
				<path
					d="M{m.x - s} {m.y - s}l{2 * s} {2 * s}m0 {-2 * s}l{-2 * s} {2 * s}"
					stroke={trial?.has(key) ? colours.trial : colours.cross}
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			{/if}
		{/each}
	{/if}

	<!-- Dots; a dot where the line branches or runs into crosses turns red -->
	{#each { length: (h + 1) * (w + 1) } as _, k (k)}
		{@const error = !blank && settings.highlightErrors && a.dotError[k]}
		<circle
			cx={px(k % (w + 1))}
			cy={py(Math.floor(k / (w + 1)))}
			r={Math.max(2, cellSize * (error ? 0.09 : 0.06))}
			fill={error ? errorColour : colours.dot}
			stroke={error ? colours.error : 'none'}
		/>
	{/each}

	{#if !blank && settings.highlightLastChange}
		<g fill="none" stroke={colours.recent} stroke-width="1.5">
			{#each [...lastChange] as key (key)}
				{#if key.startsWith('h:') || key.startsWith('v:')}
					{@const e = parseEdge(key)}
					{@const m = edgeMid(e)}
					<rect
						x={m.x - (e.kind === 'h' ? cellSize / 2 : 5)}
						y={m.y - (e.kind === 'v' ? cellSize / 2 : 5)}
						width={e.kind === 'h' ? cellSize : 10}
						height={e.kind === 'v' ? cellSize : 10}
						rx="3"
					/>
				{/if}
			{/each}
		</g>
	{/if}

	{#if spotlight?.size && !blank}
		<g
			class="spotlight"
			data-mistake={mistake || undefined}
			fill="none"
			stroke={mistake ? mistakeColour : colours.cursor}
			stroke-width="3"
			aria-hidden="true"
		>
			{#each [...spotlight] as key (key)}
				{#if key.startsWith('c:')}
					{@const i = Number(key.slice(2))}
					<rect
						x={px(i % w) + 4}
						y={py(Math.floor(i / w)) + 4}
						width={cellSize - 8}
						height={cellSize - 8}
						rx="4"
						stroke-dasharray="6 4"
					/>
				{:else if key.startsWith('d:')}
					{@const k = Number(key.slice(2))}
					<circle
						cx={px(k % (w + 1))}
						cy={py(Math.floor(k / (w + 1)))}
						r={cellSize * 0.2}
						stroke-dasharray="4 3"
					/>
				{:else if key.startsWith('h:') || key.startsWith('v:')}
					{@const e = parseEdge(key)}
					{@const m = edgeMid(e)}
					<rect
						x={m.x - (e.kind === 'h' ? cellSize / 2 - 3 : 6)}
						y={m.y - (e.kind === 'v' ? cellSize / 2 - 3 : 6)}
						width={e.kind === 'h' ? cellSize - 6 : 12}
						height={e.kind === 'v' ? cellSize - 6 : 12}
						rx="5"
						stroke-dasharray="6 4"
					/>
				{/if}
			{/each}
		</g>
	{/if}

	{#if cursor && !blank}
		<circle
			cx={px(cursor.j)}
			cy={py(cursor.i)}
			r={cellSize * 0.18}
			fill="none"
			stroke={colours.cursor}
			stroke-width="3"
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
	<BoardSpeech id={speechId} game="loop" text={speech} />
{/if}
