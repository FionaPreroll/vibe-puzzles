<script lang="ts">
	import { CELEBRATION_COLOURS, colourRegions, columnLabel } from '../../core/grid';
	import type { BoardProps } from '../../core/types';
	import { t } from '../../i18n/index.svelte';
	import {
		bit,
		boxShape,
		conflicts,
		currentGrid,
		geometry,
		mistakes,
		placeDigit,
		remainingDigits,
		toggleNote,
		type SudokuPuzzle,
		type SudokuState
	} from './rules';
	import { brokenCages, cageIndex, cageLabel, labelCell, type CalcPuzzle } from './calc/rules';
	import { solveCalc } from './calc/solver';
	import { solveSudoku } from './solver';

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
		ontool,
		onmove
	}: BoardProps<SudokuPuzzle, SudokuState> = $props();

	const size = $derived(puzzle.width);
	const box = $derived(boxShape(size));
	/** Calcudoku: cages instead of boxes. */
	const calc = $derived<CalcPuzzle | null>(
		puzzle.cages ? { width: size, height: size, cages: puzzle.cages } : null
	);
	const cageOf = $derived(calc ? cageIndex(calc) : null);
	const pad = $derived(settings.showCoordinates && !blank ? Math.max(14, cellSize * 0.6) : 3);
	const width = $derived(size * cellSize + 2 * pad);
	const height = $derived(size * cellSize + 2 * pad);
	const digits = $derived(Array.from({ length: size }, (_, k) => k + 1));

	/** Selected cell, -1 for none. */
	let selected = $state(-1);

	const grid = $derived(blank ? puzzle.givens : currentGrid(puzzle, board));
	const clashes = $derived(conflicts(size, grid, !calc));
	const errorColour = $derived(settings.blueErrors ? '#1e3a8a' : '#dc2626');
	const errorFill = $derived(settings.blueErrors ? '#dbeafe' : '#fee2e2');

	/** The solution, only worked out when wrong digits are to be shown. */
	const solution = $derived(
		settings.markMistakes && !blank
			? calc
				? solveCalc(calc, { limit: 1 }).solutions[0]
				: solveSudoku(puzzle.givens, size, { limit: 1 }).solutions[0]
			: null
	);
	const wrong = $derived(solution ? mistakes(puzzle, board, solution) : null);
	const remaining = $derived(blank ? [] : remainingDigits(puzzle, board));

	/** Digit in the selected cell, for "Highlight the same digit". */
	const selectedDigit = $derived(
		settings.highlightSame && selected >= 0 && !blank ? grid[selected] : 0
	);
	/** Row, column and (without cages) box of a cell. */
	const unitsOf = (i: number): number[] =>
		calc ? [Math.floor(i / size), size + (i % size)] : geometry(size).unitsOf[i];
	/** Units of the selected cell. */
	const selectedUnits = $derived(
		settings.highlightLines && selected >= 0 && !blank ? unitsOf(selected) : null
	);

	function inSelectedUnits(i: number): boolean {
		return !!selectedUnits && unitsOf(i).some((u, k) => u === selectedUnits[k]);
	}

	/** Cages whose cells are all filled but miss their target. */
	const broken = $derived(
		calc && settings.highlightErrors && !blank ? brokenCages(calc, grid) : null
	);

	// Auto notes: a game without any notes gets them as soon as it is shown.
	$effect(() => {
		if (!settings.autoNotes || !keyboard || blank || readonly) return;
		if (board.notes.some(Boolean) || !grid.some((d) => !d)) return;
		onmove(board, []);
	});

	const boxLines = $derived.by(() => {
		const segs: string[] = [];
		if (cageOf) {
			// Cage borders: wherever two neighbouring cells belong to different cages.
			for (let i = 0; i < size * size; i++) {
				const r = Math.floor(i / size);
				const c = i % size;
				const x = pad + c * cellSize;
				const y = pad + r * cellSize;
				if (c < size - 1 && cageOf[i] !== cageOf[i + 1]) {
					segs.push(`M${x + cellSize} ${y}v${cellSize}`);
				}
				if (r < size - 1 && cageOf[i] !== cageOf[i + size]) {
					segs.push(`M${x} ${y + cellSize}h${cellSize}`);
				}
			}
			return segs.join('');
		}
		for (let c = box.w; c < size; c += box.w) {
			segs.push(`M${pad + c * cellSize} ${pad}v${size * cellSize}`);
		}
		for (let r = box.h; r < size; r += box.h) {
			segs.push(`M${pad} ${pad + r * cellSize}h${size * cellSize}`);
		}
		return segs.join('');
	});

	function fillOf(i: number): string {
		if (blank) return '#ffffff';
		if (i === selected) return '#fde68a';
		if ((settings.highlightErrors && clashes[i]) || wrong?.[i]) return errorFill;
		if (selectedDigit && grid[i] === selectedDigit) return '#bfdbfe';
		if (inSelectedUnits(i)) return '#e5edf8';
		return '#ffffff';
	}

	function textColour(i: number): string {
		if (puzzle.givens[i]) return '#111827';
		if ((settings.highlightErrors && clashes[i]) || wrong?.[i]) return errorColour;
		return '#1d4ed8';
	}

	// ---- Input --------------------------------------------------------------------------------

	/** Enter digit `d` (0 erases) in the selected cell, as a note when `note` is set. */
	function enter(d: number, note: boolean) {
		const i = selected;
		if (readonly || blank || i < 0 || puzzle.givens[i]) return;
		let next: SudokuState;
		if (d === 0) {
			if (board.values[i]) next = placeDigit(puzzle, board, i, 0);
			else if (board.notes[i]) {
				const notes = board.notes.slice();
				notes[i] = 0;
				next = { ...board, notes };
			} else return;
		} else if (note) {
			if (board.values[i]) return;
			next = toggleNote(puzzle, board, i, d);
		} else {
			next = placeDigit(puzzle, board, i, board.values[i] === d ? 0 : d);
		}
		onmove(next, [String(i)]);
	}

	let svg: SVGSVGElement | undefined = $state();

	function cellAt(clientX: number, clientY: number): number {
		const rect = svg!.getBoundingClientRect();
		const scale = rect.width / width;
		const x = ((clientX - rect.left) / scale - pad) / cellSize;
		const y = ((clientY - rect.top) / scale - pad) / cellSize;
		if (x < 0 || y < 0 || x >= size || y >= size) return -1;
		return Math.floor(y) * size + Math.floor(x);
	}

	function onpointerdown(e: PointerEvent) {
		if (blank || e.button === 1) return;
		const cell = cellAt(e.clientX, e.clientY);
		if (cell < 0) return;
		e.preventDefault();
		selected = cell;
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

	function isTyping(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		return (
			!!target &&
			(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
		);
	}

	function onkeydown(e: KeyboardEvent) {
		if (!keyboard || blank || isTyping(e) || e.altKey || e.ctrlKey || e.metaKey) return;
		if (document.querySelector('dialog[open]')) return;
		const dir = DIRS[e.key] ?? DIRS[e.key.toLowerCase()];
		if (dir) {
			e.preventDefault();
			if (selected < 0) selected = 0;
			else {
				const r = (Math.floor(selected / size) + dir[0] + size) % size;
				const c = ((selected % size) + dir[1] + size) % size;
				selected = r * size + c;
			}
			return;
		}
		if (selected < 0) return;
		// Digit keys by their code, so that Shift+digit (a note) works on every keyboard layout.
		const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
		const d = m ? Number(m[1]) : -1;
		if (d >= 1 && d <= size) {
			e.preventDefault();
			enter(d, e.shiftKey !== (tool === 'note'));
		} else if (d === 0 || e.key === 'Backspace' || e.key === 'Delete') {
			e.preventDefault();
			enter(0, false);
		} else if (e.key === ' ') {
			e.preventDefault();
			ontool?.(tool === 'note' ? 'digit' : 'note');
		} else if (e.key === 'Escape') {
			selected = -1;
		}
	}

	/** Win animation: every box in its own colour for a moment. */
	const celebrationFill = $derived.by(() => {
		if (!celebrate || blank) return null;
		const boxes = cageOf ?? geometry(size).box;
		const colours = colourRegions(boxes, size, size, CELEBRATION_COLOURS.length);
		return boxes.map((b) => CELEBRATION_COLOURS[colours[b]]);
	});

	/** Notes sit in a small grid; under the cage label in Calcudoku. */
	const noteCols = $derived(calc ? Math.ceil(Math.sqrt(size)) : box.w);
	const noteRows = $derived(Math.ceil(size / noteCols));
	const noteTop = $derived(calc ? cellSize * 0.26 : 0);
	const noteFont = $derived(
		Math.min(cellSize / (noteCols + 0.6), (cellSize - noteTop) / (noteRows + 0.6))
	);
	const labelFont = $derived(Math.max(8, cellSize * 0.24));
</script>

<!-- Capture phase: the board handles its keys before the game's shortcuts see them -->
<svelte:window onkeydowncapture={onkeydown} />

<div class="flex flex-col items-center" style:width="{width}px">
	<!-- Only the svg itself is hit, like the other boards. -->
	<svg
		bind:this={svg}
		{width}
		{height}
		viewBox="0 0 {width} {height}"
		class="block touch-manipulation outline-none select-none [&_*]:pointer-events-none"
		role="grid"
		tabindex="-1"
		aria-label={t('game.board')}
		{onpointerdown}
		oncontextmenu={(e) => e.preventDefault()}
	>
		<rect x={pad} y={pad} width={size * cellSize} height={size * cellSize} fill="#ffffff" />
		{#each grid as d, i (i)}
			{@const x = pad + (i % size) * cellSize}
			{@const y = pad + Math.floor(i / size) * cellSize}
			<rect {x} {y} width={cellSize} height={cellSize} fill={fillOf(i)} />
			{#if d}
				<text
					data-cell={i}
					x={x + cellSize / 2}
					y={y + (calc ? cellSize * 0.58 : cellSize / 2)}
					font-size={cellSize * (calc ? 0.54 : 0.62)}
					font-weight={puzzle.givens[i] ? 700 : 500}
					fill={textColour(i)}
					text-anchor="middle"
					dominant-baseline="central">{d}</text
				>
			{:else if !blank && board.notes[i]}
				<g
					class="notes"
					font-size={noteFont}
					fill="#6b7280"
					text-anchor="middle"
					dominant-baseline="central"
				>
					{#each digits as n (n)}
						{#if board.notes[i] & bit(n)}
							<text
								fill={n === selectedDigit ? '#1d4ed8' : undefined}
								font-weight={n === selectedDigit ? 700 : undefined}
								x={x + (((n - 1) % noteCols) + 0.5) * (cellSize / noteCols)}
								y={y +
									noteTop +
									(Math.floor((n - 1) / noteCols) + 0.5) * ((cellSize - noteTop) / noteRows)}
								>{n}</text
							>
						{/if}
					{/each}
				</g>
			{/if}
		{/each}

		{#if celebrationFill}
			<g class="celebrate-regions" aria-hidden="true">
				{#each celebrationFill as fill, i (i)}
					<rect
						x={pad + (i % size) * cellSize}
						y={pad + Math.floor(i / size) * cellSize}
						width={cellSize}
						height={cellSize}
						{fill}
					/>
				{/each}
			</g>
		{/if}

		<!-- Thin cell lines -->
		<g stroke="#4b5563" stroke-width="1" opacity="0.55">
			{#each { length: size - 1 } as _, k (k)}
				<line
					x1={pad + (k + 1) * cellSize}
					y1={pad}
					x2={pad + (k + 1) * cellSize}
					y2={pad + size * cellSize}
				/>
				<line
					x1={pad}
					y1={pad + (k + 1) * cellSize}
					x2={pad + size * cellSize}
					y2={pad + (k + 1) * cellSize}
				/>
			{/each}
		</g>

		<!-- Box or cage borders -->
		<path d={boxLines} stroke="#111827" stroke-width="2.5" stroke-linecap="square" fill="none" />
		{#if calc}
			<g class="cages" font-size={labelFont} font-weight="600" dominant-baseline="hanging">
				{#each calc.cages as cage, k (k)}
					{@const i = labelCell(cage)}
					<text
						x={pad + (i % size) * cellSize + 3}
						y={pad + Math.floor(i / size) * cellSize + 3}
						fill={broken?.[k] ? errorColour : '#111827'}>{cageLabel(cage)}</text
					>
				{/each}
			</g>
		{/if}
		<rect
			x={pad}
			y={pad}
			width={size * cellSize}
			height={size * cellSize}
			fill="none"
			stroke="#111827"
			stroke-width="3"
		/>

		{#if !blank && settings.highlightLastChange}
			{#each [...lastChange] as key (key)}
				{@const i = Number(key)}
				<rect
					x={pad + (i % size) * cellSize + 2.5}
					y={pad + Math.floor(i / size) * cellSize + 2.5}
					width={cellSize - 5}
					height={cellSize - 5}
					fill="none"
					stroke="#2563eb"
					stroke-width="1.5"
				/>
			{/each}
		{/if}

		{#if settings.showCoordinates && !blank}
			<g
				fill="#6b7280"
				font-size={Math.min(12, pad * 0.75)}
				text-anchor="middle"
				dominant-baseline="central"
			>
				{#each { length: size } as _, k (k)}
					<text x={pad + (k + 0.5) * cellSize} y={pad / 2}>{columnLabel(k)}</text>
					<text x={pad + (k + 0.5) * cellSize} y={height - pad / 2}>{columnLabel(k)}</text>
					<text x={pad / 2} y={pad + (k + 0.5) * cellSize}>{k + 1}</text>
					<text x={width - pad / 2} y={pad + (k + 0.5) * cellSize}>{k + 1}</text>
				{/each}
			</g>
		{/if}
	</svg>

	{#if !blank && !readonly}
		<!-- Number pad: enters into the selected cell with the current tool -->
		<div class="mt-2 flex w-full gap-1 px-[3px]" role="toolbar" aria-label={t('games.sudoku.pad')}>
			{#each digits as d (d)}
				<button
					class="relative flex-1 rounded-md border border-stone-300 bg-white font-semibold text-blue-700 shadow-sm active:bg-stone-100 disabled:opacity-40 dark:border-stone-600 dark:bg-stone-800 dark:text-blue-300"
					style:height="{Math.min(56, cellSize * 0.95)}px"
					style:font-size="{Math.min(28, cellSize * 0.5)}px"
					class:opacity-40={settings.showRemaining && remaining[d] <= 0}
					disabled={selected < 0}
					onpointerdown={(e) => e.preventDefault()}
					title={settings.showRemaining
						? t('games.sudoku.left', { count: remaining[d] })
						: undefined}
					onclick={() => enter(d, tool === 'note')}
				>
					{d}
					{#if settings.showRemaining}
						<span
							class="absolute top-0.5 right-1 text-[0.55em] font-normal text-stone-500 dark:text-stone-400"
							aria-hidden="true">{remaining[d]}</span
						>
					{/if}
				</button>
			{/each}
			<button
				class="flex-1 rounded-md border border-stone-300 bg-white text-stone-600 shadow-sm active:bg-stone-100 disabled:opacity-40 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300"
				style:height="{Math.min(56, cellSize * 0.95)}px"
				style:font-size="{Math.min(24, cellSize * 0.4)}px"
				disabled={selected < 0}
				aria-label={t('games.sudoku.erase')}
				title={t('games.sudoku.erase')}
				onpointerdown={(e) => e.preventDefault()}
				onclick={() => enter(0, false)}>⌫</button
			>
		</div>
	{/if}
</div>
