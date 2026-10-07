/** Small deterministic PRNG (mulberry32). Same seed → same sequence on every platform. */
export class Rng {
	private s: number;

	constructor(seed: number) {
		this.s = seed >>> 0 || 0x9e3779b9;
	}

	/** Float in [0, 1). */
	next(): number {
		let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/** Integer in [0, n). */
	int(n: number): number {
		return Math.floor(this.next() * n);
	}

	pick<T>(items: readonly T[]): T {
		return items[this.int(items.length)];
	}

	shuffle<T>(items: T[]): T[] {
		for (let i = items.length - 1; i > 0; i--) {
			const j = this.int(i + 1);
			[items[i], items[j]] = [items[j], items[i]];
		}
		return items;
	}
}

/** FNV-1a string hash, used to derive seeds from text keys. */
export function hashString(text: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}
