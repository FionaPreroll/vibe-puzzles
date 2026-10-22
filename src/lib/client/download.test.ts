import { afterEach, expect, it, vi } from 'vitest';
import { DOWNLOAD_LINK_MS, downloadFile } from './download';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

it('keeps the link to the file until the browser has had time to read it', () => {
	vi.useFakeTimers();
	const revoked: string[] = [];
	vi.stubGlobal('URL', {
		createObjectURL: () => 'blob:backup',
		revokeObjectURL: (url: string) => revoked.push(url)
	});
	const link = { href: '', download: '', click: vi.fn() };
	const createElement = vi.fn(() => link);
	vi.stubGlobal('document', { createElement });

	downloadFile(new Blob(['{}'], { type: 'application/json' }), 'backup.json');
	expect(createElement).toHaveBeenCalledWith('a');
	expect(link).toMatchObject({ href: 'blob:backup', download: 'backup.json' });
	expect(link.click).toHaveBeenCalledOnce();
	// Safari may read the file only after the click: revoking the link at once can abort it.
	vi.advanceTimersByTime(DOWNLOAD_LINK_MS - 1);
	expect(revoked).toEqual([]);
	vi.advanceTimersByTime(1);
	expect(revoked).toEqual(['blob:backup']);
});
