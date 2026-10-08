<script lang="ts">
	import { CELEBRATION_COLOURS, colourRegions, columnLabel } from '../../core/grid';
	import { colours } from '../../core/palette';
	import type { BoardProps } from '../../core/types';
	import { analyze, CROSS, EMPTY, SHADED, type TetroidPuzzle, type TetroidState } from './rules';
	import { t } from '../../i18n/index.svelte';

	let {
		puzzle,
		state: board,
		settings,
		tool,
		cellSize,
		readonly,
		lastChange,
		blank = false,
		keyboard = false,
		celebrate = false,
		touchMode,
		onmove
	}: BoardProps<TetroidPuzzle, TetroidState> = $props();

	const TYPE_COLOURS: Record<string, string> = {
		L: colours.tetrominoL,
		I: colours.tetrominoI,
		T: colours.tetrominoT,
		S: colours.tetrominoS
	};

	const w = $derived(puzzle.width);
	const h = $derived(puzzle.height);
	const pad = $derived(settings.showCoordinates && !blank ? Math.max(14, cellSize * 0.6) : 3);
	const width = $derived(w * cellSize + 2 * pad);
	const height = $derived(h * cellSize + 2 * pad);

	// Pending move (previewed until release).
	let pending = $state<{ cells: number[]; status: number } | null>(null);
	let current = $state(-1);
	let cursor = $state<number | null>(null);
	let hover = $state(-1);
	let shiftHeld = $state(false);

	const marks = $derived.by(() => {
		if (blank) return board.marks.map(() => EMPTY);
		if (!pending) return board.marks;
		const m = board.marks.slice();
		for (const i of pending.cells) m[i] = pending.status;
		return m;
	});
	const a = $derived(analyze(puzzle, marks));

	const groupCells = $derived.by(() => {
		const out = new Set<number>();
		const pick = (i: number) => {
			if (i < 0 || marks[i] !== SHADED) return;
			const g = a.groups[i];
			a.groups.forEach((x, k) => x === g && out.add(k));
		};
		if (settings.highlightGroup) pick(current);
		if (shiftHeld) pick(hover);
		return out;
	});

	const borders = $derived.by(() => {
		const segs: string[] = [];
		for (let r = 0; r < h; r++) {
			for (let c = 0; c < w; c++) {
				const i = r * w + c;
				const x = pad + c * cellSize;
				const y = pad + r * cellSize;
				if (c < w - 1 && puzzle.regions[i] !== puzzle.regions[i + 1]) {
					segs.push(`M${x + cellSize} ${y}v${cellSize}`);
				}
				if (r < h - 1 && puzzle.regions[i] !== puzzle.regions[i + w]) {
					segs.push(`M${x} ${y + cellSize}h${cellSize}`);
				}
			}
		}
		return segs.join('');
	});

	const errorColour = $derived(settings.blueErrors ? colours.blueErrorShade : colours.errorShade);

	function fillOf(i: number): string {
		const m = marks[i];
		if (m === SHADED) {
			if (settings.highlightErrors && a.errors[i]) return errorColour;
			if (groupCells.has(i)) return colours.group;
			const type = a.regionType[puzzle.regions[i]];
			if (settings.colorTetrominoes && type) return TYPE_COLOURS[type];
			return colours.shaded;
		}
		if (settings.highlightBlock && current >= 0 && puzzle.regions[i] === puzzle.regions[current]) {
			return colours.block;
		}
		return colours.surface;
	}

	// ---- Input --------------------------------------------------------------------------------

	function nextStatus(cur: number, inverse: boolean): number {
		switch (tool) {
			case 'rotate':
				return inverse ? [CROSS, EMPTY, SHADED][cur] : [SHADED, CROSS, EMPTY][cur];
			case 'cross':
				return inverse ? (cur === SHADED ? EMPTY : SHADED) : cur === CROSS ? EMPTY : CROSS;
			case 'blank':
				return EMPTY;
			default:
				return inverse ? (cur === CROSS ? EMPTY : CROSS) : cur === SHADED ? EMPTY : SHADED;
		}
	}

	function begin(cell: number, inverse: boolean) {
		if (readonly || cell < 0) return;
		pending = { cells: [cell], status: nextStatus(board.marks[cell], inverse) };
		current = cell;
	}

	function extend(cell: number) {
		if (!pending || cell < 0 || pending.cells.includes(cell)) return;
		pending = { ...pending, cells: [...pending.cells, cell] };
		current = cell;
	}

	function commit() {
		if (!pending) return;
		const { cells, status } = pending;
		pending = null;
		const next = { marks: board.marks.slice(), auto: board.auto.slice() };
		const changed: string[] = [];
		for (const i of cells) {
			if (next.marks[i] !== status) changed.push(String(i));
			next.marks[i] = status;
			next.auto[i] = 0;
		}
		if (changed.length) onmove(next, changed);
	}

	function cancel() {
		pending = null;
	}

	let svg: SVGSVGElement | undefined = $state();

	/** Board position in cell units. */
	function toCell(clientX: number, clientY: number) {
		const rect = svg!.getBoundingClientRect();
		const scale = rect.width / width;
		return {
			x: ((clientX - rect.left) / scale - pad) / cellSize,
			y: ((clientY - rect.top) / scale - pad) / cellSize
		};
	}

	function cellAt(x: number, y: number): number {
		const c = Math.min(w - 1, Math.max(0, Math.floor(x)));
		const r = Math.min(h - 1, Math.max(0, Math.floor(y)));
		return r * w + c;
	}

	/** Inside a corner triangle with legs of a third of the cell. */
	function inCorner(x: number, y: number) {
		const u = x - Math.floor(x);
		const v = y - Math.floor(y);
		const t = 1 / 3;
		return u + v < t || 1 - u + v < t || u + 1 - v < t || 2 - u - v < t;
	}

	let last: { x: number; y: number } | null = null;

	function dragTo(x: number, y: number) {
		if (!pending) return;
		const from = last ?? { x, y };
		const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) * 4));
		for (let s = 1; s <= steps; s++) {
			const px = from.x + ((x - from.x) * s) / steps;
			const py = from.y + ((y - from.y) * s) / steps;
			if (px < 0 || py < 0 || px >= w || py >= h) continue;
			const cell = cellAt(px, py);
			const prev = pending.cells[pending.cells.length - 1];
			const sameLine = Math.floor(cell / w) === Math.floor(prev / w) || cell % w === prev % w;
			if (cell !== prev && sameLine && inCorner(px, py)) continue;
			extend(cell);
		}
		last = { x, y };
	}

	function onpointerdown(e: PointerEvent) {
		if (e.pointerType === 'touch' || blank) return;
		if (e.button === 1) return;
		e.preventDefault();
		const { x, y } = toCell(e.clientX, e.clientY);
		const inverse = e.button === 2 || e.ctrlKey || e.metaKey;
		cursor = null;
		begin(cellAt(x, y), inverse);
		last = { x, y };
		svg?.setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		const { x, y } = toCell(e.clientX, e.clientY);
		hover = x >= 0 && y >= 0 && x < w && y < h ? cellAt(x, y) : -1;
		shiftHeld = e.shiftKey;
		if (pending) dragTo(x, y);
	}

	function onpointerup(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		commit();
		last = null;
	}

	// Touch: a quick tap acts at once; moving early pans; holding still 300 ms starts drawing.
	let touch: { x: number; y: number; t: number; drawing: boolean; timer: number } | null = null;

	function ontouchstart(e: TouchEvent) {
		if (blank || readonly) return;
		if (e.touches.length > 1) {
			if (touch) clearTimeout(touch.timer);
			touch = null;
			cancel();
			return;
		}
		const t = e.touches[0];
		const start = { x: t.clientX, y: t.clientY, t: Date.now(), drawing: false, timer: 0 };
		touch = start;
		const startDraw = () => {
			if (touch !== start) return;
			start.drawing = true;
			const p = toCell(start.x, start.y);
			begin(cellAt(p.x, p.y), false);
			last = p;
		};
		if (touchMode === 'draw') startDraw();
		else if (touchMode === 'auto') start.timer = window.setTimeout(startDraw, 300);
	}

	function ontouchmove(e: TouchEvent) {
		if (!touch) return;
		const t = e.touches[0];
		if (touch.drawing) {
			// Not when the browser is already scrolling (e.g. a hold that started drawing late):
			// that event cannot be cancelled, and trying it logs an error.
			if (e.cancelable) e.preventDefault();
			const p = toCell(t.clientX, t.clientY);
			dragTo(p.x, p.y);
		} else if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > 3) {
			clearTimeout(touch.timer);
			touch = null;
		}
	}

	function ontouchend(e: TouchEvent) {
		if (!touch) return;
		clearTimeout(touch.timer);
		if (touch.drawing) {
			commit();
		} else {
			// A tap: one-cell move.
			e.preventDefault();
			const p = toCell(touch.x, touch.y);
			begin(cellAt(p.x, p.y), false);
			commit();
		}
		touch = null;
		last = null;
	}

	$effect(() => {
		const el = svg;
		if (!el) return;
		// Non-passive so that drawing can stop the page from scrolling.
		el.addEventListener('touchmove', ontouchmove, { passive: false });
		el.addEventListener('touchend', ontouchend, { passive: false });
		return () => {
			el.removeEventListener('touchmove', ontouchmove);
			el.removeEventListener('touchend', ontouchend);
		};
	});

	// Keyboard: cursor between cells; Ctrl/Shift hold a move at the cursor.
	let keyMove: 'ctrl' | 'shift' | null = null;

	function moveCursor(dr: number, dc: number, extendMove: boolean) {
		if (cursor == null) {
			cursor = 0;
		} else {
			const r = Math.min(h - 1, Math.max(0, Math.floor(cursor / w) + dr));
			const c = Math.min(w - 1, Math.max(0, (cursor % w) + dc));
			cursor = r * w + c;
		}
		current = cursor;
		if (extendMove) {
			if (!pending) begin(cursor, keyMove === 'shift');
			else extend(cursor);
		}
	}

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

	function onkeydown(e: KeyboardEvent) {
		if (!keyboard || blank || isTyping(e)) return;
		const dir = DIRS[e.key] ?? DIRS[e.key.toLowerCase()];
		const isArrow = e.key.startsWith('Arrow');
		if (dir && (isArrow || (!e.ctrlKey && !e.metaKey && !e.altKey))) {
			e.preventDefault();
			moveCursor(dir[0], dir[1], isArrow && (e.ctrlKey || e.metaKey || e.shiftKey));
			return;
		}
		if (cursor == null) return;
		if (e.key === ' ') {
			e.preventDefault();
			begin(cursor, false);
			commit();
		} else if (e.key === 'Escape') {
			cancel();
			cursor = null;
			keyMove = null;
		} else if ((e.key === 'Control' || e.key === 'Meta') && !e.repeat && !pending) {
			keyMove = 'ctrl';
			begin(cursor, false);
		} else if (e.key === 'Shift' && !e.repeat && !pending) {
			keyMove = 'shift';
			begin(cursor, true);
		} else if (keyMove && !['Control', 'Meta', 'Shift'].includes(e.key)) {
			// Another shortcut while holding the modifier (e.g. Shift+Z): drop the held move.
			cancel();
			keyMove = null;
		}
	}

	function onkeyup(e: KeyboardEvent) {
		shiftHeld = e.shiftKey;
		if (!keyMove) return;
		if (
			(keyMove === 'ctrl' && (e.key === 'Control' || e.key === 'Meta')) ||
			(keyMove === 'shift' && e.key === 'Shift')
		) {
			keyMove = null;
			commit();
		}
	}

	function isTyping(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
	}

	function onwindowkeydown(e: KeyboardEvent) {
		if (e.key === 'Shift') shiftHeld = true;
		onkeydown(e);
	}

	/** Win animation: every region in its own colour for a moment. */
	const celebrationFill = $derived.by(() => {
		if (!celebrate || blank) return null;
		const slot = colourRegions(puzzle.regions, w, h, CELEBRATION_COLOURS.length);
		return Array.from({ length: w * h }, (_, i) => CELEBRATION_COLOURS[slot[puzzle.regions[i]]]);
	});
</script>

<!-- Capture phase: the board handles its keys before the game's shortcuts see them -->
<svelte:window
	onkeydowncapture={onwindowkeydown}
	{onkeyup}
	onscrollcapture={() => pending && !touch && cancel()}
	onblur={() => (shiftHeld = false)}
/>

<!-- Only the svg itself is hit: a touch keeps its target even when the shape under the finger
     is redrawn mid-drag (a removed target would swallow the rest of the gesture). -->
<svg
	bind:this={svg}
	{width}
	{height}
	viewBox="0 0 {width} {height}"
	class="block touch-manipulation outline-none select-none [&_*]:pointer-events-none"
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
	onpointercancel={() => (cancel(), (last = null))}
	onpointerleave={() => (hover = -1)}
	oncontextmenu={(e) => e.preventDefault()}
	{ontouchstart}
>
	<rect x={pad} y={pad} width={w * cellSize} height={h * cellSize} fill={colours.surface} />
	{#each marks as m, i (i)}
		{@const x = pad + (i % w) * cellSize}
		{@const y = pad + Math.floor(i / w) * cellSize}
		<rect {x} {y} width={cellSize} height={cellSize} fill={fillOf(i)} />
		{#if m === SHADED && settings.highlightErrors && a.errors[i]}
			<circle
				cx={x + cellSize / 2}
				cy={y + cellSize / 2}
				r={cellSize * 0.1}
				fill={colours.surface}
			/>
		{:else if m === CROSS}
			<path
				d="M{x + cellSize * 0.3} {y + cellSize * 0.3}l{cellSize * 0.4} {cellSize *
					0.4}m0 {-cellSize * 0.4}l{-cellSize * 0.4} {cellSize * 0.4}"
				stroke={colours.cross}
				stroke-width={Math.max(1.5, cellSize * 0.06)}
				stroke-linecap="round"
			/>
		{/if}
	{/each}

	{#if celebrationFill}
		<g class="celebrate-regions" aria-hidden="true">
			{#each celebrationFill as fill, i (i)}
				<rect
					x={pad + (i % w) * cellSize}
					y={pad + Math.floor(i / w) * cellSize}
					width={cellSize}
					height={cellSize}
					{fill}
				/>
			{/each}
		</g>
	{/if}

	<!-- Thin cell lines -->
	<g stroke={colours.gridLine} stroke-width="1" opacity="0.55">
		{#each { length: w - 1 } as _, c (c)}
			<line
				x1={pad + (c + 1) * cellSize}
				y1={pad}
				x2={pad + (c + 1) * cellSize}
				y2={pad + h * cellSize}
			/>
		{/each}
		{#each { length: h - 1 } as _, r (r)}
			<line
				x1={pad}
				y1={pad + (r + 1) * cellSize}
				x2={pad + w * cellSize}
				y2={pad + (r + 1) * cellSize}
			/>
		{/each}
	</g>

	<!-- Region borders -->
	<path
		d={borders}
		stroke={colours.line}
		stroke-width={settings.thickBorders ? 3.5 : 2.5}
		stroke-linecap="square"
		fill="none"
	/>
	<rect
		x={pad}
		y={pad}
		width={w * cellSize}
		height={h * cellSize}
		fill="none"
		stroke={colours.line}
		stroke-width={settings.thickBorders ? 4 : 3}
	/>

	{#if !blank && settings.highlightLastChange}
		{#each [...lastChange] as key (key)}
			{@const i = Number(key)}
			<rect
				x={pad + (i % w) * cellSize + 2.5}
				y={pad + Math.floor(i / w) * cellSize + 2.5}
				width={cellSize - 5}
				height={cellSize - 5}
				fill="none"
				stroke={colours.recent}
				stroke-width="1.5"
			/>
		{/each}
	{/if}

	{#if cursor != null && !blank}
		<rect
			x={pad + (cursor % w) * cellSize + 1.5}
			y={pad + Math.floor(cursor / w) * cellSize + 1.5}
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
			font-size={Math.min(12, pad * 0.75)}
			text-anchor="middle"
			dominant-baseline="central"
		>
			{#each { length: w } as _, c (c)}
				<text x={pad + (c + 0.5) * cellSize} y={pad / 2}>{columnLabel(c)}</text>
				<text x={pad + (c + 0.5) * cellSize} y={height - pad / 2}>{columnLabel(c)}</text>
			{/each}
			{#each { length: h } as _, r (r)}
				<text x={pad / 2} y={pad + (r + 0.5) * cellSize}>{r + 1}</text>
				<text x={width - pad / 2} y={pad + (r + 0.5) * cellSize}>{r + 1}</text>
			{/each}
		</g>
	{/if}
</svg>
