import type { PageLayout } from '../../core/types';
import {
	afterBoard,
	DEFAULT_CELL,
	fitCellSize,
	panelHeight,
	WIDESCREEN_MAX_CELL
} from './boardFit';

/** The wide layout, Tailwind's `lg`: the side panel beside the board, the play bar below it. */
const WIDE = '(min-width: 1024px)';
/**
 * Screens where widescreen can apply: wider than tall, desktops as well as tablets and phones on
 * their side, but not the narrowest phones.
 */
const LANDSCAPE = '(orientation: landscape) and (min-width: 600px)';

/**
 * What the game page measures to fit the board on the screen. The page binds its elements and
 * sizes to the fields; `measure` reads the rest from the layout, and `fitCell` turns it all into
 * the automatic cell size (`boardFit.ts`).
 */
export class BoardFit {
	/** Width of the board area. */
	areaWidth = $state(0);
	viewportHeight = $state(800);
	/** The wide layout (side panel, play bar below the board) rather than the phone one. */
	wide = $state(true);
	/** A screen in landscape (`LANDSCAPE`), where widescreen can apply. */
	landscape = $state(typeof matchMedia === 'function' && matchMedia(LANDSCAPE).matches);
	/** The player's layout for screens in landscape; upright ones keep theirs. */
	pageLayout = $state<PageLayout>('standard');
	/** Height the widescreen panel may take without making the page scroll. */
	panelHeight = $state(0);
	toolbarHeight = $state(0);
	/** Height of the play bar, ID line and buttons below the board. */
	belowHeight = $state(0);
	/** Height of the phones' fixed tool bar (0 where it is hidden). */
	barHeight = $state(0);
	/** Width of the board with its surface: the rows above and below it are no wider. */
	stageWidth = $state(0);
	/** The play bar below the board on wide screens; the board's stage is at least as wide. */
	barWidth = $state(0);
	/** Page offset of the board's top edge, without the board's own surface around it. */
	boardTop = $state(200);
	/** How far below the page's header the board area starts. */
	headerGap = $state(0);
	/** Everything on the page below the board area: tools, buttons, paddings and the footer. */
	afterBoard = $state(120);

	/** The page's root, its game column, the board area and the board's scroll container. */
	pageRoot: HTMLElement | undefined = $state();
	gameColumn: HTMLElement | undefined = $state();
	areaWrap: HTMLElement | undefined = $state();
	boardArea: HTMLElement | undefined = $state();

	/**
	 * Widescreen: the board alone in its column, as tall as the screen allows, and everything else
	 * in a panel beside it (`WidePanel`).
	 */
	get widescreen(): boolean {
		return this.landscape && this.pageLayout !== 'standard';
	}

	/** Padding of the board's surface (p-2, lg:p-3), which the board's size leaves room for. */
	get stagePad(): number {
		return this.wide ? 12 : 8;
	}

	/** Read the board's place on the page and what comes below it. */
	measure() {
		const { boardArea, pageRoot, gameColumn, areaWrap } = this;
		if (!boardArea || !pageRoot || !gameColumn) return;
		// The scroll container's py-1 sits above the board's surface.
		this.boardTop = boardArea.getBoundingClientRect().top + window.scrollY + 4;
		const header = document.querySelector('header');
		if (areaWrap && header) {
			this.headerGap = areaWrap.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
		}
		// Up to the page's end, but not where a longer side panel reaches beyond the game column.
		const rootBox = pageRoot.getBoundingClientRect();
		const root = rootBox.bottom;
		const body = document.body.getBoundingClientRect().bottom;
		this.panelHeight = panelHeight(this.viewportHeight, rootBox.top + window.scrollY, body - root);
		this.afterBoard = afterBoard({
			body,
			boardArea: boardArea.getBoundingClientRect().bottom,
			rootContent: root - parseFloat(getComputedStyle(pageRoot).paddingBottom),
			gameColumn: gameColumn.getBoundingClientRect().bottom
		});
	}

	/**
	 * Follow the layout until the returned function is called: the switch between the wide and the
	 * phone layout (`onLayout` hears it), and any change of the page's size (footer, banners).
	 */
	observe(onLayout: (wide: boolean) => void = () => {}): () => void {
		const media = matchMedia(WIDE);
		const landscape = matchMedia(LANDSCAPE);
		const layout = () => {
			this.wide = media.matches;
			this.landscape = landscape.matches;
			onLayout(this.wide);
		};
		layout();
		media.addEventListener('change', layout);
		landscape.addEventListener('change', layout);
		const observer = new ResizeObserver(() => this.measure());
		observer.observe(document.body);
		return () => {
			observer.disconnect();
			media.removeEventListener('change', layout);
			landscape.removeEventListener('change', layout);
		};
	}

	/** Sizes that move the board when they change; reading them makes an effect re-measure. */
	get layout(): number[] {
		const { viewportHeight, wide, toolbarHeight, areaWidth, belowHeight, barHeight } = this;
		const layout = [viewportHeight, +wide, toolbarHeight, areaWidth, belowHeight, barHeight];
		return [...layout, +this.widescreen];
	}

	/** The automatic cell size for a grid of `width` × `height` cells. */
	fitCell(
		grid: { width: number; height: number } | null,
		padRows = 0,
		showCoordinates = false
	): number {
		if (!grid) return DEFAULT_CELL;
		const { areaWidth, viewportHeight, boardTop, afterBoard, stagePad } = this;
		const { width, height } = grid;
		const input = { areaWidth, viewportHeight, boardTop, afterBoard, stagePad, width, height };
		const maxCell = this.widescreen ? WIDESCREEN_MAX_CELL : undefined;
		return fitCellSize({ ...input, padRows, showCoordinates, maxCell });
	}
}
