import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	afterBoard,
	clampZoom,
	DEFAULT_CELL,
	fitCellSize,
	MAX_CELL,
	MIN_PANEL_HEIGHT,
	panelHeight,
	printCellSize,
	SHORT_SCREEN,
	storedZoom,
	WIDESCREEN_MAX_CELL,
	zoomedCellSize,
	type FitInput
} from './boardFit';
import { BoardFit } from './boardFit.svelte';

afterEach(() => vi.unstubAllGlobals());

/** A wide screen with room for a big board. */
const desk: FitInput = {
	areaWidth: 1000,
	viewportHeight: 900,
	boardTop: 100,
	afterBoard: 150,
	stagePad: 12,
	width: 10,
	height: 10
};

describe('fitting the board', () => {
	it('takes the default size until the page is measured', () => {
		expect(fitCellSize({ ...desk, areaWidth: 0 })).toBe(DEFAULT_CELL);
	});

	it('fits the height when the screen is wide', () => {
		// (900 - 100 - 4 - 150 - 24) / (10 + 0.4) = 59.8
		expect(fitCellSize(desk)).toBe(59);
	});

	it('fits the width when the screen is narrow', () => {
		// (390 - 16) / 10.4 = 35.96
		expect(fitCellSize({ ...desk, areaWidth: 390, stagePad: 8 })).toBe(35);
	});

	it('leaves room for coordinates and rows below the grid', () => {
		expect(fitCellSize({ ...desk, showCoordinates: true })).toBe(Math.floor(622 / 11.3));
		expect(fitCellSize({ ...desk, padRows: 2 })).toBe(Math.floor(622 / 12.4));
	});

	it('keeps cells between 16 and 96 px, and some height even on a short screen', () => {
		expect(fitCellSize({ ...desk, width: 2, height: 2 })).toBe(96);
		expect(fitCellSize({ ...desk, width: 100, height: 100 })).toBe(16);
		// No room left at all: 240 px of height still count.
		expect(fitCellSize({ ...desk, viewportHeight: 200, height: 4, width: 4 })).toBe(54);
	});

	it('zooms from the fitted size', () => {
		expect(zoomedCellSize(40, 1)).toBe(40);
		expect(zoomedCellSize(40, 1.5)).toBe(60);
		expect(zoomedCellSize(20, 0.3)).toBe(8);
		expect(clampZoom(5)).toBe(3);
		expect(clampZoom(0.1)).toBe(0.3);
	});

	it('reads only a stored zoom that is a number', () => {
		expect(storedZoom(1.5)).toBe(1.5);
		expect(storedZoom(9)).toBe(3);
		for (const v of ['2', null, NaN, {}]) expect(storedZoom(v)).toBe(1);
	});

	it('prints about 640 px wide, at most 40 px a cell', () => {
		expect(printCellSize(5)).toBe(40);
		expect(printCellSize(19)).toBe(32);
	});

	it('measures what is below the board, without a longer side panel', () => {
		expect(afterBoard({ body: 1000, boardArea: 700, rootContent: 900, gameColumn: 900 })).toBe(300);
		// The side panel reaches 200 px below the game column: that part does not count.
		expect(afterBoard({ body: 1200, boardArea: 700, rootContent: 1100, gameColumn: 900 })).toBe(
			300
		);
	});
});

/** An element whose box has the given top and bottom. */
const box = (top: number, bottom: number) =>
	({ getBoundingClientRect: () => ({ top, bottom }) }) as HTMLElement;

describe('widescreen', () => {
	it('lets small boards grow beyond the usual largest cell', () => {
		// 1080 px less 278 px above and below the board, for 5 cells and their margins.
		const tall = { ...desk, areaWidth: 1500, viewportHeight: 1080, width: 5, height: 5 };
		expect(fitCellSize(tall)).toBe(MAX_CELL);
		expect(fitCellSize({ ...tall, maxCell: WIDESCREEN_MAX_CELL })).toBe(Math.floor(802 / 5.4));
		const fit = new BoardFit();
		Object.assign(fit, { areaWidth: 1500, viewportHeight: 1080, boardTop: 100, afterBoard: 150 });
		expect(fit.fitCell({ width: 5, height: 5 })).toBe(MAX_CELL);
		fit.landscape = true;
		fit.pageLayout = 'right';
		expect(fit.fitCell({ width: 5, height: 5 })).toBe(Math.floor(802 / 5.4));
	});
});

describe('the widescreen panel', () => {
	it('takes the screen below the page top, without what follows the page', () => {
		expect(panelHeight(1080, 81, 52)).toBe(947);
	});

	it('keeps a usable height on short screens', () => {
		expect(panelHeight(300, 81, 52)).toBe(MIN_PANEL_HEIGHT);
	});
});

describe('measuring the page', () => {
	it('fits the board with what it measured', () => {
		const fit = new BoardFit();
		expect(fit.fitCell(null)).toBe(DEFAULT_CELL);
		Object.assign(fit, { areaWidth: 600, viewportHeight: 900, boardTop: 150, afterBoard: 100 });
		expect(fit.fitCell({ width: 8, height: 8 }, 1, true)).toBe(
			fitCellSize({
				areaWidth: 600,
				viewportHeight: 900,
				boardTop: 150,
				afterBoard: 100,
				stagePad: 12,
				width: 8,
				height: 8,
				padRows: 1,
				showCoordinates: true
			})
		);
		fit.wide = false;
		expect(fit.stagePad).toBe(8);
		expect(fit.layout).toEqual([900, 0, 0, 600, 0, 0, 0, 0]);
	});

	it('is widescreen on screens in landscape, unless the player picks the standard layout', () => {
		const fit = new BoardFit();
		fit.landscape = true;
		expect(fit.widescreen).toBe(false);
		fit.pageLayout = 'right';
		expect(fit.widescreen).toBe(true);
		expect(fit.layout.at(-2)).toBe(1);
		// Upright screens keep their layout, whatever their width.
		fit.landscape = false;
		expect(fit.widescreen).toBe(false);
		fit.landscape = true;
		fit.wide = false;
		fit.pageLayout = 'left';
		expect(fit.widescreen).toBe(true);
	});

	it('reads where the board starts and what is below it', () => {
		vi.stubGlobal('window', { scrollY: 50 });
		vi.stubGlobal('getComputedStyle', () => ({ paddingBottom: '16px' }));
		let header: HTMLElement | null = box(0, 60);
		vi.stubGlobal('document', {
			querySelector: () => header,
			body: box(0, 1200)
		});
		const fit = new BoardFit();
		fit.measure();
		// Nothing bound yet: the defaults stay.
		expect(fit.boardTop).toBe(200);

		fit.pageRoot = box(60, 1116);
		fit.gameColumn = box(80, 900);
		fit.areaWrap = box(90, 700);
		fit.boardArea = box(100, 700);
		fit.measure();
		expect(fit.boardTop).toBe(154);
		expect(fit.headerGap).toBe(30);
		// The side panel reaches 200 px below the game column.
		expect(fit.afterBoard).toBe(300);
		// The screen (800) from the page's top (110) down to the footer below the page (84).
		expect(fit.panelHeight).toBe(606);

		// Without the page's header (or before the board area is bound) the gap stays as it was.
		header = null;
		fit.boardArea = box(110, 710);
		fit.measure();
		expect(fit.boardTop).toBe(164);
		expect(fit.headerGap).toBe(30);
	});

	it('is short on low screens in widescreen, and leaves the footer below the screen', () => {
		vi.stubGlobal('window', { scrollY: 0 });
		vi.stubGlobal('getComputedStyle', () => ({ paddingBottom: '0px' }));
		const footer = box(390, 430);
		vi.stubGlobal('document', {
			querySelector: (selector: string) => (selector === 'footer' ? footer : null),
			body: box(0, 430)
		});
		const fit = new BoardFit();
		fit.viewportHeight = 390;
		fit.pageRoot = box(8, 382);
		fit.gameColumn = box(8, 362);
		fit.boardArea = box(8, 362);
		fit.measure();
		expect(fit.short).toBe(false);
		// The footer counts: the panel stops above it.
		expect(fit.panelHeight).toBe(390 - 8 - 48);

		fit.landscape = true;
		fit.pageLayout = 'left';
		expect(fit.short).toBe(true);
		expect(fit.layout.at(-1)).toBe(1);
		fit.measure();
		// Down to the screen's edge, less the page's padding (8) below the panel.
		expect(fit.panelHeight).toBe(374);
		expect(fit.afterBoard).toBe(8);

		fit.viewportHeight = SHORT_SCREEN;
		expect(fit.short).toBe(false);
	});

	it('follows the layout and the page size until stopped', () => {
		const media = Object.assign(new EventTarget(), { matches: true });
		const landscape = Object.assign(new EventTarget(), { matches: true });
		vi.stubGlobal('matchMedia', (query: string) =>
			query.includes('orientation') ? landscape : media
		);
		const observed = { body: null as unknown, callback: null as (() => void) | null, off: false };
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(callback: () => void) {
					observed.callback = callback;
				}
				observe(el: unknown) {
					observed.body = el;
				}
				disconnect() {
					observed.off = true;
				}
			}
		);
		vi.stubGlobal('document', { body: 'body' });
		const onLayout = vi.fn();
		const fit = new BoardFit();
		const measure = vi.spyOn(fit, 'measure');
		const stop = fit.observe(onLayout);
		expect(onLayout).toHaveBeenLastCalledWith(true);
		expect(fit.landscape).toBe(true);
		// A phone turned upright.
		landscape.matches = false;
		landscape.dispatchEvent(new Event('change'));
		expect(fit.landscape).toBe(false);
		media.matches = false;
		media.dispatchEvent(new Event('change'));
		expect(fit.wide).toBe(false);
		expect(onLayout).toHaveBeenLastCalledWith(false);
		expect(observed.body).toBe('body');
		observed.callback!();
		expect(measure).toHaveBeenCalledOnce();
		stop();
		expect(observed.off).toBe(true);
		media.dispatchEvent(new Event('change'));
		landscape.dispatchEvent(new Event('change'));
		expect(onLayout).toHaveBeenCalledTimes(3);
	});
});
