<script lang="ts">
	import { boardPad, celebrationFills, coordinateLabels, labelFontSize } from '../../core/grid';
	import { colours } from '../../core/palette';
	import type { BoardProps, KeyPress } from '../../core/types';
	import { boardInput, interpolate, touchAction, type BoardPoint } from '../../client/boardInput';
	import { KeyCursor } from '../../client/keyCursor.svelte';
	import { nextMark } from '../../client/marks';
	import BoardSpeech from '../../components/game/BoardSpeech.svelte';
	import { t } from '../../i18n/index.svelte';
	import type { PipesSettingKey } from './settings';
	import { sayTile } from './speech';
	import {
		analyze,
		connections,
		dealt,
		JOIN,
		markable,
		markAt,
		markKey,
		markList,
		neighboursOf,
		parseMarkKey,
		sourceOf,
		turn,
		turnToMarks,
		unfitTiles,
		withMark,
		withMarks,
		type PipesPuzzle,
		type PipesState
	} from './rules';
	import { nearestSide, quartersBetween, spinFrom, tilePath, waterRings } from './draw';

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

	/**
	 * Marks set by a click, a drag or the keys: "=", or "x" with the right button (`inverse`). A
	 * click marks the side nearest to where it began (`at`); a drag the sides it crosses from tile
	 * to tile, all set as the first one decides (`status`), so that a drag can clear them too.
	 */
	type MarkMove = {
		kind: 'mark';
		inverse: boolean;
		at: BoardPoint | null;
		/** The tile the drag is in. */
		last: number;
		sides: [number, number][];
		status: number;
	};
	/** A move under way: a turn of one tile, locks set or cleared on the tiles dragged over, marks. */
	type Pending =
		| { kind: 'turn'; cell: number; quarters: number }
		| { kind: 'lock'; cells: number[]; value: number }
		| MarkMove;
	let pending = $state.raw<Pending | null>(null);

	/** The board with a drag under way applied, as a preview; the dealt tiles for printing. */
	const shown = $derived.by((): PipesState => {
		if (blank) return { tiles: base, locks: base.map(() => 0) };
		if (pending?.kind === 'mark') return applyMarks(board, pending).state;
		if (pending?.kind !== 'lock') return board;
		const locks = board.locks.slice();
		for (const c of pending.cells) locks[c] = pending.value;
		return { ...board, locks };
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

	/**
	 * Turn a tile, with the setting only into a way that keeps to its marks (skipping the others).
	 * A locked tile shakes, and so does one that lies the only way that keeps to them.
	 */
	function turnTile(cell: number, quarters: number) {
		if (readonly || cell < 0) return;
		const toMarks = settings.turnToMarks ? turnToMarks(puzzle, board, cell, quarters) : null;
		if (board.locks[cell] || toMarks === 0) {
			shake = { cell, n: (shake?.n ?? 0) + 1 };
			return;
		}
		const by = toMarks ?? quarters;
		const tiles = board.tiles.slice();
		tiles[cell] = turn(tiles[cell], by);
		turnedBy.set(cell, by);
		onmove({ ...board, tiles }, [String(cell)]);
	}

	function beginLock(cell: number) {
		if (readonly || cell < 0) return;
		pending = { kind: 'lock', cells: [cell], value: board.locks[cell] ? 0 : 1 };
	}

	function extendLock(cell: number) {
		if (pending?.kind !== 'lock' || cell < 0 || pending.cells.includes(cell)) return;
		pending = { ...pending, cells: [...pending.cells, cell] };
	}

	/** The side of a tile nearest to (x, y) that takes a mark, as `[tile, side]`, or null. */
	function sideAt(x: number, y: number): [number, number] | null {
		const cell = cellAt(x, y);
		const k = nearestSide(x - (cell % w), y - Math.floor(cell / w));
		return k !== null && markable(puzzle, cell, k) ? [cell, k] : null;
	}

	function beginMark(cell: number, inverse: boolean, at: BoardPoint | null) {
		if (readonly || cell < 0) return;
		pending = { kind: 'mark', inverse, at, last: cell, sides: [], status: JOIN };
	}

	/** A drag or the keys went on into tile `to`: the side crossed on the way gets marked. */
	function extendMark(to: number) {
		if (pending?.kind !== 'mark' || to === pending.last) return;
		const from = pending.last;
		const nb = neighboursOf(puzzle);
		const k = [0, 1, 2, 3].find((k) => nb[from * 4 + k] === to);
		const key = k === undefined ? null : markKey(puzzle, from, k);
		const p = pending;
		if (k === undefined || p.sides.some(([c, side]) => markKey(puzzle, c, side) === key)) {
			pending = { ...p, last: to };
			return;
		}
		const status = p.sides.length
			? p.status
			: nextMark('mark', markAt(puzzle, board.marks, from, k), p.inverse);
		pending = { ...p, last: to, sides: [...p.sides, [from, k]], status };
	}

	/** `s` with a mark move applied, and the keys of the sides it changes. */
	function applyMarks(s: PipesState, p: MarkMove): { state: PipesState; changed: string[] } {
		let { sides, status } = p;
		if (!sides.length) {
			const side = p.at && sideAt(p.at.x, p.at.y);
			if (!side) return { state: s, changed: [] };
			sides = [side];
			status = nextMark('mark', markAt(puzzle, s.marks, side[0], side[1]), p.inverse);
		}
		let marks = s.marks;
		const changed: string[] = [];
		for (const [c, k] of sides) {
			if (markAt(puzzle, marks, c, k) === status) continue;
			marks = withMark(puzzle, marks, c, k, status);
			changed.push(markKey(puzzle, c, k));
		}
		return { state: changed.length ? withMarks(s, marks) : s, changed };
	}

	function commit() {
		const p = pending;
		pending = null;
		if (!p) return;
		if (p.kind === 'turn') return turnTile(p.cell, p.quarters);
		if (p.kind === 'mark') {
			const { state, changed } = applyMarks(board, p);
			if (changed.length) onmove(state, changed);
			return;
		}
		const locks = board.locks.slice();
		const changed: string[] = [];
		for (const c of p.cells) {
			if (locks[c] !== p.value) changed.push(String(c));
			locks[c] = p.value;
		}
		if (changed.length) onmove({ ...board, locks }, changed);
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
		if (pending?.kind !== 'lock' && pending?.kind !== 'mark') return;
		for (const p of interpolate(from, to, 4)) {
			if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue;
			extendLock(cellAt(p.x, p.y));
			extendMark(cellAt(p.x, p.y));
		}
	}

	// ---- Pointer: click turns, Shift+click turns back, right click or Ctrl locks ------------------
	// With the Note tool, a click marks the nearest side "=", a right click "x".

	const input = boardInput(
		{
			start(p, how) {
				if (!how.touch) keyCursor.hide();
				if (readonly) return;
				const cell = cellAt(p.x, p.y);
				if (tool === 'note') beginMark(cell, how.inverse, p);
				else if (how.inverse || tool === 'lock') beginLock(cell);
				else pending = { kind: 'turn', cell, quarters: how.shift ? -1 : 1 };
			},
			drag: dragTo,
			end: commit,
			cancel: () => (pending = null),
			// A finger resting on a tile locks or unlocks it, unless the Lock tool already does; with
			// the Mark tool, it marks the nearest side "x", as the right button does.
			hold(p) {
				if (readonly || tool === 'lock' || p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) {
					return false;
				}
				if (tool === 'note') {
					if (!sideAt(p.x, p.y)) return false;
					beginMark(cellAt(p.x, p.y), true, p);
					commit();
					return true;
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
		// With the Note tool, it marks the sides on the way "=", and Shift with the arrows "x".
		get shiftDraws() {
			return tool === 'note';
		},
		begin(from, key) {
			if (pending || readonly) return false;
			if (tool === 'note') beginMark(from, key === 'shift', null);
			else beginLock(from);
			return true;
		},
		extend(_, to) {
			extendLock(to);
			extendMark(to);
		},
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
					water: !!settings.showWater,
					markErrors: !!settings.markErrors
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

	/** Tiles that no way of turning keeps to their marks, with the setting. */
	const unfit = $derived(
		!blank && settings.markErrors && shown.marks ? unfitTiles(puzzle, shown) : null
	);
	const unfitColour = $derived(settings.blueErrors ? colours.blueErrorFill : colours.errorFill);

	/**
	 * The marks, each where its side lies: its middle and which way a pipe crosses it there. With
	 * wrap, a side across the edge of the board shows on both edges.
	 */
	const marks = $derived.by(() => {
		if (blank) return [];
		const out: { key: string; x: number; y: number; across: boolean; mark: number }[] = [];
		for (const [c, k, mark] of markList(shown.marks)) {
			const key = markKey(puzzle, c, k);
			const r = Math.floor(c / w);
			const col = c % w;
			const across = k === 1;
			const x = across ? px(col + 1) : px(col + 0.5);
			const y = across ? py(r + 0.5) : py(r + 1);
			out.push({ key, x, y, across, mark });
			if (across && col === w - 1) out.push({ key, x: px(0), y, across, mark });
			if (!across && r === h - 1) out.push({ key, x, y: py(0), across, mark });
		}
		return out;
	});
	/** The "=": two short lines along the pipe's way across the side, just outside its walls. */
	const joinGap = $derived(outer / 2 + Math.max(2, cellSize * 0.05));
	const joinLength = $derived(cellSize * 0.15);
	const markStroke = $derived(Math.max(1.5, cellSize * 0.045));
	const markColour = (key: string, mark: number) =>
		trial?.has(key) ? colours.trial : mark === JOIN ? colours.joinMark : colours.cross;

	/**
	 * Where a highlight goes, `inset` inside it: a tile, or a box around the middle of a side for
	 * a mark's key.
	 */
	function boxOf(key: string, inset: number) {
		const side = parseMarkKey(key);
		if (!side) {
			const i = Number(key);
			const size = cellSize - 2 * inset;
			return { x: px(i % w) + inset, y: py(Math.floor(i / w)) + inset, size };
		}
		const r = Math.floor(side.cell / w);
		const col = side.cell % w;
		const x = side.side === 1 ? px(col + 1) : px(col + 0.5);
		const y = side.side === 1 ? py(r + 0.5) : py(r + 1);
		const size = cellSize * 0.6 - inset;
		return { x: x - size / 2, y: y - size / 2, size };
	}

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
		{#if unfit?.[c]}
			<rect
				data-unfit={c}
				x={px(c % w)}
				y={py(Math.floor(c / w))}
				width={cellSize}
				height={cellSize}
				fill={unfitColour}
			/>
		{:else if locked}
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

	<!-- The marks on the sides between tiles: they stay put while the tiles turn -->
	{#each marks as m (`${m.key}:${m.x}:${m.y}`)}
		{@const colour = markColour(m.key, m.mark)}
		<g
			class="mark"
			data-mark={m.key}
			data-value={m.mark === JOIN ? 'join' : 'cross'}
			transform="translate({m.x} {m.y})"
		>
			{#if m.mark === JOIN}
				{#each [-joinGap, joinGap] as off (off)}
					<path
						d={m.across
							? `M${-joinLength} ${off}h${2 * joinLength}`
							: `M${off} ${-joinLength}v${2 * joinLength}`}
						stroke={colour}
						stroke-width={markStroke}
						stroke-linecap="round"
					/>
				{/each}
			{:else}
				{@const r = cellSize * 0.09}
				<path
					d="M{-r} {-r}l{2 * r} {2 * r}m0 {-2 * r}l{-2 * r} {2 * r}"
					stroke={colours.surface}
					stroke-width={markStroke + 3}
					stroke-linecap="round"
				/>
				<path
					d="M{-r} {-r}l{2 * r} {2 * r}m0 {-2 * r}l{-2 * r} {2 * r}"
					stroke={colour}
					stroke-width={markStroke}
					stroke-linecap="round"
				/>
			{/if}
		</g>
	{/each}

	{#if !blank && settings.highlightLastChange}
		<g fill="none" stroke={colours.recent} stroke-width="1.5">
			{#each [...lastChange] as key (key)}
				{@const box = boxOf(key, 2.5)}
				<rect x={box.x} y={box.y} width={box.size} height={box.size} />
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
				{@const box = boxOf(key, 4)}
				<rect
					x={box.x}
					y={box.y}
					width={box.size}
					height={box.size}
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
