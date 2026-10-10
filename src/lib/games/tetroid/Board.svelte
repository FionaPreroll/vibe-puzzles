<script lang="ts">
	import { boardPad, celebrationFills, coordinateLabels, labelFontSize } from '../../core/grid';
	import { colours } from '../../core/palette';
	import type { BoardProps, KeyPress } from '../../core/types';
	import type { TetroidSettingKey } from './settings';
	import { boardInput, interpolate, touchAction, type BoardPoint } from '../../client/boardInput';
	import { direction } from '../../client/keys';
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
		keys,
		celebrate = false,
		touchMode,
		onmove,
		spotlight,
		area
	}: BoardProps<TetroidPuzzle, TetroidState, TetroidSettingKey> = $props();

	const TYPE_COLOURS: Record<string, string> = {
		L: colours.tetrominoL,
		I: colours.tetrominoI,
		T: colours.tetrominoT,
		S: colours.tetrominoS
	};

	const w = $derived(puzzle.width);
	const h = $derived(puzzle.height);
	const pad = $derived(boardPad(cellSize, settings.showCoordinates && !blank, 3));
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

	function dragTo(to: BoardPoint, from: BoardPoint) {
		if (!pending) return;
		for (const p of interpolate(from, to, 4)) {
			if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue;
			const cell = cellAt(p.x, p.y);
			const prev = pending.cells[pending.cells.length - 1];
			const sameLine = Math.floor(cell / w) === Math.floor(prev / w) || cell % w === prev % w;
			if (cell !== prev && sameLine && inCorner(p.x, p.y)) continue;
			extend(cell);
		}
	}

	const input = boardInput(
		{
			start(p, how) {
				if (!how.touch) cursor = null;
				begin(cellAt(p.x, p.y), how.inverse);
			},
			drag: dragTo,
			end: commit,
			cancel,
			hover(p, shift) {
				hover = p && p.x >= 0 && p.y >= 0 && p.x < w && p.y < h ? cellAt(p.x, p.y) : -1;
				if (p) shiftHeld = shift;
			}
		},
		{
			layout: () => ({ width, pad, cellSize }),
			touchMode: () => touchMode,
			enabled: (touch) => !blank && !(touch && readonly)
		}
	);

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

	function onkeydown(e: KeyPress): boolean {
		if (e.key === 'Shift') shiftHeld = true;
		if (blank) return false;
		const dir = direction(e.key);
		const isArrow = e.key.startsWith('Arrow');
		if (dir && (isArrow || (!e.ctrlKey && !e.metaKey && !e.altKey))) {
			e.preventDefault();
			moveCursor(dir[0], dir[1], isArrow && (e.ctrlKey || e.metaKey || e.shiftKey));
			return true;
		}
		if (cursor == null) return false;
		if (e.key === ' ') {
			e.preventDefault();
			begin(cursor, false);
			commit();
			return true;
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
		return false;
	}

	function onkeyup(e: KeyPress) {
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

	$effect(() => keys?.({ keydown: onkeydown, keyup: onkeyup, blur: () => (shiftHeld = false) }));

	/** Win animation: every region in its own colour for a moment. */
	const celebrationFill = $derived(
		celebrate && !blank ? celebrationFills(puzzle.regions, w, h) : null
	);
</script>

<!-- Only the svg itself is hit: a touch keeps its target even when the shape under the finger
     is redrawn mid-drag (a removed target would swallow the rest of the gesture). -->
<svg
	{width}
	{height}
	viewBox="0 0 {width} {height}"
	class="block touch-manipulation outline-none select-none [&_*]:pointer-events-none"
	style:touch-action={touchAction(touchMode)}
	role="grid"
	tabindex="-1"
	aria-label={t('game.board')}
	{@attach input}
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

	{#if area?.size && !blank}
		<g
			class="area"
			fill={colours.cursor}
			fill-opacity="0.2"
			pointer-events="none"
			aria-hidden="true"
		>
			{#each [...area] as key (key)}
				{@const i = Number(key)}
				<rect
					x={pad + (i % w) * cellSize}
					y={pad + Math.floor(i / w) * cellSize}
					width={cellSize}
					height={cellSize}
				/>
			{/each}
		</g>
	{/if}

	{#if spotlight?.size && !blank}
		<g class="spotlight" fill="none" stroke={colours.cursor} stroke-width="3" aria-hidden="true">
			{#each [...spotlight] as key (key)}
				{@const i = Number(key)}
				<rect
					x={pad + (i % w) * cellSize + 4}
					y={pad + Math.floor(i / w) * cellSize + 4}
					width={cellSize - 8}
					height={cellSize - 8}
					rx="4"
					stroke-dasharray="6 4"
				/>
			{/each}
		</g>
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
