<script lang="ts">
	import { boardPad, celebrationFills, coordinateLabels, labelFontSize } from '../../core/grid';
	import { colours } from '../../core/palette';
	import type { BoardProps, KeyPress } from '../../core/types';
	import { boardInput, interpolate, touchAction, type BoardPoint } from '../../client/boardInput';
	import { KeyCursor } from '../../client/keyCursor.svelte';
	import BoardSpeech from '../../components/game/BoardSpeech.svelte';
	import { t } from '../../i18n/index.svelte';
	import type { PipesSettingKey } from './settings';
	import { sayTile } from './speech';
	import {
		analyze,
		connections,
		dealt,
		neighboursOf,
		sourceOf,
		turn,
		type PipesPuzzle,
		type PipesState
	} from './rules';
	import { quartersBetween, spinFrom, tilePath, waterRings } from './draw';

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
	}: BoardProps<PipesPuzzle, PipesState, PipesSettingKey> = $props();

	const w = $derived(puzzle.width);
	const h = $derived(puzzle.height);
	/** With wrap, the pipes that cross the edge stick out a little: room for them. */
	const pad = $derived(
		boardPad(cellSize, settings.showCoordinates && !blank, puzzle.wrap ? cellSize * 0.2 : 3)
	);
	const width = $derived(w * cellSize + 2 * pad);
	const height = $derived(h * cellSize + 2 * pad);
	const base = $derived(dealt(puzzle));
	const source = $derived(sourceOf(puzzle));
	const errorColour = $derived(settings.blueErrors ? colours.blueError : colours.error);

	/** A move under way: a turn of one tile, or locks set or cleared on the tiles dragged over. */
	type Pending =
		| { kind: 'turn'; cell: number; quarters: number }
		| { kind: 'lock'; cells: number[]; value: number };
	let pending = $state.raw<Pending | null>(null);

	/** The board with a lock drag under way applied, as a preview; the dealt tiles for printing. */
	const shown = $derived.by((): PipesState => {
		if (blank) return { tiles: base, locks: base.map(() => 0) };
		if (pending?.kind !== 'lock') return board;
		const locks = board.locks.slice();
		for (const c of pending.cells) locks[c] = pending.value;
		return { tiles: board.tiles, locks };
	});
	const a = $derived(analyze(puzzle, shown.tiles, shown.locks));

	// ---- Turning, as the board draws it ------------------------------------------------------

	/**
	 * Quarter turns of each tile from the way it was dealt, counted on without wrapping round, so
	 * that a tile turned again while it still turns goes on in the same direction.
	 */
	let spins: number[] = [];
	let spinsOf: { puzzle: PipesPuzzle; tiles: readonly number[] } | null = null;
	/** Which way the board's own last move turned each tile, for the animation. */
	const turnedBy = new Map<number, number>();
	const spin = $derived.by(() => {
		const tiles = shown.tiles;
		if (spinsOf?.puzzle !== puzzle || spins.length !== tiles.length) {
			spins = spinFrom(base, tiles);
		} else if (spinsOf.tiles !== tiles) {
			spins = spins.map((q, c) => {
				const before = turn(base[c], q);
				return before === tiles[c] ? q : q + (turnedBy.get(c) ?? quartersBetween(before, tiles[c]));
			});
		}
		spinsOf = { puzzle, tiles };
		turnedBy.clear();
		return spins;
	});

	/** A locked tile that was clicked shakes briefly instead of turning. */
	let shake = $state.raw<{ cell: number; n: number } | null>(null);

	// ---- Moves --------------------------------------------------------------------------------

	function turnTile(cell: number, quarters: number) {
		if (readonly || cell < 0) return;
		if (board.locks[cell]) {
			shake = { cell, n: (shake?.n ?? 0) + 1 };
			return;
		}
		const tiles = board.tiles.slice();
		tiles[cell] = turn(tiles[cell], quarters);
		turnedBy.set(cell, quarters);
		onmove({ tiles, locks: board.locks }, [String(cell)]);
	}

	function beginLock(cell: number) {
		if (readonly || cell < 0) return;
		pending = { kind: 'lock', cells: [cell], value: board.locks[cell] ? 0 : 1 };
	}

	function extendLock(cell: number) {
		if (pending?.kind !== 'lock' || cell < 0 || pending.cells.includes(cell)) return;
		pending = { ...pending, cells: [...pending.cells, cell] };
	}

	function commit() {
		const p = pending;
		pending = null;
		if (!p) return;
		if (p.kind === 'turn') return turnTile(p.cell, p.quarters);
		const locks = board.locks.slice();
		const changed: string[] = [];
		for (const c of p.cells) {
			if (locks[c] !== p.value) changed.push(String(c));
			locks[c] = p.value;
		}
		if (changed.length) onmove({ tiles: board.tiles, locks }, changed);
	}

	function toggleLock(cell: number) {
		beginLock(cell);
		commit();
	}

	function cellAt(x: number, y: number): number {
		const c = Math.min(w - 1, Math.max(0, Math.floor(x)));
		const r = Math.min(h - 1, Math.max(0, Math.floor(y)));
		return r * w + c;
	}

	function dragTo(to: BoardPoint, from: BoardPoint) {
		if (pending?.kind !== 'lock') return;
		for (const p of interpolate(from, to, 4)) {
			if (p.x >= 0 && p.y >= 0 && p.x < w && p.y < h) extendLock(cellAt(p.x, p.y));
		}
	}

	// ---- Pointer: click turns, Shift+click turns back, right click or Ctrl locks ------------------

	const input = boardInput(
		{
			start(p, how) {
				if (!how.touch) keyCursor.hide();
				if (readonly) return;
				const cell = cellAt(p.x, p.y);
				if (how.inverse || tool === 'lock') beginLock(cell);
				else pending = { kind: 'turn', cell, quarters: how.shift ? -1 : 1 };
			},
			drag: dragTo,
			end: commit,
			cancel: () => (pending = null),
			// A finger resting on a tile locks or unlocks it, unless the Lock tool already does.
			hold(p) {
				if (readonly || tool === 'lock' || p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) {
					return false;
				}
				pending = null;
				toggleLock(cellAt(p.x, p.y));
				return true;
			}
		},
		{
			layout: () => ({ width, pad, cellSize }),
			touchMode: () => touchMode,
			enabled: (touch) => !blank && !(touch && readonly)
		}
	);

	// ---- Keyboard: a cursor on the tiles ------------------------------------------------------

	const keyCursor = new KeyCursor<number>({
		first: () => source,
		step(at, rows, cols) {
			const r = Math.floor(at / w) + rows;
			const c = (at % w) + cols;
			return r < 0 || r >= h || c < 0 || c >= w ? null : r * w + c;
		},
		// Ctrl or ⌘ with the arrows locks the tiles on the way, as dragging with the right button.
		begin(from) {
			if (pending || readonly) return false;
			beginLock(from);
			return true;
		},
		extend: (_, to) => extendLock(to),
		commit,
		cancel: () => (pending = null),
		press(at) {
			if (tool === 'lock') toggleLock(at);
			else turnTile(at, 1);
		}
	});
	const cursor = $derived(keyCursor.at);
	/** For screen readers: the tile under the cursor. */
	const speech = $derived(
		keys && cursor != null && !blank
			? sayTile(puzzle, shown, a, cursor, {
					errors: !!settings.highlightErrors,
					water: !!settings.showWater
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
					turnTile(at, -1);
					return true;
				}
				if (at != null && plain && e.key.toLowerCase() === 'l') {
					e.preventDefault();
					toggleLock(at);
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
	/** The pipe: its inside, its walls, and both together. */
	const inner = $derived(Math.max(3, cellSize * 0.18));
	const wall = $derived(Math.max(1, cellSize * 0.045));
	const outer = $derived(inner + 2 * wall);
	const water = $derived(!blank && settings.showWater);
	const showErrors = $derived(!blank && settings.highlightErrors);

	const wallColour = (c: number) => (trial?.has(String(c)) ? colours.trial : colours.line);
	const fillColour = (c: number) => (water && a.water[c] ? colours.water : colours.surface);

	/** The sides of tile `c` that are wrong, as the arms of the tile as dealt. */
	function errorArms(c: number): number {
		if (!showErrors || !a.errors[c]) return 0;
		return turn(a.errors[c], -spin[c]);
	}

	/** With wrap: the pipes that leave the board, as stubs beyond its edge. */
	const stubs = $derived.by(() => {
		if (!puzzle.wrap || blank) return [];
		const out: { c: number; x: number; y: number; dx: number; dy: number }[] = [];
		const len = Math.min(pad, cellSize * 0.14);
		shown.tiles.forEach((mask, c) => {
			const r = Math.floor(c / w);
			const col = c % w;
			const cx = px(col + 0.5);
			const cy = py(r + 0.5);
			if (r === 0 && mask & 1) out.push({ c, x: cx, y: py(0), dx: 0, dy: -len });
			if (col === w - 1 && mask & 2) out.push({ c, x: px(w), y: cy, dx: len, dy: 0 });
			if (r === h - 1 && mask & 4) out.push({ c, x: cx, y: py(h), dx: 0, dy: len });
			if (col === 0 && mask & 8) out.push({ c, x: px(0), y: cy, dx: -len, dy: 0 });
		});
		return out;
	});

	/** Win animation: rings of water spreading from the source, in turn colours. */
	const celebrationFill = $derived.by(() => {
		if (!celebrate || blank) return null;
		const rings = waterRings(neighboursOf(puzzle), connections(puzzle, shown.tiles), source);
		return celebrationFills(rings, w, h);
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
	class="board-focus block touch-manipulation select-none [&_*]:pointer-events-none"
	style:touch-action={touchAction(touchMode)}
	role="application"
	tabindex={keys ? 0 : -1}
	aria-label={t('game.board')}
	aria-describedby={keys ? speechId : undefined}
	{@attach input}
>
	<rect x={px(0)} y={py(0)} width={w * cellSize} height={h * cellSize} fill={colours.surface} />
	{#each shown.locks as locked, c (c)}
		{#if locked}
			<rect
				x={px(c % w)}
				y={py(Math.floor(c / w))}
				width={cellSize}
				height={cellSize}
				fill={colours.locked}
			/>
		{/if}
	{/each}

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
				{@const i = Number(key)}
				<rect x={px(i % w)} y={py(Math.floor(i / w))} width={cellSize} height={cellSize} />
			{/each}
		</g>
	{/if}

	<!-- Thin cell lines; with wrap, the frame is dashed: the board goes on across it -->
	<g stroke={colours.gridLine} stroke-width="1" opacity="0.4">
		{#each { length: w - 1 } as _, c (c)}
			<line x1={px(c + 1)} y1={py(0)} x2={px(c + 1)} y2={py(h)} />
		{/each}
		{#each { length: h - 1 } as _, r (r)}
			<line x1={px(0)} y1={py(r + 1)} x2={px(w)} y2={py(r + 1)} />
		{/each}
	</g>
	<rect
		x={px(0)}
		y={py(0)}
		width={w * cellSize}
		height={h * cellSize}
		fill="none"
		stroke={puzzle.wrap ? colours.gridLine : colours.line}
		stroke-width={puzzle.wrap ? 1.5 : 2}
		stroke-dasharray={puzzle.wrap ? '6 4' : undefined}
	/>

	<!-- Pipes beyond the edge of a board with wrap -->
	{#each stubs as s (`${s.c}:${s.dx}:${s.dy}`)}
		<path
			d="M{s.x} {s.y}l{s.dx} {s.dy}"
			stroke={wallColour(s.c)}
			stroke-width={outer}
			fill="none"
		/>
		<path
			d="M{s.x} {s.y}l{s.dx} {s.dy}"
			stroke={fillColour(s.c)}
			stroke-width={inner}
			fill="none"
		/>
	{/each}

	<!-- The tiles: each drawn as dealt and turned into place, so that it can turn smoothly -->
	{#each base as mask, c (c)}
		{@const errors = errorArms(c)}
		{@const shaking = shake?.cell === c}
		<g
			transform="translate({px((c % w) + 0.5)} {py(Math.floor(c / w) + 0.5)})"
			data-tile={c}
			data-mask={shown.tiles[c]}
			data-locked={shown.locks[c] || undefined}
			data-water={water && a.water[c] ? true : undefined}
		>
			{#key shaking ? shake!.n : 0}
				<g class:shake={shaking}>
					<g
						class:spin={settings.animateRotation && !blank}
						style:transform="rotate({spin[c] * 90}deg)"
					>
						<path
							d={tilePath(mask, cellSize / 2)}
							stroke={wallColour(c)}
							stroke-width={outer}
							stroke-linejoin="round"
							fill="none"
						/>
						{#each [0, 1, 2, 3] as k (k)}
							{#if errors & (1 << k)}
								<path
									class="pipe-error"
									d={tilePath(1 << k, cellSize / 2)}
									stroke={errorColour}
									stroke-width={outer}
									fill="none"
								/>
							{/if}
						{/each}
						<path
							d={tilePath(mask, cellSize / 2)}
							stroke={fillColour(c)}
							stroke-width={inner}
							stroke-linejoin="round"
							fill="none"
						/>
						{#if (mask & (mask - 1)) === 0 && c !== source}
							<!-- An end: a ring where the pipe stops -->
							<circle
								r={cellSize * 0.2}
								fill={fillColour(c)}
								stroke={errors ? errorColour : wallColour(c)}
								stroke-width={wall}
							/>
						{/if}
					</g>
				</g>
			{/key}
			{#if c === source}
				<circle
					r={cellSize * 0.24}
					fill={colours.source}
					stroke={wallColour(c)}
					stroke-width={wall}
				/>
				<circle r={cellSize * 0.07} fill={colours.surface} />
			{/if}
			{#if shown.locks[c] && cellSize >= 20}
				<!-- A small padlock in the corner -->
				{@const s = cellSize * 0.1}
				<g
					transform="translate({cellSize / 2 - 1.6 * s} {-cellSize / 2 + 1.7 * s})"
					fill={colours.label}
					stroke={colours.label}
				>
					<rect x={-s * 0.7} y={-s * 0.1} width={s * 1.4} height={s} rx={s * 0.15} stroke="none" />
					<path
						d="M{-s * 0.42} {-s * 0.1}v{-s * 0.3}a{s * 0.42} {s * 0.42} 0 0 1 {s * 0.84} 0v{s *
							0.3}"
						fill="none"
						stroke-width={Math.max(1, s * 0.22)}
					/>
				</g>
			{/if}
		</g>
	{/each}

	{#if !blank && settings.highlightLastChange}
		<g fill="none" stroke={colours.recent} stroke-width="1.5">
			{#each [...lastChange] as key (key)}
				{@const i = Number(key)}
				<rect
					x={px(i % w) + 2.5}
					y={py(Math.floor(i / w)) + 2.5}
					width={cellSize - 5}
					height={cellSize - 5}
				/>
			{/each}
		</g>
	{/if}

	{#if spotlight?.size && !blank}
		<g
			class="spotlight"
			data-mistake={mistake || undefined}
			fill="none"
			stroke={mistake ? errorColour : colours.cursor}
			stroke-width="3"
			aria-hidden="true"
		>
			{#each [...spotlight] as key (key)}
				{@const i = Number(key)}
				<rect
					x={px(i % w) + 4}
					y={py(Math.floor(i / w)) + 4}
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
	<BoardSpeech id={speechId} game="pipes" text={speech} />
{/if}

<style>
	.spin {
		transition: transform 120ms ease-out;
	}
	.shake {
		animation: shake 150ms ease-in-out;
	}
	@keyframes shake {
		25% {
			transform: rotate(-8deg);
		}
		75% {
			transform: rotate(8deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			transition: none;
		}
		.shake {
			animation: none;
		}
	}
</style>
