/** Format a duration as mm:ss, h:mm:ss or Nd hh:mm:ss. */
export function formatDuration(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const s = total % 60;
	const m = Math.floor(total / 60) % 60;
	const h = Math.floor(total / 3600) % 24;
	const d = Math.floor(total / 86400);
	const p2 = (n: number) => String(n).padStart(2, '0');
	if (d > 0) return `${d}d ${p2(h)}:${p2(m)}:${p2(s)}`;
	if (h > 0) return `${h}:${p2(m)}:${p2(s)}`;
	return `${p2(m)}:${p2(s)}`;
}
