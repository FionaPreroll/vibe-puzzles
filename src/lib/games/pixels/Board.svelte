<script lang="ts">
	import { boardPad, celebrationFills, columnLabel, labelFontSize } from '../../core/grid';
	import { colours } from '../../core/palette';
	import type { BoardProps, KeyPress } from '../../core/types';
	import { boardInput, interpolate, touchAction, type BoardPoint } from '../../client/boardInput';
	import { KeyCursor } from '../../client/keyCursor.svelte';
	import BoardSpeech from '../../components/game/BoardSpeech.svelte';
	import Spotlight, { spotlightWidth } from '../../components/game/Spotlight.svelte';
	import { t } from '../../i18n/index.svelte';
	import { clueSpace, COLUMN_SLOT, pictureRegions, rowSlot } from './draw';
	import { applyStroke, startStroke, strokeLine, type Stroke } from './input';
	import {
		analyze,
		CROSS,
		EMPTY,
		FILLED,
		lineKey,
		type PixelsPuzzle,
		type PixelsState
	} from './rules';
	import type { PixelsSettingKey } from './settings';
	import { sayCell } from './speech';

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
	}: BoardProps<PixelsPuzzle, PixelsState, PixelsSettingKey> = $props();

	const w = $derived(puzzle.width);
	const h = $derived(puzzle.height);
	/** Outer margin, and on the right and below the grid room for the coordinates. */
	const MARGIN = 3;
	const pad = $derived(boardPad(cellSize, settings.showCoordinates && !blank, MARGIN));
	const space = $derived(clueSpace(puzzle));
	/** Where the grid starts: right of the rows' numbers and below the columns' numbers. */
	const gx = $derived(MARGIN + space.left * cellSize);
	const gy = $derived(MARGIN + space.top * cellSize);
	const width = $derived(gx + w * cellSize + pad);
	const height = $derived(gy + h * cellSize + pad);
	const errorColour = $derived(settings.blueErrors ? colours.blueError : colours.error);
	const errorFill = $derived(settings.blueErrors ? colours.blueErrorFill : colours.errorFill);
	/** Hint outlines: as thick as `Spotlight` draws them, inset from the cell's edges. */
	const spotWidth = $derived(spotlightWidth(cellSize));
	const spotInset = $derived(Math.max(4, spotWidth));

	// ---- Moves --------------------------------------------------------------------------------

	/** A move under way, from the pointer or the keys, previewed until it is let go. */
	let pending = $state.raw<Stroke | null>(null);
	/** The cell under the mouse, for the highlighted row and column. */
	let hover = $state(-1);

	/** The board with the move under way applied; nothing marked for printing. */
	const shown = $derived.by((): PixelsState => {
		if (blank) return { cells: board.cells.map(() => EMPTY) };
		return pending ? applyStroke(board, pending, w).state : board;
	});
	const a = $derived(analyze(puzzle, shown));

	function cellAt(p: BoardPoint): number {
		const c = Math.min(w - 1, Math.max(0, Math.floor(p.x)));
		const r = Math.min(h - 1, Math.max(0, Math.floor(p.y)));
		return r * w + c;
	}

	function begin(cell: number, inverse: boolean) {
		if (readonly) return;
		pending = startStroke(board.cells, tool, cell, inverse);
	}

	/** The move goes on to `cell`: along the row or the column it started in. */
	function extend(cell: number) {
		if (pending && cell !== pending.end) pending = { ...pending, end: cell };
	}

	function commit() {
		const p = pending;
		pending = null;
		if (!p) return;
		const { state, changed } = applyStroke(board, p, w);
		if (changed.length) onmove(state, changed.map(String));
	}

	const input = boardInput(
		{
			start(p, how) {
				if (!how.touch) keyCursor.hide();
				begin(cellAt(p), how.inverse);
			},
			drag(to, from) {
				if (!pending) return;
				for (const p of interpolate(from, to, 4)) extend(cellAt(p));
			},
			end: commit,
			cancel: () => (pending = null),
			hover(p) {
				hover = p && p.x >= 0 && p.y >= 0 && p.x < w && p.y < h ? cellAt(p) : -1;
			}
		},
		{
			layout: () => ({ width, pad, cellSize, left: gx, top: gy }),
			touchMode: () => touchMode,
			enabled: (touch) => !blank && !(touch && readonly)
		}
	);

	// Keyboard: a cursor on the cells. Ctrl/Cmd or Shift with the arrows marks the cells on the way,
	// from the one the cursor leaves (Shift the opposite mark), when the key goes up.
	const keyCursor = new KeyCursor<number>({
		first: () => 0,
		step(at, rows, cols) {
			const r = Math.floor(at / w) + rows;
			const c = (at % w) + cols;
			return r < 0 || r >= h || c < 0 || c >= w ? null : r * w + c;
		},
		shiftDraws: true,
		begin(from, key) {
			if (pending || readonly) return false;
			begin(from, key === 'shift');
			return true;
		},
		extend: (_, to) => extend(to),
		commit,
		cancel: () => (pending = null),
		press(at) {
			begin(at, false);
			commit();
		}
	});
	const cursor = $derived(keyCursor.at);
	/** For screen readers: the cell under the cursor, with the numbers of its row and column. */
	const speech = $derived(
		keys && cursor != null && !blank
			? sayCell(puzzle, shown, a, cursor, {
					errors: !!settings.highlightErrors,
					dimDone: !!settings.dimDone
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
					begin(at, true);
					commit();
					return true;
				}
				return keyCursor.keydown(e);
			},
			keyup: (e: KeyPress) => keyCursor.keyup(e),
			blur: () => keyCursor.blur()
		})
	);

	// ---- Drawing ------------------------------------------------------------------------------

	const px = (col: number) => gx + col * cellSize;
	const py = (row: number) => gy + row * cellSize;
	const fontSize = $derived(Math.max(8, cellSize * 0.48));
	const rowStep = $derived(rowSlot(puzzle) * cellSize);
	const colStep = $derived(COLUMN_SLOT * cellSize);

	/** The cell the highlighted row and column go through: the cursor's, else the mouse's. */
	const focus = $derived(
		!blank && settings.highlightLines ? (pending?.end ?? cursor ?? (hover >= 0 ? hover : -1)) : -1
	);

	/** The numbers of each line, with where they go; a line without blocks shows a 0. */
	const numbers = $derived.by(() => {
		const out: { key: string; x: number; y: number; text: number; line: number; block: number }[] =
			[];
		puzzle.rows.forEach((clue, r) => {
			const list = clue.length ? clue : [0];
			list.forEach((b, j) => {
				out.push({
					key: `r${r}:${j}`,
					x: gx - cellSize * 0.22 - (list.length - j - 0.5) * rowStep,
					y: py(r + 0.5),
					text: b,
					line: r,
					block: j
				});
			});
		});
		puzzle.cols.forEach((clue, c) => {
			const list = clue.length ? clue : [0];
			list.forEach((b, j) => {
				out.push({
					key: `c${c}:${j}`,
					x: px(c + 0.5),
					y: gy - cellSize * 0.2 - (list.length - j - 0.5) * colStep,
					text: b,
					line: h + c,
					block: j
				});
			});
		});
		return out;
	});

	function numberInk(line: number, block: number) {
		if (blank) return colours.ink;
		if (settings.highlightErrors && a.error[line]) return errorColour;
		if (settings.dimDone && a.done[line][block]) return colours.faint;
		return colours.ink;
	}

	/** The strip of a line's numbers: left of a row, above a column. */
	function strip(line: number) {
		if (line < h) return { x: MARGIN, y: py(line), w: gx - MARGIN, h: cellSize };
		return { x: px(line - h), y: MARGIN, w: cellSize, h: gy - MARGIN };
	}

	/** Lines whose strip is tinted: the hint's, the highlighted ones, and wrong ones in red. */
	const hintLines = $derived(
		[...(area ?? [])].flatMap((key) => {
			const [kind, n] = key.split(':');
			if (n === undefined) return [];
			return [kind === 'r' ? Number(n) : h + Number(n)];
		})
	);

	/** Win animation: each group of filled cells in a colour of its own. */
	const celebration = $derived(
		celebrate && !blank ? celebrationFills(pictureRegions(puzzle, shown.cells), w, h) : null
	);

	function cellFill(cell: number) {
		const m = shown.cells[cell];
		if (m !== FILLED) return null;
		if (celebration) return celebration[cell];
		return trial?.has(String(cell)) ? colours.trialShade : colours.line;
	}

	/** Lines every 5 cells are drawn thicker, as on paper, so counting is easy. */
	const thick = (k: number, n: number) => k > 0 && k < n && k % 5 === 0;
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

	<!-- The highlighted row and column, through the grid and their numbers -->
	{#if focus >= 0}
		<g fill={colours.unit} aria-hidden="true">
			{#each [Math.floor(focus / w), h + (focus % w)] as line (line)}
				{@const s = strip(line)}
				<rect x={s.x} y={s.y} width={s.w} height={s.h} />
				{#if line < h}
					<rect x={px(0)} y={s.y} width={w * cellSize} height={cellSize} />
				{:else}
					<rect x={s.x} y={py(0)} width={cellSize} height={h * cellSize} />
				{/if}
			{/each}
		</g>
	{/if}

	<!-- Lines whose marks break their numbers -->
	{#if !blank && settings.highlightErrors}
		<g fill={errorFill} aria-hidden="true">
			{#each a.error as wrong, line (line)}
				{#if wrong}
					{@const s = strip(line)}
					<rect x={s.x} y={s.y} width={s.w} height={s.h} />
				{/if}
			{/each}
		</g>
	{/if}

	{#if area?.size && !blank}
		<g class="area" fill={colours.cursor} fill-opacity="0.2" aria-hidden="true">
			{#each [...area] as key (key)}
				{#if !key.includes(':')}
					{@const cell = Number(key)}
					<rect x={px(cell % w)} y={py(Math.floor(cell / w))} width={cellSize} height={cellSize} />
				{/if}
			{/each}
			{#each hintLines as line (line)}
				{@const s = strip(line)}
				<rect x={s.x} y={s.y} width={s.w} height={s.h} />
			{/each}
		</g>
	{/if}

	<!-- Filled cells and crosses -->
	{#if !blank}
		{#each shown.cells as m, cell (cell)}
			{@const x = px(cell % w)}
			{@const y = py(Math.floor(cell / w))}
			{#if m === FILLED}
				<rect data-filled={cell} {x} {y} width={cellSize} height={cellSize} fill={cellFill(cell)} />
			{:else if m === CROSS}
				{@const s = cellSize * 0.22}
				<path
					data-cross={cell}
					d="M{x + cellSize / 2 - s} {y + cellSize / 2 - s}l{2 * s} {2 * s}m0 {-2 * s}l{-2 * s} {2 *
						s}"
					stroke={trial?.has(String(cell)) ? colours.trial : colours.cross}
					stroke-width={Math.max(1.5, cellSize * 0.06)}
					stroke-linecap="round"
				/>
			{/if}
		{/each}
	{/if}

	<!-- Grid: thin lines between the cells, thicker ones every 5 and around the grid -->
	<g stroke={colours.gridLine} stroke-width="1" opacity="0.55" aria-hidden="true">
		{#each { length: w - 1 } as _, c (c)}
			{#if !thick(c + 1, w)}
				<line x1={px(c + 1)} y1={py(0)} x2={px(c + 1)} y2={py(h)} />
			{/if}
		{/each}
		{#each { length: h - 1 } as _, r (r)}
			{#if !thick(r + 1, h)}
				<line x1={px(0)} y1={py(r + 1)} x2={px(w)} y2={py(r + 1)} />
			{/if}
		{/each}
	</g>
	<g stroke={colours.line} stroke-width="2" aria-hidden="true">
		{#each { length: w - 1 } as _, c (c)}
			{#if thick(c + 1, w)}
				<line x1={px(c + 1)} y1={py(0)} x2={px(c + 1)} y2={py(h)} />
			{/if}
		{/each}
		{#each { length: h - 1 } as _, r (r)}
			{#if thick(r + 1, h)}
				<line x1={px(0)} y1={py(r + 1)} x2={px(w)} y2={py(r + 1)} />
			{/if}
		{/each}
	</g>
	<rect
		x={px(0)}
		y={py(0)}
		width={w * cellSize}
		height={h * cellSize}
		fill="none"
		stroke={colours.line}
		stroke-width="2.5"
	/>

	<!-- The numbers -->
	<g font-size={fontSize} font-weight="600" text-anchor="middle" dominant-baseline="central">
		{#each numbers as n (n.key)}
			<text data-clue={lineKey(puzzle, n.line)} x={n.x} y={n.y} fill={numberInk(n.line, n.block)}
				>{n.text}</text
			>
		{/each}
	</g>

	{#if !blank && settings.highlightLastChange}
		<g fill="none" stroke={colours.recent} stroke-width="1.5">
			{#each [...lastChange] as key (key)}
				{@const cell = Number(key)}
				<rect
					x={px(cell % w) + 2.5}
					y={py(Math.floor(cell / w)) + 2.5}
					width={cellSize - 5}
					height={cellSize - 5}
				/>
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
				{@const cell = Number(key)}
				<rect
					x={px(cell % w) + spotInset}
					y={py(Math.floor(cell / w)) + spotInset}
					width={cellSize - 2 * spotInset}
					height={cellSize - 2 * spotInset}
					rx={spotWidth * 1.5}
				/>
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

	<!-- How many cells the move under way spans, above its last one -->
	{#if pending && pending.end !== pending.start}
		{@const line = strokeLine(pending, w)}
		{@const last = line[line.length - 1]}
		{@const x = px((last % w) + 0.5)}
		{@const y = py(Math.floor(last / w)) - cellSize * 0.4}
		<g aria-hidden="true">
			<rect
				x={x - cellSize * 0.4}
				y={y - cellSize * 0.3}
				width={cellSize * 0.8}
				height={cellSize * 0.6}
				rx={cellSize * 0.15}
				fill={colours.cursor}
			/>
			<text
				{x}
				{y}
				fill={colours.surface}
				font-size={fontSize * 0.85}
				font-weight="700"
				text-anchor="middle"
				dominant-baseline="central">{line.length}</text
			>
		</g>
	{/if}

	{#if settings.showCoordinates && !blank}
		<g
			fill={colours.label}
			font-size={labelFontSize(pad)}
			text-anchor="middle"
			dominant-baseline="central"
		>
			{#each { length: w } as _, c (c)}
				<text x={px(c + 0.5)} y={py(h) + pad / 2}>{columnLabel(c)}</text>
			{/each}
			{#each { length: h } as _, r (r)}
				<text x={px(w) + pad / 2} y={py(r + 0.5)}>{r + 1}</text>
			{/each}
		</g>
	{/if}
</svg>
{#if keys}
	<BoardSpeech id={speechId} game="pixels" text={speech} />
{/if}
