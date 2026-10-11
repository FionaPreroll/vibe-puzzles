import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDuration } from '../../core/time';
import { tetroid } from '../../games/tetroid';
import { i18n } from '../../i18n/index.svelte';
import { messageClass } from './messageStyle';
import { question } from './questions';
import { bragKey, puzzleLink, screenshot, shareSolve, solveShare, type Solve } from './share';
import { Sharing } from './sharing.svelte';

vi.mock('$app/paths', () => ({ resolve: (path: string) => path.replace('[game]', 'tetroid') }));

const solve: Solve = {
	game: 'Tetroid',
	variant: '10x10 Hard',
	puzzleId: 12345,
	timeMs: 83_000,
	asked: 0,
	assisted: false,
	url: 'https://x.test/tetroid?id=12345'
};

/** A browser that draws: images load (or fail, with `broken`), canvases record what they get. */
function browser(broken = false) {
	const drawn: unknown[] = [];
	const revoked: string[] = [];
	vi.stubGlobal('URL', {
		createObjectURL: () => 'blob:svg',
		revokeObjectURL: (url: string) => revoked.push(url)
	});
	vi.stubGlobal(
		'Image',
		class {
			onload = () => {};
			onerror = () => {};
			set src(_: string) {
				setTimeout(() => (broken ? this.onerror() : this.onload()));
			}
		}
	);
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ({
			fillRect: (...args: unknown[]) => drawn.push(['fill', ...args]),
			drawImage: () => drawn.push('board'),
			fillStyle: ''
		}),
		toDataURL: (type: string) => `data:${type};base64,x`
	};
	vi.stubGlobal('document', { createElement: () => canvas });
	return { drawn, revoked, canvas };
}

function svg() {
	const clone = { setAttribute: vi.fn(), outerHTML: '<svg></svg>' };
	return {
		svg: {
			width: { baseVal: { value: 200 } },
			height: { baseVal: { value: 120 } },
			cloneNode: () => clone
		} as unknown as SVGSVGElement,
		clone
	};
}

describe('sharing texts', () => {
	it('link to a puzzle, with the position if given', () => {
		expect(puzzleLink('https://x.test/tetroid', 7)).toBe('https://x.test/tetroid?id=7');
		expect(puzzleLink('https://x.test/tetroid', 7, 'a.b')).toBe(
			'https://x.test/tetroid?id=7&s=a.b'
		);
	});

	it('name the hints asked for and mistakes shown, apart', () => {
		expect(bragKey(0, false)).toBe('game.brag');
		expect(bragKey(1, false)).toBe('game.bragHint');
		expect(bragKey(3, false)).toBe('game.bragHints');
		expect(bragKey(0, true)).toBe('game.bragAssist');
		expect(bragKey(1, true)).toBe('game.bragAssistHint');
		expect(bragKey(2, true)).toBe('game.bragAssistHints');
	});

	it('share a solve with its time, puzzle and hints', () => {
		const time = formatDuration(83_000, true);
		expect(solveShare(solve)).toEqual({
			title: 'Tetroid · Vibe Puzzles',
			text: `I solved Tetroid 10x10 Hard (puzzle 12,345) in ${time}! Can you beat my time?`,
			url: solve.url
		});
		expect(solveShare({ ...solve, asked: 2, assisted: true }).text).toContain(
			'with mistakes shown in red and 2 hints'
		);
	});

	it('ask in the language of the page', () => {
		expect(question('startOver', true)).toMatchObject({ confirm: 'Start over', danger: true });
		expect(question('replace').danger).toBe(false);
		const english = question('startOver').title;
		i18n.locale = 'de';
		try {
			expect(question('startOver').title).not.toBe(english);
		} finally {
			i18n.locale = 'en';
		}
	});

	it('colour messages by kind', () => {
		expect(messageClass('success')).toContain('emerald');
		expect(messageClass('error')).toContain('rose');
		expect(messageClass('info')).toContain('sky');
	});
});

describe('sharing a solve', () => {
	const data = { title: 'T', text: 'Solved!', url: 'https://x.test' };

	it('uses the share sheet where there is one, also when it is closed', async () => {
		const share = vi.fn(async () => {});
		expect(await shareSolve(data, { share })).toEqual({ how: 'sheet' });
		expect(share).toHaveBeenCalledWith(data);
		const closed = vi.fn(async () => Promise.reject(new Error('AbortError')));
		expect(await shareSolve(data, { share: closed })).toEqual({ how: 'sheet' });
	});

	it('copies the text and link without one', async () => {
		const writeText = vi.fn(async () => {});
		expect(await shareSolve(data, { clipboard: { writeText } })).toEqual({ how: 'copied' });
		expect(writeText).toHaveBeenCalledWith('Solved! https://x.test');
	});

	it('shows them to copy by hand when copying fails', async () => {
		const manual = { how: 'manual', text: 'Solved! https://x.test' };
		expect(await shareSolve(data, {})).toEqual(manual);
		const writeText = async () => Promise.reject(new Error('denied'));
		expect(await shareSolve(data, { clipboard: { writeText } })).toEqual(manual);
	});
});

describe('the page sharing', () => {
	beforeEach(() => vi.stubGlobal('location', { origin: 'https://x.test' }));
	afterEach(() => vi.unstubAllGlobals());

	function page(target = {}) {
		const puzzle = tetroid.generate(tetroid.variants[0], 1);
		const session = {
			puzzle,
			state: tetroid.emptyState(puzzle),
			puzzleId: 42,
			solved: false,
			askedHints: 1,
			assisted: false,
			message: null as unknown
		};
		return { session, sharing: new Sharing(tetroid, session as never, () => target) };
	}

	it('links to the board as it is', async () => {
		const { session, sharing } = page();
		await sharing.shareBoard(null);
		expect(sharing.board).toEqual({
			link: puzzleLink('https://x.test/tetroid', 42, tetroid.encodeState(session.state)),
			image: null
		});
	});

	it('shares nothing before a puzzle is there', async () => {
		const { session, sharing } = page();
		session.puzzle = null as never;
		await sharing.shareBoard(null);
		expect(sharing.board).toBeNull();
		session.puzzleId = 0;
		await sharing.shareSolve('Easy', 1000);
		expect(sharing.solveShared).toBe(false);
	});

	it('remembers the shared solve of this puzzle only', async () => {
		const writeText = vi.fn(async (_text: string) => {});
		const { session, sharing } = page({ clipboard: { writeText } });
		session.solved = true;
		expect(sharing.solveShared).toBe(false);
		await sharing.shareSolve('10x10 Hard', 60_000);
		expect(writeText.mock.calls[0][0]).toContain('with 1 hint');
		expect(writeText.mock.calls[0][0]).toContain('https://x.test/tetroid?id=42');
		expect(session.message).toMatchObject({ kind: 'info' });
		expect(sharing.solveShared).toBe(true);
		session.puzzleId = 43;
		expect(sharing.solveShared).toBe(false);
	});

	it('adds the picture of the board once it is drawn, unless the panel was closed', async () => {
		browser();
		const { sharing } = page();
		await sharing.shareBoard(svg().svg);
		expect(sharing.board?.image).toBe('data:image/png;base64,x');
		const closing = sharing.shareBoard(svg().svg);
		sharing.board = null;
		await closing;
		expect(sharing.board).toBeNull();
	});

	it("shares with the browser's own share sheet by default", async () => {
		const share = vi.fn(async () => {});
		vi.stubGlobal('navigator', { share });
		const { session } = page();
		await new Sharing(tetroid, session as never).shareSolve('Easy', 1000);
		expect(share).toHaveBeenCalledOnce();
	});

	it('shows the text to copy by hand when copying fails', async () => {
		const { sharing } = page();
		await sharing.shareSolve('Easy', 1000);
		expect(sharing.manualText).toContain('https://x.test/tetroid?id=42');
	});
});

describe('a picture of the board', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('draws the board on white, at its size', async () => {
		const { drawn, revoked, canvas } = browser();
		const { svg: board, clone } = svg();
		expect(await screenshot(board)).toBe('data:image/png;base64,x');
		expect(clone.setAttribute).toHaveBeenCalledWith('xmlns', 'http://www.w3.org/2000/svg');
		expect(canvas).toMatchObject({ width: 200, height: 120 });
		expect(drawn).toEqual([['fill', 0, 0, 200, 120], 'board']);
		expect(revoked).toEqual(['blob:svg']);
	});

	it('gives none when the image does not load', async () => {
		const { revoked } = browser(true);
		expect(await screenshot(svg().svg)).toBeNull();
		expect(revoked).toEqual(['blob:svg']);
	});
});
