<script lang="ts" module>
	import { colours } from '../../core/palette';

	/** Note colours 1–9 (spec 10.2). Index 0 = none. */
	export const NOTE_COLOURS = [
		'',
		colours.note1,
		colours.note2,
		colours.note3,
		colours.note4,
		colours.note5,
		colours.note6,
		colours.note7,
		colours.note8,
		colours.note9
	];
</script>

<script lang="ts">
	import {
		boardPad,
		celebrationFills,
		coordinateLabels,
		labelFontSize,
		neighbours
	} from '../../core/grid';
	import type { BoardProps, KeyPress } from '../../core/types';
	import type { PinwheelSettingKey } from './settings';
	import { boardInput, interpolate, touchAction, type BoardPoint } from '../../client/boardInput';
	import { EdgeInput, edgeKey, parseEdge, type Edge, type EdgeMove } from '../../client/edgeInput';
	import { KeyCursor } from '../../client/keyCursor.svelte';
	import { nextMark } from '../../client/marks';
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
	import type { Dot } from '../../core/path';
	import { theme } from '../../client/settings.svelte';
	import { t } from '../../i18n/index.svelte';
	import { sayDot } from './speech';
	import BoardSpeech from '../../components/game/BoardSpeech.svelte';

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
		keys,
		celebrate = false,
		touchMode,
		onmove,
		spotlight,
		mistake,
		area,
		trial
	}: BoardProps<PinwheelPuzzle, PinwheelState, PinwheelSettingKey> = $props();

	/** A move under way: lines or crosses on the edges, colour on cells, or a hold on a centre. */
	type Pending =
		| (EdgeMove & { kind: 'edges' })
		| { kind: 'cells'; colour: number; cells: number[] }
		| { kind: 'centre'; k: number; cell: number };

	const w = $derived(puzzle.width);
	const h = $derived(puzzle.height);
	const pad = $derived(boardPad(cellSize, settings.showCoordinates && !blank, cellSize * 0.2));
	const width = $derived(w * cellSize + 2 * pad);
	const height = $derived(h * cellSize + 2 * pad);
	const errorColour = $derived(settings.blueErrors ? colours.blueErrorCell : colours.errorCell);
	/** Wrong marks a hint points at. */
	const mistakeColour = $derived(settings.blueErrors ? colours.blueError : colours.error);

	let pending = $state.raw<Pending | null>(null);
	let shiftHeld = $state(false);
	const activeTool = $derived(shiftHeld ? (tool === 'color' ? 'black' : 'color') : tool);

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

	const edges = new EdgeInput({
		size: () => ({ width: w, height: h }),
		continuous: () => settings.continuousLine,
		// Edges through a centre, and those of a locked galaxy, stay as they are.
		statusOf: (e, inverse) =>
			editable(e) ? nextMark(activeTool, getEdge(board, e), inverse) : null
	});

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
			return helper.mirror < 0 ? errorColour : colours.selection;
		}
		if (settings.highlightErrors && a.cellError[i]) return errorColour;
		const auto = autoColours.get(a.region[i]);
		if (auto) return NOTE_COLOURS[auto];
		return NOTE_COLOURS[shown.colors[i]] || 'transparent';
	}

	// ---- Applying moves -------------------------------------------------------------------------

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
			for (const key of edges.edgesOf(p)) {
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

	/** Only a complete region can be locked; a locked one can always be unlocked. */
	function canToggleLock(k: number) {
		if (board.locks[k]) return true;
		const live = analyze(puzzle, board);
		return live.complete[live.centreRegion[k]];
	}

	function toggleLock(k: number) {
		if (readonly || !canToggleLock(k)) return;
		const locks = board.locks.slice();
		locks[k] = locks[k] ? 0 : 1;
		onmove({ ...board, locks }, [`g:${k}`]);
	}

	// ---- Targeting ------------------------------------------------------------------------------

	function centreAt(x: number, y: number): number {
		return puzzle.centres.findIndex(
			([hr, hc]) => Math.hypot(x - (hc / 2 + 0.5), y - (hr / 2 + 0.5)) < 0.22
		);
	}

	function cellAt(x: number, y: number): number {
		if (x < 0 || y < 0 || x >= w || y >= h) return -1;
		return Math.floor(y) * w + Math.floor(x);
	}

	// ---- Pointer --------------------------------------------------------------------------------

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
		// A move begun on a blocked or fixed edge changes nothing.
		const move = fromKeyboard
			? edges.beginAt(edges.nearestDot(x, y), inverse)
			: edges.begin(x, y, inverse);
		pending = move && { ...move, kind: 'edges' };
	}

	function dragTo(to: BoardPoint, from: BoardPoint) {
		const p = pending;
		if (p?.kind === 'centre') {
			pending = { ...p, cell: cellAt(to.x, to.y) };
		} else if (p?.kind === 'cells') {
			let cells = p.cells;
			for (const { x, y } of interpolate(from, to, 5)) {
				const cell = cellAt(x, y);
				if (cell >= 0 && !cells.includes(cell)) cells = [...cells, cell];
			}
			pending = { ...p, cells };
		} else if (p) {
			pending = edges.drag(p, from, to);
		}
	}

	/**
	 * Touch: quick tap acts at once, early movement pans, holding 300 ms draws, 400 ms on the
	 * centre of a complete galaxy locks it.
	 */
	const input = boardInput(
		{
			start(p, how) {
				if (!how.touch) {
					shiftHeld = how.shift;
					keyCursor.hide();
				}
				begin(p.x, p.y, how.inverse);
			},
			drag: dragTo,
			end: commit,
			cancel: () => (pending = null),
			// A hold that cannot lock keeps going, so the symmetry helper works by touch too.
			hold(p) {
				const k = centreAt(p.x, p.y);
				if (k < 0 || !canToggleLock(k)) return false;
				toggleLock(k);
				return true;
			}
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
			if (pending) return false;
			begin(from.j, from.i, false, true);
			return !!pending;
		},
		extend(from, to) {
			if (pending?.kind === 'edges') pending = edges.step(pending, from, to);
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
					blackHoles: !!settings.blackHoles
				})
			: ''
	);
	const speechId = $props.id();

	$effect(() =>
		keys?.({
			keydown(e: KeyPress) {
				if (e.key === 'Shift') shiftHeld = true;
				return !blank && keyCursor.keydown(e);
			},
			keyup(e: KeyPress) {
				if (e.key === 'Shift') shiftHeld = false;
				keyCursor.keyup(e);
			},
			blur() {
				shiftHeld = false;
				keyCursor.blur();
			}
		})
	);

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
		if (blank) return colours.surface;
		if (helper?.k === k) return colours.selection;
		if (board.locks[k]) return colours.faint;
		const complete = a.complete[a.centreRegion[k]];
		if (settings.blackHoles && complete) return colours.ink;
		if (settings.highlightErrors && a.centreError[k]) return errorColour;
		return colours.surface;
	}

	/** The Halloween look draws the centres as pumpkins; prints keep the plain circles. */
	const pumpkins = $derived(theme.look === 'halloween' && !blank);
	const solved = $derived(a.complete.every(Boolean));
	/** Unit of the pumpkin's drawing, centred on its body and 80 units wide. */
	const pumpkinScale = $derived(cellSize / 150);

	/**
	 * A pumpkin is lit from inside when its galaxy is complete, as far as black holes would show
	 * that (the same setting), and all of them once the puzzle is solved.
	 */
	const pumpkinLit = (k: number) =>
		a.complete[a.centreRegion[k]] && (!!settings.blackHoles || solved);

	function pumpkinBody(k: number) {
		if (helper?.k === k) return colours.selection;
		if (board.locks[k]) return colours.faint;
		if (settings.highlightErrors && a.centreError[k]) return errorColour;
		return colours.pumpkin;
	}

	/** Win animation: every region in its own colour for a moment. */
	const celebrationFill = $derived(celebrate && !blank ? celebrationFills(a.region, w, h) : null);
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

	<!-- Cell fills -->
	{#if !blank}
		{#each shown.colors as _, i (i)}
			{@const fill = cellFill(i)}
			{#if fill !== 'transparent'}
				<!-- Painted during a trial: paler, until the trial is kept -->
				<rect
					x={px(i % w)}
					y={py(Math.floor(i / w))}
					width={cellSize}
					height={cellSize}
					{fill}
					fill-opacity={trial?.has(`c:${i}`) ? 0.45 : undefined}
				/>
			{/if}
		{/each}
	{/if}

	{#if celebrationFill}
		<g class="celebrate-regions" aria-hidden="true">
			{#each celebrationFill as fill, i (i)}
				<rect x={px(i % w)} y={py(Math.floor(i / w))} width={cellSize} height={cellSize} {fill} />
			{/each}
		</g>
	{/if}

	<!-- Faint grid -->
	{#if settings.showGrid || blank}
		<g stroke={colours.faint} stroke-width="1" stroke-dasharray="2 3" opacity="0.6">
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
					data-trial={trial?.has(key) || undefined}
					d={edgePath(e)}
					stroke={trial?.has(key) ? colours.trial : frozen.has(key) ? colours.faint : colours.line}
					stroke-width={lineWidth}
					stroke-linecap="round"
				/>
			{:else if value === CROSS}
				{@const m = edgeMid(e)}
				{@const s = cellSize * 0.1}
				<path
					d="M{m.x - s} {m.y - s}l{2 * s} {2 * s}m0 {-2 * s}l{-2 * s} {2 * s}"
					stroke={trial?.has(key) ? colours.trial : colours.cross}
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
		stroke={colours.line}
		stroke-width={lineWidth}
	/>

	<!-- Dots -->
	<g fill={colours.dot}>
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
		<g fill="none" stroke={colours.recent} stroke-width="1.5">
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

	{#if area?.size && !blank}
		<g
			class="area"
			fill={colours.cursor}
			fill-opacity="0.2"
			pointer-events="none"
			aria-hidden="true"
		>
			{#each [...area] as key (key)}
				{#if key.startsWith('c:')}
					{@const i = Number(key.slice(2))}
					<rect x={px(i % w)} y={py(Math.floor(i / w))} width={cellSize} height={cellSize} />
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
				{:else if key.startsWith('g:')}
					{@const [hr, hc] = puzzle.centres[Number(key.slice(2))]}
					<circle cx={px(hc / 2 + 0.5)} cy={py(hr / 2 + 0.5)} r={cellSize * 0.32} />
				{:else if key.startsWith('h:') || key.startsWith('v:')}
					<!-- An edge, e.g. from a hint: a dashed frame along it -->
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

	<!-- Centres -->
	{#each puzzle.centres as [hr, hc], k (k)}
		{@const outline =
			!blank && settings.highlightLastChange && lastChange.has(`g:${k}`)
				? colours.recent
				: trial?.has(`g:${k}`)
					? colours.trial
					: colours.line}
		{#if pumpkins}
			{@const body = pumpkinBody(k)}
			{@const lit = pumpkinLit(k)}
			<g
				class="pumpkin"
				class:lit
				transform="translate({px(hc / 2 + 0.5)} {py(hr / 2 + 0.5)}) scale({pumpkinScale})"
			>
				{#if lit}
					<circle class="pumpkin-glow" r="58" fill={colours.candle} fill-opacity="0.35" />
				{/if}
				<!-- The outline: wide strokes, half covered by the fill on top -->
				<g fill="none" stroke={outline} stroke-width={4 / pumpkinScale}>
					<ellipse cx="-17" rx="23" ry="27" />
					<ellipse cx="17" rx="23" ry="27" />
					<ellipse rx="19" ry="29" />
				</g>
				<path
					d="M0 -28 C0 -36 3 -40 9 -43"
					fill="none"
					stroke={colours.stem}
					stroke-width="7"
					stroke-linecap="round"
				/>
				<g fill={body === colours.pumpkin ? colours.pumpkinShade : body}>
					<ellipse cx="-17" rx="23" ry="27" />
					<ellipse cx="17" rx="23" ry="27" />
				</g>
				<ellipse rx="19" ry="29" fill={body} />
				<g fill={lit ? colours.candle : colours.pumpkinFace}>
					<path d="M-15 -5 L-9 -15 L-3 -5 Z M3 -5 L9 -15 L15 -5 Z" />
					<path d="M-17 5 Q0 22 17 5 L13 7 L9 4 L5 9 L0 5 L-5 9 L-9 4 L-13 7 Z" />
				</g>
			</g>
		{:else}
			<circle
				cx={px(hc / 2 + 0.5)}
				cy={py(hr / 2 + 0.5)}
				r={cellSize * 0.2}
				fill={centreFill(k)}
				stroke={outline}
				stroke-width="2"
			/>
		{/if}
	{/each}

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
	<BoardSpeech id={speechId} game="pinwheel" text={speech} />
{/if}
