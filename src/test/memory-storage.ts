/** In-memory Storage for unit tests; `full` makes every write fail like a full quota. */
export class MemoryStorage implements Storage {
	private map = new Map<string, string>();
	full = false;
	get length() {
		return this.map.size;
	}
	key(i: number) {
		return [...this.map.keys()][i] ?? null;
	}
	getItem(k: string) {
		return this.map.get(k) ?? null;
	}
	setItem(k: string, v: string) {
		if (this.full) throw new DOMException('Storage is full', 'QuotaExceededError');
		this.map.set(k, v);
	}
	removeItem(k: string) {
		this.map.delete(k);
	}
	clear() {
		this.map.clear();
	}
}
