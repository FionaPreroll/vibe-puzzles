/**
 * A backup in a link, to bring it to another device without a file: the backup's JSON, compressed
 * (deflate) and in base64url, in the fragment of a link to the About page (`#backup=…`). The
 * fragment never leaves the browser, so the host does not see it. The About page that opens such a
 * link offers to import it.
 */
import { encode } from 'uqr';
import { parseBackup, type Backup, type ParseResult } from './backup';

/** The fragment's name: `#backup=<data>`. */
export const LINK_PARAM = 'backup';

/**
 * The densest QR code shown: version 25 at the lowest error correction holds a link of 1,273
 * characters, about as dense as a phone's camera still reads off a screen.
 */
const QR_MAX_VERSION = 25;

async function pipe(bytes: Uint8Array, through: CompressionStream | DecompressionStream) {
	const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(through);
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
	if (!/^[\w-]*$/.test(text)) return null;
	try {
		const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
		return Uint8Array.from(binary, (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

/** The link to `pageUrl` (the About page) that carries `backup`. */
export async function backupLink(pageUrl: string, backup: Backup): Promise<string> {
	// The schema's address only makes the file easier to read; the link stays shorter without it.
	const { $schema: _, ...rest } = backup;
	const json = new TextEncoder().encode(JSON.stringify(rest));
	const data = toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
	const url = new URL(pageUrl);
	url.hash = `${LINK_PARAM}=${data}`;
	return url.href;
}

/**
 * The backup in a page's fragment (`location.hash`), null when the fragment carries none. A
 * broken one gives the reason, as `parseBackup` does.
 */
export async function backupFromHash(hash: string): Promise<ParseResult | null> {
	const prefix = `#${LINK_PARAM}=`;
	if (!hash.startsWith(prefix)) return null;
	const bytes = fromBase64Url(hash.slice(prefix.length));
	if (!bytes?.length) return { ok: false, error: 'broken link' };
	try {
		const json = await pipe(bytes, new DecompressionStream('deflate-raw'));
		return parseBackup(new TextDecoder().decode(json));
	} catch {
		return { ok: false, error: 'broken link' };
	}
}

/** The QR code of `link` as an SVG path in a square of `size` modules, or null if it is too long. */
export function qrCode(link: string): { size: number; path: string } | null {
	try {
		const qr = encode(link, { ecc: 'L', maxVersion: QR_MAX_VERSION, border: 2 });
		let path = '';
		qr.data.forEach((row, y) =>
			row.forEach((dark, x) => {
				if (dark) path += `M${x} ${y}h1v1h-1z`;
			})
		);
		return { size: qr.size, path };
	} catch {
		return null;
	}
}
