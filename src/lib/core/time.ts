/** Below this a finished time also shows milliseconds: quick solves differ by fractions. */
export const PRECISE_BELOW_MS = 30_000;

/**
 * Format a duration as mm:ss, h:mm:ss or Nd hh:mm:ss. `precise` adds milliseconds to times
 * under 30 s (mm:ss.mmm); only for finished times, so a running clock stays calm.
 */
export function formatDuration(ms: number, precise = false): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const s = total % 60;
	const m = Math.floor(total / 60) % 60;
	const h = Math.floor(total / 3600) % 24;
	const d = Math.floor(total / 86400);
	const p2 = (n: number) => String(n).padStart(2, '0');
	if (d > 0) return `${d}d ${p2(h)}:${p2(m)}:${p2(s)}`;
	if (h > 0) return `${h}:${p2(m)}:${p2(s)}`;
	if (precise && ms >= 0 && ms < PRECISE_BELOW_MS) {
		return `${p2(m)}:${p2(s)}.${String(Math.floor(ms) % 1000).padStart(3, '0')}`;
	}
	return `${p2(m)}:${p2(s)}`;
}
