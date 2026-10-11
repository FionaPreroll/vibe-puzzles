import { lightColours } from '../../core/palette';
import { formatDuration } from '../../core/time';
import { t } from '../../i18n/index.svelte';

/**
 * Sharing from the game page: a link to the board as it is, the text that shares a solve, and a
 * picture of the board.
 */

/** A link that opens puzzle `puzzleId`, with the position `encoded` (`encodeState`) if given. */
export function puzzleLink(gameUrl: string, puzzleId: number, encoded?: string): string {
	const q = new URLSearchParams({ id: String(puzzleId) });
	if (encoded !== undefined) q.set('s', encoded);
	return `${gameUrl}?${q}`;
}

/**
 * The translation key of the text that shares a solve. Painting mistakes red (`assisted`) is named
 * as such, not passed off as one more hint; `asked` counts the hints asked for.
 */
export function bragKey(asked: number, assisted: boolean): string {
	const hints = asked === 0 ? '' : asked === 1 ? 'Hint' : 'Hints';
	return `game.brag${assisted ? 'Assist' : ''}${hints}`;
}

/** What shares a solve: the game, the puzzle and its time, and what helped. */
export interface Solve {
	game: string;
	/** The puzzle type's name. */
	variant: string;
	puzzleId: number;
	timeMs: number;
	/** Hints asked for with the Hint button. */
	asked: number;
	/** A setting that counts as a hint was on (painting mistakes red). */
	assisted: boolean;
	/** The link to the puzzle. */
	url: string;
}

/** The title, text and link that share a solve. */
export function solveShare(s: Solve): { title: string; text: string; url: string } {
	const text = t(bragKey(s.asked, s.assisted), {
		game: s.game,
		variant: s.variant,
		id: s.puzzleId.toLocaleString('en-US'),
		time: formatDuration(s.timeMs, true),
		count: s.asked
	});
	return { title: `${s.game} · ${t('app.name')}`, text, url: s.url };
}

/** How a solve was shared: the share sheet, the clipboard, or neither (`manual`: copy by hand). */
export type Shared = { how: 'sheet' } | { how: 'copied' } | { how: 'manual'; text: string };

/** What sharing needs of the browser's `navigator`. */
export interface ShareTarget {
	share?(data: { title: string; text: string; url: string }): Promise<void>;
	clipboard?: { writeText(text: string): Promise<void> };
}

/** Share a text and link, e.g. to a messenger; without the Web Share API the text is copied. */
export async function shareSolve(
	data: { title: string; text: string; url: string },
	target: ShareTarget = navigator
): Promise<Shared> {
	if (target.share) {
		try {
			await target.share(data);
		} catch {
			// The share sheet was closed.
		}
		return { how: 'sheet' };
	}
	const text = `${data.text} ${data.url}`;
	try {
		if (!target.clipboard) throw new Error('No clipboard');
		await target.clipboard.writeText(text);
		return { how: 'copied' };
	} catch {
		// Too long for a message: shown in a dialog to copy by hand.
		return { how: 'manual', text };
	}
}

/** Render the board's SVG into a PNG data URL, in the light colours whatever the theme. */
export async function screenshot(svg: SVGSVGElement): Promise<string | null> {
	// Sizes from now: opening the share panel can shrink the board before the image loads.
	const width = svg.width.baseVal.value;
	const height = svg.height.baseVal.value;
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	const markup = lightColours(clone.outerHTML);
	const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
	try {
		const img = new Image();
		await new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = reject;
			img.src = url;
		});
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(img, 0, 0);
		return canvas.toDataURL('image/png');
	} catch {
		return null;
	} finally {
		URL.revokeObjectURL(url);
	}
}
