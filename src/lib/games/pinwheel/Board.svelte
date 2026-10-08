<script lang="ts" module>
	/** Note colours 1–9 (spec 10.2). Index 0 = none. */
	export const NOTE_COLOURS = [
		'',
		'#cdbaf2',
		'#f6b4b4',
		'#f7e48d',
		'#bce6ad',
		'#acd6f6',
		'#f5b9da',
		'#d4d4d4',
		'#b4ebda',
		'#f9d1a8'
	];
</script>

<script lang="ts">
	import { columnLabel, neighbours } from '../../core/grid';
	import type { BoardProps } from '../../core/types';
	import {
		analyze,
		CROSS,
		frozenEdges,
		innerDots,
		hIndex,
		isBlocked,
		LINE,
		mirrorCell,
		OPEN,
		vIndex,
		type PinwheelPuzzle,
		type PinwheelState
	} from './rules';
	import { extendPath, type Dot } from './path';
	import { t } from '../../i18n/index.svelte';

	let {
		puzzle,
		state: board,
		settings,
		tool,
		toolOption,
		cellSize,
		readonly,
		lastChange,
		blank = false,
		keyboard = false,
		touchMode,
		onmove
	}: BoardProps<PinwheelPuzzle, PinwheelState> = $props();

	type Edge = { kind: 'h' | 'v'; i: number; j: number };
	type Pending =
		| {
				kind: 'edges';
				status: number | null;
				inverse: boolean;
				edges: string[];
				path: Dot[] | null;
				/** The path started on an edge, which stays drawn whichever way the pointer goes. */
				anchored?: boolean;
		  }
		| { kind: 'cells'; colour: number; cells: number[] }
		| { kind: 'centre'; k: number; cell: number };

	const w = $derived(puzzle.width);
	const h = $derived(puzzle.height);
	const pad = $derived(
		settings.showCoordinates && !blank ? Math.max(14, cellSize * 0.6) : cellSize * 0.2
	);
	const width = $derived(w * cellSize + 2 * pad);
	const height = $derived(h * cellSize + 2 * pad);
	const errorColour = $derived(settings.blueErrors ? '#60a5fa' : '#ef4444');

	let pending = $state<Pending | null>(null);
	let cursor = $state<Dot | null>(null);
	let shiftHeld = $state(false);
	const activeTool = $derived(shiftHeld ? (tool === 'color' ? 'black' : 'color') : tool);

	const edgeKey = (e: Edge) => `${e.kind}:${e.i}:${e.j}`;
	const parseEdge = (key: string): Edge => {
		const [kind, i, j] = key.split(':');
		return { kind: kind as 'h' | 'v', i: Number(i), j: Number(j) };
	};
	const getEdge = (s: PinwheelState, e: Edge) =>
		e.kind === 'h' ? s.h[hIndex(puzzle, e.i, e.j)] : s.v[vIndex(puzzle, e.i, e.j)];

	// Preview: board with the pending move applied.
	const shown = $derived.by((): PinwheelState => {
		if (blank) {
			return {
				h: board.h.map(() => OPEN),
				v: board.v.map(() => OPEN),
				colors: board.colors.map(() => 0),
				locks: board.locks.map(() => 0)
			};
		}
		if (!pending || pending.kind === 'centre') return board;
		return applyPending(board, pending).state;
	});
	const a = $derived(analyze(puzzle, shown));
	const frozen = $derived(frozenEdges(puzzle, board, analyze(puzzle, board)));
	/** Once solved, the dots inside galaxies go, leaving only the lines and centres. */
	const hiddenDots = $derived(
		!blank && a.complete.every(Boolean) ? innerDots(puzzle, shown, a) : new Set<number>()
	);

	const blocked = $derived.by(() => {
		const out = new Set<string>();
		for (let i = 0; i <= h; i++)
			for (let j = 0; j < w; j++) if (isBlocked(puzzle, 'h', i, j)) out.add(`h:${i}:${j}`);
		for (let i = 0; i < h; i++)
			for (let j = 0; j <= w; j++) if (isBlocked(puzzle, 'v', i, j)) out.add(`v:${i}:${j}`);
		return out;
	});

	function editable(e: Edge) {
		const interior =
			e.kind === 'h'
				? e.i > 0 && e.i < h && e.j >= 0 && e.j < w
				: e.j > 0 && e.j < w && e.i >= 0 && e.i < h;
		return interior && !blocked.has(edgeKey(e)) && !frozen.has(edgeKey(e));
	}

	// Auto colours for complete galaxies, stable while a galaxy stays complete.
	const memory = new Map<number, number>();
	const autoColours = $derived.by(() => {
		if (!settings.autoColor || blank) return new Map<number, number>();
		const regionOfCentre = a.centreRegion;
		const completeCentres = new Set<number>();
		a.complete.forEach((c, r) => c && completeCentres.add(a.regionCentres[r][0]));
		for (const k of [...memory.keys()]) if (!completeCentres.has(k)) memory.delete(k);
		const adjacent = (r1: number, r2: number) =>
			a.regionCells[r1].some((i) => neighbours(i, w, h).some((j) => a.region[j] === r2));
		const order = [6, 7, 8, 9, 1, 2, 3, 4, 5];
		for (const k of completeCentres) {
			const r = regionOfCentre[k];
			const used = new Set<number>();
			for (const [k2, colour] of memory) {
				if (k2 !== k && adjacent(r, regionOfCentre[k2])) used.add(colour);
			}
			const mine = memory.get(k);
			if (mine == null || used.has(mine)) memory.set(k, order.find((c) => !used.has(c)) ?? 7);
		}
		const byRegion = new Map<number, number>();
		for (const [k, colour] of memory) byRegion.set(regionOfCentre[k], colour);
		return byRegion;
	});

	const helper = $derived.by(() => {
		if (!pending || pending.kind !== 'centre' || pending.cell < 0 || !settings.symmetryHelper)
			return null;
		const m = mirrorCell(puzzle, pending.cell, puzzle.centres[pending.k]);
		return { k: pending.k, cell: pending.cell, mirror: m };
	});

	function cellFill(i: number): string {
		if (helper && (helper.cell === i || helper.mirror === i)) {
			return helper.mirror < 0 ? errorColour : '#fde68a';
		}
		if (settings.highlightErrors && a.cellError[i]) return errorColour;
		const auto = autoColours.get(a.region[i]);
		if (auto) return NOTE_COLOURS[auto];
		return NOTE_COLOURS[shown.colors[i]] || 'transparent';
	}

	// ---- Applying moves -------------------------------------------------------------------------

	function edgeStatus(cur: number, inverse: boolean): number {
		switch (activeTool) {
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

	function pendingEdges(p: Extract<Pending, { kind: 'edges' }>): string[] {
		if (!p.path) return p.edges;
		const out: string[] = [];
		for (let k = 1; k < p.path.length; k++) {
			const a = p.path[k - 1];
			const b = p.path[k];
			const e: Edge =
				a.i === b.i
					? { kind: 'h', i: a.i, j: Math.min(a.j, b.j) }
					: { kind: 'v', i: Math.min(a.i, b.i), j: a.j };
			out.push(edgeKey(e));
		}
		return out;
	}

	function applyPending(s: PinwheelState, p: Pending): { state: PinwheelState; changed: string[] } {
		const next: PinwheelState = {
			h: s.h.slice(),
			v: s.v.slice(),
			colors: s.colors.slice(),
			locks: s.locks
		};
		const changed: string[] = [];
		if (p.kind === 'edges') {
			if (p.status == null) return { state: s, changed };
			for (const key of pendingEdges(p)) {
				const e = parseEdge(key);
				if (!editable(e)) continue;
				const arr = e.kind === 'h' ? next.h : next.v;
				const idx = e.kind === 'h' ? hIndex(puzzle, e.i, e.j) : vIndex(puzzle, e.i, e.j);
				if (arr[idx] !== p.status) changed.push(key);
				arr[idx] = p.status;
			}
		} else if (p.kind === 'cells') {
			for (const i of p.cells) {
				if (next.colors[i] !== p.colour) changed.push(`c:${i}`);
				next.colors[i] = p.colour;
			}
		}
		return { state: next, changed };
	}

	function commit() {
		const p = pending;
		pending = null;
		if (!p || p.kind === 'centre') return;
		const { state: next, changed } = applyPending(board, p);
		if (changed.length) onmove(next, changed);
	}

	function toggleLock(k: number) {
		if (readonly) return;
		const locks = board.locks.slice();
		if (!locks[k]) {
			const live = analyze(puzzle, board);
			if (!live.complete[live.centreRegion[k]]) return;
		}
		locks[k] = locks[k] ? 0 : 1;
		onmove({ ...board, locks }, [`g:${k}`]);
	}

	// ---- Targeting ------------------------------------------------------------------------------

	let svg: SVGSVGElement | undefined = $state();

	function toBoard(clientX: number, clientY: number) {
		const rect = svg!.getBoundingClientRect();
		const scale = rect.width / width;
		return {
			x: ((clientX - rect.left) / scale - pad) / cellSize,
			y: ((clientY - rect.top) / scale - pad) / cellSize
		};
	}

	function centreAt(x: number, y: number): number {
		return puzzle.centres.findIndex(
			([hr, hc]) => Math.hypot(x - (hc / 2 + 0.5), y - (hr / 2 + 0.5)) < 0.22
		);
	}

	function cellAt(x: number, y: number): number {
		if (x < 0 || y < 0 || x >= w || y >= h) return -1;
		return Math.floor(y) * w + Math.floor(x);
	}

	function nearestDot(x: number, y: number): Dot {
		return {
			i: Math.min(h, Math.max(0, Math.round(y))),
			j: Math.min(w, Math.max(0, Math.round(x)))
		};
	}

	/** Nearest edge: inside a cell the closest of its four sides; null near a dot. */
	function edgeAt(x: number, y: number, allowNearDot = false): Edge | null {
		const cx = Math.min(w - 0.001, Math.max(0, x));
		const cy = Math.min(h - 0.001, Math.max(0, y));
		const dx = Math.abs(cx - Math.round(cx));
		const dy = Math.abs(cy - Math.round(cy));
		if (!allowNearDot && Math.hypot(dx, dy) < 0.2) return null;
		if (dy <= dx) return { kind: 'h', i: Math.round(cy), j: Math.floor(cx) };
		return { kind: 'v', i: Math.floor(cy), j: Math.round(cx) };
	}

	// ---- Pointer --------------------------------------------------------------------------------

	let last: { x: number; y: number } | null = null;

	function begin(x: number, y: number, inverse: boolean, fromKeyboard = false) {
		if (readonly) return;
		if (!fromKeyboard) {
			const k = centreAt(x, y);
			if (k >= 0 && !shiftHeld) {
				if (inverse) toggleLock(k);
				else pending = { kind: 'centre', k, cell: cellAt(x, y) };
				return;
			}
		}
		if (activeTool === 'color') {
			const cell = cellAt(x, y);
			if (cell < 0) return;
			const colour = inverse || board.colors[cell] ? 0 : toolOption;
			pending = { kind: 'cells', colour, cells: [cell] };
			return;
		}
		const dot = nearestDot(x, y);
		const nearDot = fromKeyboard || Math.hypot(x - dot.j, y - dot.i) < 0.2;
		const continuous = settings.continuousLine;
		if (nearDot) {
			pending = {
				kind: 'edges',
				status: null,
				inverse,
				edges: [],
				path: continuous ? [dot] : null
			};
			return;
		}
		const e = edgeAt(x, y, true);
		if (!e || !editable(e)) {
			// A move started on a blocked or fixed edge changes nothing.
			pending = null;
			return;
		}
		const status = edgeStatus(getEdge(board, e), inverse);
		const usePath = continuous && status === LINE;
		let path: Dot[] | null = null;
		if (usePath) {
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
			const d1 = Math.hypot(x - p1.j, y - p1.i);
			const d2 = Math.hypot(x - p2.j, y - p2.i);
			path = d1 < d2 ? [p2, p1] : [p1, p2];
		}
		pending = { kind: 'edges', status, inverse, edges: [edgeKey(e)], path, anchored: !!path };
	}

	function dragTo(x: number, y: number) {
		const p = pending;
		if (!p) return;
		if (p.kind === 'centre') {
			pending = { ...p, cell: cellAt(x, y) };
			return;
		}
		const from = last ?? { x, y };
		const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) * 5));
		const copy = structuredClone($state.snapshot(p)) as typeof p;
		for (let s = 1; s <= steps; s++) {
			const px = from.x + ((x - from.x) * s) / steps;
			const py = from.y + ((y - from.y) * s) / steps;
			if (copy.kind === 'cells') {
				const cell = cellAt(px, py);
				if (cell >= 0 && !copy.cells.includes(cell)) copy.cells.push(cell);
				continue;
			}
			if (copy.status == null) {
				// Started on a dot: the first edge reached decides the status.
				const e = edgeAt(px, py);
				if (!e || !editable(e)) continue;
				copy.status = edgeStatus(getEdge(board, e), copy.inverse);
				if (copy.status !== LINE || !copy.path) {
					copy.path = null;
					copy.edges = [edgeKey(e)];
					continue;
				}
			}
			if (copy.path) {
				const d = nearestDot(px, py);
				if (Math.hypot(px - d.j, py - d.i) < 0.45) {
					copy.path = extendPath(copy.path, d, copy.anchored);
				}
			} else {
				const e = edgeAt(px, py);
				if (e && !copy.edges.includes(edgeKey(e))) copy.edges.push(edgeKey(e));
			}
		}
		pending = copy;
		last = { x, y };
	}

	function onpointerdown(e: PointerEvent) {
		if (e.pointerType === 'touch' || blank || e.button === 1) return;
		e.preventDefault();
		const { x, y } = toBoard(e.clientX, e.clientY);
		shiftHeld = e.shiftKey;
		cursor = null;
		begin(x, y, e.button === 2 || e.ctrlKey || e.metaKey);
		last = { x, y };
		svg?.setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (e.pointerType === 'touch' || !pending) return;
		const { x, y } = toBoard(e.clientX, e.clientY);
		dragTo(x, y);
	}

	function onpointerup(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		commit();
		last = null;
	}

	// Touch: quick tap acts at once, early movement pans, holding 300 ms draws, 400 ms on a centre locks.
	let touch: { x: number; y: number; drawing: boolean; timer: number; lockTimer: number } | null =
		null;

	function ontouchstart(e: TouchEvent) {
		if (blank || readonly) return;
		if (e.touches.length > 1) {
			if (touch) {
				clearTimeout(touch.timer);
				clearTimeout(touch.lockTimer);
			}
			touch = null;
			pending = null;
			return;
		}
		const t = e.touches[0];
		const start = { x: t.clientX, y: t.clientY, drawing: false, timer: 0, lockTimer: 0 };
		touch = start;
		const p = toBoard(start.x, start.y);
		const k = centreAt(p.x, p.y);
		if (k >= 0) {
			start.lockTimer = window.setTimeout(() => {
				if (touch !== start) return;
				clearTimeout(start.timer);
				touch = null;
				pending = null;
				toggleLock(k);
			}, 400);
		}
		const startDraw = () => {
			if (touch !== start) return;
			start.drawing = true;
			begin(p.x, p.y, false);
			last = p;
		};
		if (touchMode === 'draw') startDraw();
		else if (touchMode === 'auto') start.timer = window.setTimeout(startDraw, 300);
	}

	function ontouchmove(e: TouchEvent) {
		if (!touch) return;
		const t = e.touches[0];
		if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > 3) clearTimeout(touch.lockTimer);
		if (touch.drawing) {
			e.preventDefault();
			const p = toBoard(t.clientX, t.clientY);
			dragTo(p.x, p.y);
		} else if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > 3) {
			clearTimeout(touch.timer);
			touch = null;
		}
	}

	function ontouchend(e: TouchEvent) {
		if (!touch) return;
		clearTimeout(touch.timer);
		clearTimeout(touch.lockTimer);
		if (!touch.drawing) {
			e.preventDefault();
			const p = toBoard(touch.x, touch.y);
			begin(p.x, p.y, false);
		}
		commit();
		touch = null;
		last = null;
	}

	$effect(() => {
		const el = svg;
		if (!el) return;
		el.addEventListener('touchmove', ontouchmove, { passive: false });
		el.addEventListener('touchend', ontouchend, { passive: false });
		return () => {
			el.removeEventListener('touchmove', ontouchmove);
			el.removeEventListener('touchend', ontouchend);
		};
	});

	// ---- Keyboard: cursor on dots ---------------------------------------------------------------

	let keyMove = false;
	const DIRS: Record<string, [number, number]> = {
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0],
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1],
		w: [-1, 0],
		s: [1, 0],
		a: [0, -1],
		d: [0, 1]
	};

	function isTyping(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Shift') shiftHeld = true;
		if (!keyboard || blank || isTyping(e)) return;
		const dir = DIRS[e.key] ?? DIRS[e.key.toLowerCase()];
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
				if (pending && pending.kind === 'edges') {
					const p = structuredClone($state.snapshot(pending)) as typeof pending;
					const e2: Edge =
						prev.i === cursor.i
							? { kind: 'h', i: prev.i, j: Math.min(prev.j, cursor.j) }
							: { kind: 'v', i: Math.min(prev.i, cursor.i), j: prev.j };
					if (p.status == null && editable(e2)) {
						p.status = edgeStatus(getEdge(board, e2), false);
						if (p.status !== LINE) p.path = null;
					}
					if (p.path) p.path = extendPath(p.path, cursor);
					else if (!p.edges.includes(edgeKey(e2))) p.edges.push(edgeKey(e2));
					pending = p;
				}
			}
			return;
		}
		if (!cursor) return;
		if (e.key === 'Escape') {
			pending = null;
			cursor = null;
			keyMove = false;
		} else if ((e.key === 'Control' || e.key === 'Meta') && !e.repeat && !pending) {
			keyMove = true;
			begin(cursor.j, cursor.i, false, true);
		} else if (keyMove && !['Control', 'Meta'].includes(e.key) && !e.key.startsWith('Arrow')) {
			pending = null;
			keyMove = false;
		}
	}

	function onkeyup(e: KeyboardEvent) {
		if (e.key === 'Shift') shiftHeld = false;
		if (keyMove && (e.key === 'Control' || e.key === 'Meta')) {
			keyMove = false;
			commit();
		}
	}

	// ---- Drawing helpers ------------------------------------------------------------------------

	const px = (j: number) => pad + j * cellSize;
	const py = (i: number) => pad + i * cellSize;
	const lineWidth = $derived(Math.max(2.5, cellSize * 0.09));

	const edgeList = $derived.by(() => {
		const out: { key: string; e: Edge; value: number }[] = [];
		for (let i = 1; i < h; i++)
			for (let j = 0; j < w; j++)
				out.push({
					key: `h:${i}:${j}`,
					e: { kind: 'h', i, j },
					value: shown.h[hIndex(puzzle, i, j)]
				});
		for (let i = 0; i < h; i++)
			for (let j = 1; j < w; j++)
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

	function centreFill(k: number) {
		if (blank) return '#ffffff';
		if (helper?.k === k) return '#fde68a';
		if (board.locks[k]) return '#9ca3af';
		const complete = a.complete[a.centreRegion[k]];
		if (settings.blackHoles && complete) return '#111827';
		if (settings.highlightErrors && a.centreError[k]) return errorColour;
		return '#ffffff';
	}
</script>

<svelte:window
	{onkeydown}
	{onkeyup}
	onblur={() => (shiftHeld = false)}
	onscrollcapture={() => pending && !touch && (pending = null)}
/>

<!-- Only the svg itself is hit: a touch keeps its target even when the shape under the finger
     is redrawn mid-drag (a removed target would swallow the rest of the gesture). -->
<svg
	bind:this={svg}
	{width}
	{height}
	viewBox="0 0 {width} {height}"
	class="block outline-none select-none [&_*]:pointer-events-none"
	style:touch-action={touchMode === 'draw'
		? 'none'
		: touchMode === 'pan'
			? 'auto'
			: 'pan-x pan-y pinch-zoom'}
	role="grid"
	tabindex="-1"
	aria-label={t('game.board')}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointercancel={() => ((pending = null), (last = null))}
	oncontextmenu={(e) => e.preventDefault()}
	{ontouchstart}
>
	<rect x={px(0)} y={py(0)} width={w * cellSize} height={h * cellSize} fill="#fffdf4" />

	<!-- Cell fills -->
	{#if !blank}
		{#each shown.colors as _, i (i)}
			{@const fill = cellFill(i)}
			{#if fill !== 'transparent'}
				<rect x={px(i % w)} y={py(Math.floor(i / w))} width={cellSize} height={cellSize} {fill} />
			{/if}
		{/each}
	{/if}

	<!-- Faint grid -->
	{#if settings.showGrid || blank}
		<g stroke="#9ca3af" stroke-width="1" stroke-dasharray="2 3" opacity="0.6">
			{#each { length: w - 1 } as _, j (j)}
				<line x1={px(j + 1)} y1={py(0)} x2={px(j + 1)} y2={py(h)} />
			{/each}
			{#each { length: h - 1 } as _, i (i)}
				<line x1={px(0)} y1={py(i + 1)} x2={px(w)} y2={py(i + 1)} />
			{/each}
		</g>
	{/if}

	<!-- Lines and crosses -->
	{#if !blank}
		{#each edgeList as { key, e, value } (key)}
			{#if value === LINE}
				<path
					data-line={key}
					d={edgePath(e)}
					stroke={frozen.has(key) ? '#9ca3af' : '#1f2937'}
					stroke-width={lineWidth}
					stroke-linecap="round"
				/>
			{:else if value === CROSS}
				{@const m = edgeMid(e)}
				{@const s = cellSize * 0.1}
				<path
					d="M{m.x - s} {m.y - s}l{2 * s} {2 * s}m0 {-2 * s}l{-2 * s} {2 * s}"
					stroke="#dc2626"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			{/if}
		{/each}
	{/if}

	<rect
		x={px(0)}
		y={py(0)}
		width={w * cellSize}
		height={h * cellSize}
		fill="none"
		stroke="#1f2937"
		stroke-width={lineWidth}
	/>

	<!-- Dots -->
	<g fill="#374151">
		{#each { length: (h + 1) * (w + 1) } as _, k (k)}
			{#if !hiddenDots.has(k)}
				<circle
					cx={px(k % (w + 1))}
					cy={py(Math.floor(k / (w + 1)))}
					r={Math.max(1.5, cellSize * 0.045)}
				/>
			{/if}
		{/each}
	</g>

	{#if !blank && settings.highlightLastChange}
		<g fill="none" stroke="#2563eb" stroke-width="1.5">
			{#each [...lastChange] as key (key)}
				{#if key.startsWith('c:')}
					{@const i = Number(key.slice(2))}
					<rect
						x={px(i % w) + 3}
						y={py(Math.floor(i / w)) + 3}
						width={cellSize - 6}
						height={cellSize - 6}
					/>
				{:else if key.startsWith('h:') || key.startsWith('v:')}
					{@const e = parseEdge(key)}
					{@const m = edgeMid(e)}
					<rect
						x={m.x - (e.kind === 'h' ? cellSize / 2 : 4)}
						y={m.y - (e.kind === 'v' ? cellSize / 2 : 4)}
						width={e.kind === 'h' ? cellSize : 8}
						height={e.kind === 'v' ? cellSize : 8}
						rx="3"
					/>
				{/if}
			{/each}
		</g>
	{/if}

	<!-- Centres -->
	{#each puzzle.centres as [hr, hc], k (k)}
		<circle
			cx={px(hc / 2 + 0.5)}
			cy={py(hr / 2 + 0.5)}
			r={cellSize * 0.2}
			fill={centreFill(k)}
			stroke={!blank && settings.highlightLastChange && lastChange.has(`g:${k}`)
				? '#2563eb'
				: '#1f2937'}
			stroke-width="2"
		/>
	{/each}

	{#if cursor && !blank}
		<circle
			cx={px(cursor.j)}
			cy={py(cursor.i)}
			r={cellSize * 0.18}
			fill="none"
			stroke="#f59e0b"
			stroke-width="3"
		/>
	{/if}

	{#if settings.showCoordinates && !blank}
		<g
			fill="#6b7280"
			font-size={Math.min(12, pad * 0.75)}
			text-anchor="middle"
			dominant-baseline="central"
		>
			{#each { length: w } as _, c (c)}
				<text x={px(c + 0.5)} y={pad / 2}>{columnLabel(c)}</text>
				<text x={px(c + 0.5)} y={height - pad / 2}>{columnLabel(c)}</text>
			{/each}
			{#each { length: h } as _, r (r)}
				<text x={pad / 2} y={py(r + 0.5)}>{r + 1}</text>
				<text x={width - pad / 2} y={py(r + 0.5)}>{r + 1}</text>
			{/each}
		</g>
	{/if}
</svg>
