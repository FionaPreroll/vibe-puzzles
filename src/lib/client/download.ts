/**
 * How long the link to a file offered for download stays valid. Safari may read the file only
 * after `click()` returns, and revoking the link at once can abort its download.
 */
export const DOWNLOAD_LINK_MS = 40_000;

/** Offer `blob` as a file named `name`, as a click on a download link does. */
export function downloadFile(blob: Blob, name: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_LINK_MS);
}
