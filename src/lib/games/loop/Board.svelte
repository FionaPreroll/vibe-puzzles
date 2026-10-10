<script lang="ts">
	import { boardPad, celebrationFills, coordinateLabels, labelFontSize } from '../../core/grid';
	import { colours } from '../../core/palette';
	import { extendPath, type Dot } from '../../core/path';
	import type { BoardProps, KeyPress } from '../../core/types';
	import { boardInput, interpolate, touchAction, type BoardPoint } from '../../client/boardInput';
	import { direction } from '../../client/keys';
	import { t } from '../../i18n/index.svelte';
	import type { LoopSettingKey } from './settings';
	import {
		analyze,
		clueAt,
		CROSS,
		hIndex,
		LINE,
		OPEN,
		vIndex,
		type EdgeRef,
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
		area
	}: BoardProps<LoopPuzzle, LoopState, LoopSettingKey> = $props();

	type Edge = EdgeRef;
	/** A move in progress: the edges it sets, or a line drawn along a path of dots. */
	interface Pending {
		status: number | null;
		inverse: boolean;
		edges: string[];
		path: Dot[] | null;
		/** The path started on an edge, which stays drawn whichever way the pointer goes. */
		anchored?: boolean;
	}

	const w = $derived(puzzle.width);
	const h = $derived(puzzle.height);
	const pad = $derived(boardPad(cellSize, settings.showCoordinates && !blank, cellSize * 0.25));
	const width = $derived(w * cellSize + 2 * pad);
	const height = $derived(h * cellSize + 2 * pad);
	const errorColour = $derived(settings.blueErrors ? colours.blueErrorCell : colours.errorCell);

	let pending = $state<Pending | null>(null);
	let cursor = $state<Dot | null>(null);

	const edgeKey = (e: Edge) => `${e.kind}:${e.i}:${e.j}`;
	const parseEdge = (key: string): Edge => {
		const [kind, i, j] = key.split(':');
		return { kind: kind as 'h' | 'v', i: Number(i), j: Number(j) };
	};
	const getEdge = (s: LoopState, e: Edge) =>
		e.kind === 'h' ? s.h[hIndex(puzzle, e.i, e.j)] : s.v[vIndex(puzzle, e.i, e.j)];
	const onBoard = (e: Edge) =>
		e.kind === 'h'
			? e.i >= 0 && e.i <= h && e.j >= 0 && e.j < w
			: e.i >= 0 && e.i < h && e.j >= 0 && e.j <= w;

	/** The board with the pending move applied, as a preview. */
	const shown = $derived.by((): LoopState => {
		if (blank) return { h: board.h.map(() => OPEN), v: board.v.map(() => OPEN) };
		return pending ? applyPending(board, pending).state : board;
	});
	const a = $derived(analyze(puzzle, shown));

	// ---- Applying moves -------------------------------------------------------------------------

	function edgeStatus(cur: number, inverse: boolean): number {
		switch (tool) {
			case 'rotate':
				return inverse ? [CROSS, OPEN, LINE][cur] : [LINE, CROSS, OPEN][cur];
			case 'cross':
				return inverse ? (cur === LINE ? OPEN : LINE) : cur === CROSS ? OPEN : CROSS;
			case 'blank':
				return OPEN;
			default:
				return inverse ? (cur === CROSS ? OPEN : CROSS) : cur === LINE ? OPEN : LINE;
		}
	}

	function pendingEdges(p: Pending): string[] {
		if (!p.path) return p.edges;
		const out: string[] = [];
		for (let k = 1; k < p.path.length; k++) {
			const [from, to] = [p.path[k - 1], p.path[k]];
			out.push(
				edgeKey(
					from.i === to.i
						? { kind: 'h', i: from.i, j: Math.min(from.j, to.j) }
						: { kind: 'v', i: Math.min(from.i, to.i), j: from.j }
				)
			);
		}
		return out;
	}

	function applyPending(s: LoopState, p: Pending): { state: LoopState; changed: string[] } {
		const changed: string[] = [];
		if (p.status == null) return { state: s, changed };
		const next: LoopState = { h: s.h.slice(), v: s.v.slice() };
		for (const key of pendingEdges(p)) {
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

	// ---- Targeting ------------------------------------------------------------------------------

	function nearestDot(x: number, y: number): Dot {
		return {
			i: Math.min(h, Math.max(0, Math.round(y))),
			j: Math.min(w, Math.max(0, Math.round(x)))
		};
	}

	/** Nearest edge: inside a cell the closest of its four sides; null near a dot. */
	function edgeAt(x: number, y: number, allowNearDot = false): Edge | null {
		const cx = Math.min(w, Math.max(0, x));
		const cy = Math.min(h, Math.max(0, y));
		const dx = Math.abs(cx - Math.round(cx));
		const dy = Math.abs(cy - Math.round(cy));
		if (!allowNearDot && Math.hypot(dx, dy) < 0.2) return null;
		if (dy <= dx) return { kind: 'h', i: Math.round(cy), j: Math.min(w - 1, Math.floor(cx)) };
		return { kind: 'v', i: Math.min(h - 1, Math.floor(cy)), j: Math.round(cx) };
	}

	// ---- Pointer --------------------------------------------------------------------------------

	function begin(x: number, y: number, inverse: boolean, fromKeyboard = false) {
		if (readonly) return;
		const dot = nearestDot(x, y);
		const continuous = settings.continuousLine;
		if (fromKeyboard || Math.hypot(x - dot.j, y - dot.i) < 0.2) {
			pending = { status: null, inverse, edges: [], path: continuous ? [dot] : null };
			return;
		}
		const e = edgeAt(x, y, true);
		if (!e) return;
		const status = edgeStatus(getEdge(board, e), inverse);
		let path: Dot[] | null = null;
		if (continuous && status === LINE) {
			const [p1, p2]: Dot[] =
				e.kind === 'h'
					? [
							{ i: e.i, j: e.j },
							{ i: e.i, j: e.j + 1 }
						]
					: [
							{ i: e.i, j: e.j },
							{ i: e.i + 1, j: e.j }
						];
			path = Math.hypot(x - p1.j, y - p1.i) < Math.hypot(x - p2.j, y - p2.i) ? [p2, p1] : [p1, p2];
		}
		pending = { status, inverse, edges: [edgeKey(e)], path, anchored: !!path };
	}

	function dragTo(to: BoardPoint, from: BoardPoint) {
		if (!pending) return;
		const copy = structuredClone($state.snapshot(pending)) as Pending;
		for (const { x, y } of interpolate(from, to, 5)) {
			if (copy.status == null) {
				// Started on a dot: the first edge reached decides the status.
				const e = edgeAt(x, y);
				if (!e) continue;
				copy.status = edgeStatus(getEdge(board, e), copy.inverse);
				if (copy.status !== LINE || !copy.path) {
					copy.path = null;
					copy.edges = [edgeKey(e)];
					continue;
				}
			}
			if (copy.path) {
				const d = nearestDot(x, y);
				if (Math.hypot(x - d.j, y - d.i) < 0.45)
					copy.path = extendPath(copy.path, d, copy.anchored);
			} else {
				const e = edgeAt(x, y);
				if (e && !copy.edges.includes(edgeKey(e))) copy.edges.push(edgeKey(e));
			}
		}
		pending = copy;
	}

	const input = boardInput(
		{
			start(p, how) {
				if (!how.touch) cursor = null;
				begin(p.x, p.y, how.inverse);
			},
			drag: dragTo,
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

	let keyMove = false;

	function onkeydown(e: KeyPress): boolean {
		if (blank) return false;
		const dir = direction(e.key);
		const isArrow = e.key.startsWith('Arrow');
		if (dir && (isArrow || (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey))) {
			e.preventDefault();
			const prev = cursor;
			cursor = prev
				? {
						i: Math.min(h, Math.max(0, prev.i + dir[0])),
						j: Math.min(w, Math.max(0, prev.j + dir[1]))
					}
				: { i: 0, j: 0 };
			if (isArrow && (e.ctrlKey || e.metaKey) && prev) {
				if (!pending) {
					begin(prev.j, prev.i, false, true);
					keyMove = true;
				}
				if (pending) {
					const p = structuredClone($state.snapshot(pending)) as Pending;
					const step: Edge =
						prev.i === cursor.i
							? { kind: 'h', i: prev.i, j: Math.min(prev.j, cursor.j) }
							: { kind: 'v', i: Math.min(prev.i, cursor.i), j: prev.j };
					if (p.status == null && onBoard(step)) {
						p.status = edgeStatus(getEdge(board, step), false);
						if (p.status !== LINE) p.path = null;
					}
					if (p.path) p.path = extendPath(p.path, cursor);
					else if (!p.edges.includes(edgeKey(step))) p.edges.push(edgeKey(step));
					pending = p;
				}
			}
			return true;
		}
		if (!cursor) return false;
		if (e.key === 'Escape') {
			pending = null;
			cursor = null;
			keyMove = false;
		} else if ((e.key === 'Control' || e.key === 'Meta') && !e.repeat && !pending) {
			keyMove = true;
			begin(cursor.j, cursor.i, false, true);
		} else if (keyMove && !['Control', 'Meta'].includes(e.key) && !isArrow) {
			pending = null;
			keyMove = false;
		}
		return false;
	}

	function onkeyup(e: KeyPress) {
		if (keyMove && (e.key === 'Control' || e.key === 'Meta')) {
			keyMove = false;
			commit();
		}
	}

	$effect(() => keys?.({ keydown: onkeydown, keyup: onkeyup }));

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
     is redrawn mid-drag (a removed target would swallow the rest of the gesture). -->
<svg
	{width}
	{height}
	viewBox="0 0 {width} {height}"
	class="block outline-none select-none [&_*]:pointer-events-none"
	style:touch-action={touchAction(touchMode)}
	role="grid"
	tabindex="-1"
	aria-label={t('game.board')}
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
					d={edgePath(e)}
					stroke={colours.line}
					stroke-width={lineWidth}
					stroke-linecap="round"
				/>
			{:else if value === CROSS}
				{@const m = edgeMid(e)}
				{@const s = cellSize * 0.09}
				<path
					d="M{m.x - s} {m.y - s}l{2 * s} {2 * s}m0 {-2 * s}l{-2 * s} {2 * s}"
					stroke={colours.cross}
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
		<g class="spotlight" fill="none" stroke={colours.cursor} stroke-width="3" aria-hidden="true">
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
